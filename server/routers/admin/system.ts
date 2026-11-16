import {
  TRPCError,
  z,
  adminWithPermission,
  PERMISSIONS,
  db,
  logAudit,
  ENV,
  dbIdentity,
} from "../_shared";

// admin.* procedures: Database status, dashboard stats, analytics and test-data purge.
export const adminSystemProcedures = {
  // ─── DB Status (RBAC: MANAGE_SETTINGS) ────────────────────────────
  dbStatus: adminWithPermission(PERMISSIONS.MANAGE_SETTINGS).query(async () => {
    const pool = db.getPool();
    let dbConnected = false;
    let dbVersion = "unknown";
    let tableCount = 0;
    let migrationVersion = "unknown";
    let migrationEntries: Array<{ hash: string; created_at: number }> = [];
    let uptime = 0;

    if (pool) {
      try {
        // Test connection
        await pool.execute("SELECT 1");
        dbConnected = true;

        // Get MySQL version
        const [versionRows] = await pool.execute("SELECT VERSION() as v") as any;
        dbVersion = versionRows?.[0]?.v ?? "unknown";

        // Count tables in current database
        const [tableRows] = await pool.execute(
          "SELECT COUNT(*) as cnt FROM information_schema.tables WHERE table_schema = DATABASE()"
        ) as any;
        tableCount = tableRows?.[0]?.cnt ?? 0;

        // Get migration journal from __drizzle_migrations table
        try {
          const [migRows] = await pool.execute(
            "SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 5"
          ) as any;
          migrationEntries = migRows ?? [];
          if (migRows?.length > 0) {
            migrationVersion = `${migRows.length > 0 ? migRows[0].hash?.slice(0, 12) : 'none'} (${migRows.length} of total)`;
          }
        } catch {
          migrationVersion = "migrations table not found";
        }

        // Get total migration count
        try {
          const [countRows] = await pool.execute(
            "SELECT COUNT(*) as cnt FROM __drizzle_migrations"
          ) as any;
          const totalMigrations = countRows?.[0]?.cnt ?? 0;
          migrationVersion = `${totalMigrations} migrations applied`;
        } catch {}

        // Server uptime
        const [uptimeRows] = await pool.execute("SHOW STATUS LIKE 'Uptime'") as any;
        uptime = parseInt(uptimeRows?.[0]?.Value ?? "0");
      } catch (e: any) {
        console.error("[Admin] DB status check failed:", e.message);
      }
    }

    return {
      connected: dbConnected,
      environment: ENV.appEnvironment,
      isPreviewDeploy: ENV.isPreviewDeploy,
      host: dbIdentity.host,
      port: dbIdentity.port,
      database: dbIdentity.database,
      mysqlVersion: dbVersion,
      tableCount,
      migrationVersion,
      recentMigrations: migrationEntries.map(m => ({
        hash: m.hash?.slice(0, 16) ?? "unknown",
        appliedAt: m.created_at ? new Date(m.created_at).toISOString() : "unknown",
      })),
      serverUptimeSeconds: uptime,
      checkedAt: new Date().toISOString(),
      // Debug: check actual table columns
      tableColumns: await (async () => {
        try {
          const [cols] = await pool!.execute(
            "SELECT COLUMN_NAME, DATA_TYPE FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'property_submissions' ORDER BY ORDINAL_POSITION"
          ) as any;
          return cols.map((c: any) => `${c.COLUMN_NAME}:${c.DATA_TYPE}`);
        } catch { return []; }
      })(),
      drizzleMigrations: await (async () => {
        try {
          const [rows] = await pool!.execute(
            "SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at ASC"
          ) as any;
          return rows.map((r: any) => r.hash);
        } catch { return []; }
      })(),
    };
  }),

  stats: adminWithPermission(PERMISSIONS.VIEW_ANALYTICS).query(async () => {
    const [userCount, propertyCount, activeProperties, pendingProperties, publishedProperties, bookingCount, activeBookings, approvedBookings, pendingBookings, totalRevenue, occupancy] = await Promise.all([
      db.getUserCount(),
      db.getPropertyCount(),
      db.getPropertyCount("active"),
      db.getPropertyCount("pending"),
      db.getPropertyCount("published"),
      db.getBookingCount(),
      db.getBookingCount("active"),
      db.getBookingCount("approved"),
      db.getBookingCount("pending"),
      db.getTotalRevenue(),
      db.getOccupancyRate(),
    ]);
    return {
      userCount, propertyCount, activeProperties, pendingProperties, publishedProperties,
      bookingCount, activeBookings, approvedBookings, pendingBookings,
      totalRevenue,
      occupancyRate: occupancy.occupancyRate,
      bookedDays: occupancy.bookedDays,
      totalPropertyDays: occupancy.totalPropertyDays,
    };
   }),
  backfillAvailabilityBlocks: adminWithPermission(PERMISSIONS.VIEW_ANALYTICS).mutation(async () => {
    const { backfillFromBookings } = await import('../../availability-blocks.js');
    const count = await backfillFromBookings();
    return { success: true, blocksCreated: count };
  }),

  storageInfo: adminWithPermission(PERMISSIONS.MANAGE_SETTINGS)
    .query(async () => {
      const { getStorageInfo } = await import('../../storage');
      return getStorageInfo();
    }),

  analytics: adminWithPermission(PERMISSIONS.VIEW_ANALYTICS)
    .input(z.object({ months: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const months = input?.months ?? 12;
      // Import source breakdown (best-effort)
      let bookingSourceBreakdown = { local: 0, beds24: 0, ical: 0, total: 0 };
      try {
        const { getBookingSourceBreakdown } = await import('../../beds24-sync.js');
        bookingSourceBreakdown = await getBookingSourceBreakdown(months * 30);
      } catch { /* beds24-sync not available */ }
      const [
        bookingsByMonth, revenueByMonth, userRegistrations,
        propertiesByType, propertiesByCity, bookingStatusDist,
        revenueByMethod, topProperties, serviceRequests,
        maintenanceSummary, occupancy, recentActivity
      ] = await Promise.all([
        db.getBookingsByMonth(months),
        db.getRevenueByMonth(months),
        db.getUserRegistrationsByMonth(months),
        db.getPropertiesByType(),
        db.getPropertiesByCity(),
        db.getBookingStatusDistribution(),
        db.getRevenueByPaymentMethod(),
        db.getTopProperties(10),
        db.getServiceRequestsSummary(),
        db.getMaintenanceSummary(),
        db.getOccupancyRate(),
        db.getRecentActivity(20),
      ]);
      return {
        bookingsByMonth, revenueByMonth, userRegistrations,
        propertiesByType, propertiesByCity, bookingStatusDist,
        revenueByMethod, topProperties, serviceRequests,
        maintenanceSummary, occupancy, recentActivity,
        bookingSourceBreakdown,
      };
    }),

  // ─── Purge Test / Transactional Data (ROOT ADMIN ONLY) ─────────────
  purgeTestData: adminWithPermission(PERMISSIONS.MANAGE_SETTINGS)
    .input(z.object({
      confirmPhrase: z.string(),
      categories: z.array(z.enum([
        'financial',    // payments, payment_ledger
        'bookings',     // bookings, booking_extensions
        'maintenance',  // maintenanceRequests, maintenance_updates, emergency_maintenance
        'messages',     // conversations, messages, whatsapp_messages
        'reviews',      // reviews
        'notifications',// notifications
        'activities',   // userActivities, audit_log
        'shomoos',      // shomoos_submissions
        'otp',          // otp_codes
        'all',          // everything above
      ])).min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      // STRICT: Root admin only
      const perms = await db.getAdminPermissions(ctx.user!.id);
      if (!perms?.isRootAdmin) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'فقط المسؤول الرئيسي (Root Admin) يمكنه مسح البيانات' });
      }

      // Safety: require exact confirmation phrase
      if (input.confirmPhrase !== 'أؤكد مسح البيانات التجريبية') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'عبارة التأكيد غير صحيحة. اكتب: أؤكد مسح البيانات التجريبية' });
      }

      const pool = db.getPool();
      if (!pool) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

      const cats = new Set(input.categories);
      const isAll = cats.has('all');
      const results: Record<string, number> = {};

      // Helper to delete and track count
      async function purgeTable(tableName: string) {
        try {
          const [countResult] = await pool!.execute(`SELECT COUNT(*) as cnt FROM \`${tableName}\``) as any;
          const count = countResult?.[0]?.cnt ?? 0;
          if (count > 0) {
            await pool!.execute(`DELETE FROM \`${tableName}\``);
          }
          results[tableName] = count;
        } catch (e: any) {
          // Table might not exist, skip silently
          results[tableName] = -1; // -1 means table not found
        }
      }

      // Disable FK checks temporarily for safe deletion order
      await pool.execute('SET FOREIGN_KEY_CHECKS = 0');

      try {
        if (isAll || cats.has('financial')) {
          await purgeTable('payment_ledger');
          await purgeTable('payments');
          await purgeTable('payment_method_settings');
        }

        if (isAll || cats.has('bookings')) {
          await purgeTable('booking_extensions');
          await purgeTable('bookings');
        }

        if (isAll || cats.has('maintenance')) {
          await purgeTable('maintenance_updates');
          await purgeTable('emergency_maintenance');
          await purgeTable('maintenanceRequests');
        }

        if (isAll || cats.has('messages')) {
          await purgeTable('whatsapp_messages');
          await purgeTable('messages');
          await purgeTable('conversations');
        }

        if (isAll || cats.has('reviews')) {
          await purgeTable('reviews');
        }

        if (isAll || cats.has('notifications')) {
          await purgeTable('notifications');
          await purgeTable('push_subscriptions');
        }

        if (isAll || cats.has('activities')) {
          await purgeTable('userActivities');
          await purgeTable('audit_log');
        }

        if (isAll || cats.has('shomoos')) {
          await purgeTable('shomoos_submissions');
        }

        if (isAll || cats.has('otp')) {
          await purgeTable('otp_codes');
        }
      } finally {
        await pool.execute('SET FOREIGN_KEY_CHECKS = 1');
      }

      // Log this action (after re-enabling FK checks)
      try {
        await logAudit({
          action: 'PURGE_TEST_DATA',
          entityType: 'SYSTEM',
          entityId: 0,
          userId: ctx.user.id,
          userName: ctx.user.displayName ?? 'admin',
          metadata: { categories: input.categories, results },
        });
      } catch {}

      return {
        success: true,
        purged: results,
        message: 'تم مسح البيانات التجريبية بنجاح',
      };
    }),
};
