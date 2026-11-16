import {
  TRPCError,
  z,
  adminWithPermission,
  PERMISSIONS,
  db,
  logAudit,
} from "../_shared";

// admin.* procedures: User management.
export const adminUserProcedures = {
  users: adminWithPermission(PERMISSIONS.MANAGE_USERS)
    .input(z.object({ limit: z.number().optional(), offset: z.number().optional(), search: z.string().max(200).optional(), role: z.string().optional() }))
    .query(async ({ input }) => {
      return db.getAllUsers(input.limit, input.offset, input.search, input.role);
    }),

  updateUserRole: adminWithPermission(PERMISSIONS.MANAGE_USERS)
    .input(z.object({ userId: z.number(), role: z.enum(["user", "admin", "landlord", "tenant"]) }))
    .mutation(async ({ ctx, input }) => {
      // Protect root admin from being demoted
      const targetPerms = await db.getAdminPermissions(input.userId);
      if (targetPerms?.isRootAdmin && input.role !== "admin") {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot change root admin role' });
      }
      // Only root admin can promote to admin
      if (input.role === 'admin') {
        const callerPerms = await db.getAdminPermissions(ctx.user!.id);
        if (!callerPerms?.isRootAdmin) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Only root admin can promote users to admin role' });
        }
      }
      await db.updateUserRole(input.userId, input.role);
      return { success: true };
    }),

  // ─── Create Admin User (RBAC: MANAGE_USERS) ────────────────────────────
  createUser: adminWithPermission(PERMISSIONS.MANAGE_USERS)
    .input(z.object({
      username: z.string().min(3).max(50),
      password: z.string().min(6).max(100),
      name: z.string().max(100),
      nameAr: z.string().max(100).optional(),
      email: z.string().email(),
      phone: z.string().max(20).optional(),
      role: z.enum(["user", "admin", "landlord", "tenant"]),
      title: z.string().max(100).optional(),
      titleAr: z.string().max(100).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Only root admin can create admin users
      if (input.role === 'admin') {
        const callerPerms = await db.getAdminPermissions(ctx.user!.id);
        if (!callerPerms?.isRootAdmin) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Only root admin can create admin users' });
        }
      }
      // Check if username already exists
      const existing = await db.getUserByUserId(input.username);
      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Username already exists' });
      }
      // Check if email already exists
      const existingEmail = await db.getUserByEmail(input.email);
      if (existingEmail) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Email already exists' });
      }
      // Hash password
      const bcrypt = await import('bcryptjs');
      const salt = await bcrypt.genSalt(12);
      const passwordHash = await bcrypt.hash(input.password, salt);
      const id = await db.createLocalUser({
        userId: input.username,
        passwordHash,
        displayName: input.name,
        name: input.name,
        nameAr: input.nameAr,
        email: input.email,
        phone: input.phone,
        role: input.role,
      });
      if (!id) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create user' });
      }
      // If admin role, grant default admin permissions
      if (input.role === 'admin') {
        const defaultPerms = [
          "manage_users", "manage_properties", "manage_bookings", "manage_payments",
          "manage_services", "manage_maintenance", "manage_cms", "manage_cities",
          "manage_knowledge", "manage_roles", "manage_settings", "view_analytics",
          "send_notifications", "manage_ai"
        ];
        await db.setAdminPermissions(id, defaultPerms, false);
      }
      logAudit({
        userId: ctx.user!.id,
        action: 'CREATE',
        entityType: 'USER',
        entityId: id,
        metadata: { username: input.username, email: input.email, role: input.role, title: input.title },
      });
      return { success: true, id };
    }),

  // ─── Delete User (RBAC: MANAGE_USERS) ────────────────────────────
  deleteUser: adminWithPermission(PERMISSIONS.MANAGE_USERS)
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      // Protect root admin from being deleted
      const targetPerms = await db.getAdminPermissions(input.userId);
      if (targetPerms?.isRootAdmin) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot delete root admin' });
      }
      // Cannot delete yourself
      if (input.userId === ctx.user!.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot delete your own account' });
      }
      // Remove admin permissions first
      try { await db.deleteAdminPermissions(input.userId); } catch {}
      // Delete the user
      await db.deleteUser(input.userId);
      logAudit({
        userId: ctx.user!.id,
        action: 'DELETE',
        entityType: 'USER',
        entityId: input.userId,
      });
      return { success: true };
    }),

  // ─── Reset User Password (RBAC: MANAGE_USERS) ────────────────────────────
  resetUserPassword: adminWithPermission(PERMISSIONS.MANAGE_USERS)
    .input(z.object({
      userId: z.number(),
      newPassword: z.string().min(6).max(100),
    }))
    .mutation(async ({ ctx, input }) => {
      // Protect root admin password from being changed by non-root
      const targetPerms = await db.getAdminPermissions(input.userId);
      if (targetPerms?.isRootAdmin) {
        const callerPerms = await db.getAdminPermissions(ctx.user!.id);
        if (!callerPerms?.isRootAdmin) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Only root admin can reset root admin password' });
        }
      }
      const bcrypt = await import('bcryptjs');
      const salt = await bcrypt.genSalt(12);
      const passwordHash = await bcrypt.hash(input.newPassword, salt);
      await db.updateUserPassword(input.userId, passwordHash);
      logAudit({
        userId: ctx.user!.id,
        action: 'UPDATE',
        entityType: 'USER',
        entityId: input.userId,
        metadata: { action: 'password_reset' },
      });
      return { success: true };
    }),
};
