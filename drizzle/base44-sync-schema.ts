import {
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

export const externalSyncMap = mysqlTable("external_sync_map", {
  id: int("id").autoincrement().primaryKey(),
  provider: mysqlEnum("provider", ["base44"]).notNull(),
  entityType: mysqlEnum("entityType", ["unit", "booking", "payment", "maintenance"]).notNull(),
  localId: int("localId").notNull(),
  externalId: varchar("externalId", { length: 255 }),
  syncDirection: mysqlEnum("syncDirection", ["push", "pull", "limited-bidirectional"]).default("push").notNull(),
  syncStatus: mysqlEnum("syncStatus", ["pending", "synced", "failed", "conflict"]).default("pending").notNull(),
  lastSyncedAt: timestamp("lastSyncedAt"),
  lastError: text("lastError"),
  payloadHash: varchar("payloadHash", { length: 64 }),
  metadata: json("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ExternalSyncMap = typeof externalSyncMap.$inferSelect;
export type InsertExternalSyncMap = typeof externalSyncMap.$inferInsert;
