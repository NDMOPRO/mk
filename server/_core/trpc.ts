import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { hasPermission, type PermissionKey } from "../permissions";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  // An unexpected error (database, network, bug) is wrapped by tRPC with its
  // original message, which can contain SQL or internal details. In
  // production clients get a generic message; the details stay in the logs.
  errorFormatter({ shape, error }) {
    if (
      process.env.NODE_ENV === "production" &&
      error.code === "INTERNAL_SERVER_ERROR" &&
      error.cause !== undefined &&
      !(error.cause instanceof TRPCError) &&
      // Refused uploads explain themselves (wrong file type).
      (error.cause as Error).name !== "UnsafeUploadError"
    ) {
      return { ...shape, message: "Internal server error" };
    }
    return shape;
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

/**
 * Create a permission-gated admin procedure.
 * Checks that user is admin AND has the required permission.
 * Root admins (isRootAdmin=true in DB) bypass permission checks.
 */
export function adminWithPermission(permission: PermissionKey) {
  return adminProcedure.use(
    t.middleware(async ({ ctx, next }) => {
      // adminProcedure has already rejected anonymous and non-admin users.
      const user = ctx.user;
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: NOT_ADMIN_ERR_MSG });
      const allowed = await hasPermission(user.id, permission);
      if (!allowed) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `ليس لديك صلاحية: ${permission}`,
        });
      }
      // Pass the non-null user on, so handlers can use ctx.user without `!`.
      return next({ ctx: { ...ctx, user } });
    }),
  );
}
