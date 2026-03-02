/**
 * Audit Log Module
 * 
 * Records all create/update/archive/delete actions on buildings, units,
 * Beds24 mappings, ledger entries, and payment method settings.
 * 
 * Each entry captures: who, when, what changed, and from what IP.
 */
import { getPool } from "./db";

export type AuditAction = "CREATE" | "UPDATE" | "ARCHIVE" | "RESTORE" | "DELETE" | "LINK_BEDS24" | "UNLINK_BEDS24" | "SEND" | "PUBLISH" | "UNPUBLISH" | "CONVERT" | "TEST" | "ENABLE" | "DISABLE" | "APPROVE" | "REJECT" | "REVIEW";
export type AuditEntityType = "BUILDING" | "UNIT" | "BEDS24_MAP" | "LEDGER" | "EXTENSION" | "PAYMENT_METHOD" | "WHATSAPP_MESSAGE" | "WHATSAPP_TEMPLATE" | "PROPERTY" | "SUBMISSION" | "INTEGRATION" | "KYC_REQUEST" | "INTEGRATION_CREDENTIAL" | "FEATURE_FLAG" | "USER_VERIFICATION";

export interface AuditEntry {
  userId?: number;
  userName?: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: number;
  entityLabel?: string;
  changes?: Record<string, { old: unknown; new: unknown }>;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

/**
 * Write an audit log entry. Fire-and-forget — never throws.
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const pool = getPool();
    if (!pool) return;
    await pool.execute(
      `INSERT INTO audit_log (userId, userName, action, entityType, entityId, entityLabel, changes, metadata, ipAddress)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.userId ?? null,
        entry.userName ?? null,
        entry.action,
        entry.entityType,
        entry.entityId,
        entry.entityLabel ?? null,
        entry.changes ? JSON.stringify(entry.changes) : null,
        entry.metadata ? JSON.stringify(entry.metadata) : null,
        entry.ipAddress ?? null,
      ]
    );
  } catch (err) {
    // Audit logging should never break the main flow
    console.error("[audit-log] Failed to write audit entry:", err);
  }
}

/**
 * Query audit log entries with filters.
 */
export async function getAuditLog(filters?: {
  entityType?: AuditEntityType;
  entityId?: number;
  userId?: number;
  action?: AuditAction;
  limit?: number;
  offset?: number;
}) {
  const pool = getPool();
  if (!pool) return { items: [], total: 0 };

  const limit = filters?.limit || 50;
  const offset = filters?.offset || 0;
  let where = "1=1";
  const params: any[] = [];

  if (filters?.entityType) { where += " AND entityType = ?"; params.push(filters.entityType); }
  if (filters?.entityId) { where += " AND entityId = ?"; params.push(filters.entityId); }
  if (filters?.userId) { where += " AND userId = ?"; params.push(filters.userId); }
  if (filters?.action) { where += " AND action = ?"; params.push(filters.action); }

  const [countRows] = await pool.query<any[]>(`SELECT COUNT(*) as total FROM audit_log WHERE ${where}`, params);
  const total = countRows[0]?.total || 0;

  const [rows] = await pool.query<any[]>(
    `SELECT * FROM audit_log WHERE ${where} ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return { items: rows, total };
}

/**
 * Compute a diff between old and new objects for audit logging.
 */
export function computeChanges(
  oldObj: Record<string, unknown>,
  newObj: Record<string, unknown>,
  fields: string[]
): Record<string, { old: unknown; new: unknown }> | undefined {
  const changes: Record<string, { old: unknown; new: unknown }> = {};
  for (const field of fields) {
    const oldVal = oldObj[field];
    const newVal = newObj[field];
    if (newVal !== undefined && String(oldVal) !== String(newVal)) {
      changes[field] = { old: oldVal, new: newVal };
    }
  }
  return Object.keys(changes).length > 0 ? changes : undefined;
}
