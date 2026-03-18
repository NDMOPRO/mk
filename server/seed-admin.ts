import bcrypt from "bcryptjs";
import * as db from "./db";
import { nanoid } from "nanoid";
import crypto from "crypto";

/**
 * Seeds the default admin user if not already present.
 * Called on server startup to ensure admin access is always available.
 */
export async function seedAdminUser() {
  try {
    // Seed demo property manager
    await seedDemoPropertyManager();

    // Always ensure admin permissions exist (even if user already exists)
    await ensureAdminPermissions();

    const existing = await db.getUserByUserId("Hobart");
    if (existing) {
      console.log("[Seed] Admin user 'Hobart' already exists, skipping.");
    } else {
      // Use ADMIN_INITIAL_PASSWORD env var or generate a random one-time password
      const adminPassword = process.env.ADMIN_INITIAL_PASSWORD || crypto.randomBytes(16).toString('base64url');
      if (!process.env.ADMIN_INITIAL_PASSWORD) {
        console.log(`[Seed] Generated random admin password (change immediately): ${adminPassword}`);
        console.log(`[Seed] Set ADMIN_INITIAL_PASSWORD env var to control this.`);
      }
      const salt = await bcrypt.genSalt(12);
      const passwordHash = await bcrypt.hash(adminPassword, salt);

      const id = await db.createLocalUser({
        userId: "Hobart",
        passwordHash,
        displayName: "Admin",
        name: "Khalid Abdullah",
        nameAr: "خالد عبدالله",
        email: "hobarti@protonmail.com",
        phone: "+966504466528",
        role: "admin",
      });

      if (id) {
        console.log("[Seed] Admin user 'Hobart' created successfully (id:", id, ")");
        // Grant full root admin permissions
        const allPermissions = [
          "manage_users", "manage_properties", "manage_bookings", "manage_payments",
          "manage_services", "manage_maintenance", "manage_cms", "manage_cities",
          "manage_knowledge", "manage_roles", "manage_settings", "view_analytics",
          "send_notifications", "manage_ai"
        ];
        await db.setAdminPermissions(id, allPermissions, true);
        console.log("[Seed] Root admin permissions granted to 'Hobart'");
      } else {
        console.error("[Seed] Failed to create admin user");
      }
    }

    // Seed Operations Manager
    await seedAdminTeamMember({
      userId: "mushtaq",
      name: "Mushtaq Ibn Mohammed",
      nameAr: "مشتاق بن محمد",
      email: "operations@monthlykey.com",
      role: "admin",
      permissions: [
        "manage_properties", "manage_bookings", "manage_payments",
        "manage_services", "manage_maintenance", "manage_cities",
        "view_analytics", "manage_settings"
      ],
    });

    // Seed CFO
    await seedAdminTeamMember({
      userId: "sameh",
      name: "Sameh Abulfadl",
      nameAr: "سامح أبو الفضل",
      email: "finance@monthlykey.com",
      role: "admin",
      permissions: [
        "manage_payments", "manage_bookings",
        "view_analytics", "manage_settings"
      ],
    });

  } catch (error) {
    console.error("[Seed] Error seeding admin user:", error);
  }
}

/**
 * Seed an admin team member if not already present.
 */
async function seedAdminTeamMember(data: {
  userId: string;
  name: string;
  nameAr: string;
  email: string;
  role: "admin";
  permissions: string[];
}) {
  try {
    const existing = await db.getUserByUserId(data.userId);
    if (existing) {
      console.log(`[Seed] Admin user '${data.userId}' already exists, skipping.`);
      // Ensure permissions exist
      const perms = await db.getAdminPermissions(existing.id);
      if (!perms) {
        await db.setAdminPermissions(existing.id, data.permissions, false);
        console.log(`[Seed] Permissions granted to '${data.userId}' (id: ${existing.id})`);
      }
      return;
    }

    // Also check by email
    const existingByEmail = await db.getUserByEmail(data.email);
    if (existingByEmail) {
      console.log(`[Seed] User with email '${data.email}' already exists, skipping.`);
      return;
    }

    const password = process.env[`${data.userId.toUpperCase()}_INITIAL_PASSWORD`] || crypto.randomBytes(12).toString('base64url');
    console.log(`[Seed] Generated password for '${data.userId}': ${password}`);

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    const id = await db.createLocalUser({
      userId: data.userId,
      passwordHash,
      displayName: data.name,
      name: data.name,
      nameAr: data.nameAr,
      email: data.email,
      role: data.role,
    });

    if (id) {
      await db.setAdminPermissions(id, data.permissions, false);
      console.log(`[Seed] Admin user '${data.userId}' created (id: ${id}) with ${data.permissions.length} permissions`);
    }
  } catch (error) {
    console.error(`[Seed] Error seeding admin '${data.userId}':`, error);
  }
}

async function ensureAdminPermissions() {
  try {
    const allPermissions = [
      "manage_users", "manage_properties", "manage_bookings", "manage_payments",
      "manage_services", "manage_maintenance", "manage_cms", "manage_cities",
      "manage_knowledge", "manage_roles", "manage_settings", "view_analytics",
      "send_notifications", "manage_ai"
    ];
    // Check specific known admin users
    const knownAdmins = ["Hobart", "admin"];
    for (const userId of knownAdmins) {
      const user = await db.getUserByUserId(userId);
      if (user && user.role === "admin") {
        const existing = await db.getAdminPermissions(user.id);
        if (!existing) {
          await db.setAdminPermissions(user.id, allPermissions, true);
          console.log(`[Seed] Root admin permissions granted to '${userId}' (id: ${user.id})`);
        }
      }
    }
  } catch (error) {
    console.error("[Seed] Error ensuring admin permissions:", error);
  }
}

async function seedDemoPropertyManager() {
  try {
    const existing = await db.getManagerByEmail("mohammed.alharbi@ijar.sa");
    if (existing) {
      console.log("[Seed] Demo property manager already exists, skipping.");
      return;
    }

    const editToken = nanoid(32);
    const id = await db.createPropertyManager({
      name: "Mohammed Al-Harbi",
      nameAr: "محمد الحربي",
      email: "mohammed.alharbi@ijar.sa",
      phone: "+966551234567",
      whatsapp: "+966551234567",
      title: "Senior Property Manager",
      titleAr: "مدير عقارات أول",
      bio: "Experienced property manager with over 8 years in the Saudi real estate market. Specialized in premium residential properties in Riyadh.",
      bioAr: "مدير عقارات ذو خبرة تتجاوز 8 سنوات في سوق العقارات السعودي. متخصص في العقارات السكنية المميزة في الرياض.",
      photoUrl: "/api/img-proxy?url=" + encodeURIComponent("https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80"),
      isActive: true,
      editToken,
    } as any);

    if (id) {
      console.log("[Seed] Demo property manager 'Mohammed Al-Harbi' created (id:", id, ")");
    }
  } catch (error) {
    console.error("[Seed] Error seeding demo property manager:", error);
  }
}
