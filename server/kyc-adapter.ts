/**
 * KYC Adapter Module
 *
 * Defines the KYC provider interface and implements ManualReviewProvider.
 * ManualReviewProvider is the only active provider — it creates a KYC request
 * that an admin reviews manually in the admin panel.
 *
 * Future providers (e.g., Elm, Wathq, Sumsub) will implement the same interface.
 * Provider selection is controlled by a platform_settings flag.
 */

import { getPool } from "./db";
import { logAudit } from "./audit-log";

// ─── KYC Provider Interface ─────────────────────────────────────────
export interface KycSubmission {
  userId: number;
  level: "basic" | "enhanced";
  documents: Array<{
    documentType: string;
    storageKey: string;
    originalFilename?: string;
    mimeType?: string;
    fileSizeBytes?: number;
  }>;
  metadata?: Record<string, unknown>;
}

export interface KycResult {
  success: boolean;
  requestId?: number;
  status?: string;
  error?: string;
}

export interface KycProvider {
  name: string;
  submit(submission: KycSubmission): Promise<KycResult>;
  getStatus(requestId: number): Promise<{ status: string; details?: Record<string, unknown> }>;
}

// ─── Manual Review Provider ─────────────────────────────────────────
export class ManualReviewProvider implements KycProvider {
  name = "manual";

  async submit(submission: KycSubmission): Promise<KycResult> {
    const pool = getPool();
    if (!pool) return { success: false, error: "Database unavailable" };

    try {
      // Create KYC request
      const [result] = await pool.execute(
        `INSERT INTO kyc_requests (userId, status, level, provider, submittedAt)
         VALUES (?, 'submitted', ?, 'manual', NOW())`,
        [submission.userId, submission.level]
      ) as any;

      const requestId = result.insertId;

      // Insert documents
      for (const doc of submission.documents) {
        await pool.execute(
          `INSERT INTO kyc_documents (kycRequestId, userId, documentType, storageKey, originalFilename, mimeType, fileSizeBytes)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [requestId, submission.userId, doc.documentType, doc.storageKey, doc.originalFilename || null, doc.mimeType || null, doc.fileSizeBytes || null]
        );
      }

      // Update user kycStatus to 'submitted'
      await pool.execute(
        `UPDATE users SET kycStatus = 'submitted', kycProvider = 'manual', kycProviderRef = ? WHERE id = ?`,
        [String(requestId), submission.userId]
      );

      return { success: true, requestId, status: "submitted" };
    } catch (err) {
      console.error("[KYC-Manual] Submit failed:", err);
      return { success: false, error: "Failed to create KYC request" };
    }
  }

  async getStatus(requestId: number): Promise<{ status: string; details?: Record<string, unknown> }> {
    const pool = getPool();
    if (!pool) return { status: "unknown" };

    const [rows] = await pool.query<any[]>(
      "SELECT status, reviewedAt, reviewerName, rejectionReason FROM kyc_requests WHERE id = ? LIMIT 1",
      [requestId]
    );

    if (rows.length === 0) return { status: "not_found" };

    return {
      status: rows[0].status,
      details: {
        reviewedAt: rows[0].reviewedAt,
        reviewerName: rows[0].reviewerName,
        rejectionReason: rows[0].rejectionReason,
      },
    };
  }
}

// ─── Admin Review Actions ───────────────────────────────────────────

/**
 * Admin approves a KYC request.
 * Updates both kyc_requests and users tables.
 */
export async function approveKycRequest(params: {
  requestId: number;
  reviewerId: number;
  reviewerName: string;
  notes?: string;
  ipAddress?: string;
}): Promise<{ success: boolean; error?: string }> {
  const pool = getPool();
  if (!pool) return { success: false, error: "Database unavailable" };

  try {
    // Get the request
    const [rows] = await pool.query<any[]>(
      "SELECT userId, status FROM kyc_requests WHERE id = ? LIMIT 1",
      [params.requestId]
    );
    if (rows.length === 0) return { success: false, error: "KYC request not found" };
    if (rows[0].status === "verified") return { success: false, error: "Already verified" };

    const userId = rows[0].userId;

    // Update kyc_requests
    await pool.execute(
      `UPDATE kyc_requests SET status = 'verified', reviewedAt = NOW(), reviewedBy = ?, reviewerName = ?, notes = ?
       WHERE id = ?`,
      [params.reviewerId, params.reviewerName, params.notes || null, params.requestId]
    );

    // Update user
    await pool.execute(
      `UPDATE users SET kycStatus = 'verified', kycVerifiedAt = NOW(), kycLevel = 'basic' WHERE id = ?`,
      [userId]
    );

    // Audit log
    await logAudit({
      userId: params.reviewerId,
      userName: params.reviewerName,
      action: "APPROVE",
      entityType: "KYC_REQUEST",
      entityId: params.requestId,
      entityLabel: `User ${userId}`,
      metadata: { notes: params.notes },
      ipAddress: params.ipAddress,
    });

    return { success: true };
  } catch (err) {
    console.error("[KYC-Admin] Approve failed:", err);
    return { success: false, error: "Failed to approve KYC request" };
  }
}

/**
 * Admin rejects a KYC request.
 */
export async function rejectKycRequest(params: {
  requestId: number;
  reviewerId: number;
  reviewerName: string;
  reason: string;
  reasonCode?: string;
  ipAddress?: string;
}): Promise<{ success: boolean; error?: string }> {
  const pool = getPool();
  if (!pool) return { success: false, error: "Database unavailable" };

  try {
    const [rows] = await pool.query<any[]>(
      "SELECT userId, status FROM kyc_requests WHERE id = ? LIMIT 1",
      [params.requestId]
    );
    if (rows.length === 0) return { success: false, error: "KYC request not found" };

    const userId = rows[0].userId;

    // Update kyc_requests
    await pool.execute(
      `UPDATE kyc_requests SET status = 'rejected', reviewedAt = NOW(), reviewedBy = ?, reviewerName = ?,
       rejectionReason = ?, rejectionReasonCode = ?
       WHERE id = ?`,
      [params.reviewerId, params.reviewerName, params.reason, params.reasonCode || null, params.requestId]
    );

    // Update user
    await pool.execute(
      `UPDATE users SET kycStatus = 'rejected', kycRejectionReason = ? WHERE id = ?`,
      [params.reason, userId]
    );

    // Audit log
    await logAudit({
      userId: params.reviewerId,
      userName: params.reviewerName,
      action: "REJECT",
      entityType: "KYC_REQUEST",
      entityId: params.requestId,
      entityLabel: `User ${userId}`,
      metadata: { reason: params.reason, reasonCode: params.reasonCode },
      ipAddress: params.ipAddress,
    });

    return { success: true };
  } catch (err) {
    console.error("[KYC-Admin] Reject failed:", err);
    return { success: false, error: "Failed to reject KYC request" };
  }
}

/**
 * Get all KYC requests for admin review.
 */
export async function getKycRequests(filters?: {
  status?: string;
  userId?: number;
  limit?: number;
  offset?: number;
}): Promise<{ items: any[]; total: number }> {
  const pool = getPool();
  if (!pool) return { items: [], total: 0 };

  const limit = filters?.limit || 50;
  const offset = filters?.offset || 0;
  let where = "1=1";
  const params: any[] = [];

  if (filters?.status) { where += " AND kr.status = ?"; params.push(filters.status); }
  if (filters?.userId) { where += " AND kr.userId = ?"; params.push(filters.userId); }

  const [countRows] = await pool.query<any[]>(
    `SELECT COUNT(*) as total FROM kyc_requests kr WHERE ${where}`,
    params
  );
  const total = countRows[0]?.total || 0;

  const [rows] = await pool.query<any[]>(
    `SELECT kr.*, u.displayName, u.name, u.email, u.phone, u.nationalId
     FROM kyc_requests kr
     LEFT JOIN users u ON u.id = kr.userId
     WHERE ${where}
     ORDER BY kr.createdAt DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return { items: rows, total };
}

/**
 * Get KYC documents for a specific request.
 */
export async function getKycDocuments(requestId: number): Promise<any[]> {
  const pool = getPool();
  if (!pool) return [];

  const [rows] = await pool.query<any[]>(
    "SELECT * FROM kyc_documents WHERE kycRequestId = ? ORDER BY uploadedAt",
    [requestId]
  );

  return rows;
}

// ─── Provider Factory ───────────────────────────────────────────────
export function getKycProvider(): KycProvider {
  // Only ManualReviewProvider is available now.
  // Future: read from platform_settings to select provider.
  return new ManualReviewProvider();
}
