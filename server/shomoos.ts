/**
 * Shomoos (شموس) Integration Service
 *
 * National Tourism Information Network — Ministry of Interior, KSA
 * https://shomoos.gov.sa/Portal/
 *
 * This module handles:
 *  1. Guest/Tenant check-in registration with Shomoos
 *  2. Guest/Tenant check-out notification
 *  3. Companion/dependent registration
 *  4. Submission logging to shomoos_submissions table
 *
 * CONFIGURATION:
 *  Credentials are stored encrypted in integration_configs table
 *  under integrationKey = "shomoos". Required fields:
 *    - baseUrl:       Shomoos API base URL (provided after facility registration)
 *    - apiKey:        API key / token from Shomoos Tech portal
 *    - facilityId:    Facility ID registered in Shomoos
 *    - facilityLicense: Facility license number
 *    - commercialReg:  Commercial registration number (السجل التجاري)
 *    - moiNumber:      Ministry of Interior number (optional, for large companies)
 *
 * ACTIVATION:
 *  Once the admin provides credentials via the Integration Settings panel,
 *  set isEnabled = true. The service will then auto-submit on booking check-in.
 */

import { getPool } from "./db";
import { logAudit, type AuditAction, type AuditEntityType } from "./audit-log";

// ─── Types ──────────────────────────────────────────────────────────

export interface ShomoosConfig {
  baseUrl: string;
  apiKey: string;
  facilityId: string;
  facilityLicense: string;
  commercialReg: string;
  moiNumber?: string;
}

export type ShomoosIdType = "national_id" | "iqama" | "passport";

export interface ShomoosGuestData {
  /** Full name in Arabic */
  nameAr: string;
  /** Full name in English */
  nameEn: string;
  /** Identity document type */
  idType: ShomoosIdType;
  /** Identity document number */
  idNumber: string;
  /** Nationality (English) */
  nationality: string;
  /** Nationality (Arabic) */
  nationalityAr?: string;
  /** Date of birth (YYYY-MM-DD) */
  dateOfBirth: string;
  /** Gender: M or F */
  gender: string;
  /** Phone number with country code */
  phone: string;
  /** Check-in date (YYYY-MM-DD) */
  checkInDate: string;
  /** Expected check-out date (YYYY-MM-DD) */
  checkOutDate: string;
  /** Room or unit number/identifier */
  unitNumber: string;
  /** Property/building name */
  propertyName?: string;
}

export interface ShomoosCompanionData {
  /** Full name in Arabic */
  nameAr: string;
  /** Full name in English */
  nameEn: string;
  /** Identity document type */
  idType: ShomoosIdType;
  /** Identity document number */
  idNumber: string;
  /** Nationality */
  nationality: string;
  /** Date of birth (YYYY-MM-DD) */
  dateOfBirth: string;
  /** Gender: M or F */
  gender: string;
  /** Relationship to primary guest */
  relationship: string;
}

export interface ShomoosCheckOutData {
  /** The Shomoos reference ID returned at check-in */
  shomoosRefId: string;
  /** Actual check-out date (YYYY-MM-DD) */
  checkOutDate: string;
}

export type ShomoosSubmissionType = "check_in" | "check_out" | "companion" | "update";
export type ShomoosSubmissionStatus = "pending" | "submitted" | "accepted" | "rejected" | "failed";

export interface ShomoosSubmission {
  id: number;
  bookingId: number | null;
  tenantId: number | null;
  propertyId: number | null;
  submissionType: ShomoosSubmissionType;
  status: ShomoosSubmissionStatus;
  shomoosRefId: string | null;
  requestPayload: string;
  responsePayload: string | null;
  errorMessage: string | null;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// ─── API Response Types ─────────────────────────────────────────────

interface ShomoosApiResponse {
  success: boolean;
  referenceId?: string;
  message?: string;
  errorCode?: string;
  errors?: Array<{ field: string; message: string }>;
}

// ─── Database Operations ────────────────────────────────────────────

// shomoos_submissions is created by migration 0027 (drizzle/).

/**
 * Log a Shomoos submission to the database.
 */
async function logSubmission(params: {
  bookingId?: number | null;
  tenantId?: number | null;
  propertyId?: number | null;
  submissionType: ShomoosSubmissionType;
  status: ShomoosSubmissionStatus;
  shomoosRefId?: string | null;
  requestPayload: any;
  responsePayload?: any;
  errorMessage?: string | null;
  submittedBy?: number | null;
  submittedByName?: string | null;
}): Promise<number | null> {
  const pool = getPool();
  if (!pool) return null;

  try {
    const [result] = await pool.execute(
      `INSERT INTO shomoos_submissions
        (bookingId, tenantId, propertyId, submissionType, status, shomoosRefId,
         requestPayload, responsePayload, errorMessage, submittedBy, submittedByName)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        params.bookingId ?? null,
        params.tenantId ?? null,
        params.propertyId ?? null,
        params.submissionType,
        params.status,
        params.shomoosRefId ?? null,
        JSON.stringify(params.requestPayload),
        params.responsePayload ? JSON.stringify(params.responsePayload) : null,
        params.errorMessage ?? null,
        params.submittedBy ?? null,
        params.submittedByName ?? null,
      ]
    );
    return (result as any).insertId ?? null;
  } catch (err) {
    console.error("[Shomoos] Failed to log submission:", err);
    return null;
  }
}

/**
 * Update submission status after API response.
 */
async function updateSubmission(id: number, update: {
  status: ShomoosSubmissionStatus;
  shomoosRefId?: string | null;
  responsePayload?: any;
  errorMessage?: string | null;
}): Promise<void> {
  const pool = getPool();
  if (!pool) return;

  try {
    await pool.execute(
      `UPDATE shomoos_submissions
       SET status = ?, shomoosRefId = ?, responsePayload = ?, errorMessage = ?, retryCount = retryCount + 1
       WHERE id = ?`,
      [
        update.status,
        update.shomoosRefId ?? null,
        update.responsePayload ? JSON.stringify(update.responsePayload) : null,
        update.errorMessage ?? null,
        id,
      ]
    );
  } catch (err) {
    console.error("[Shomoos] Failed to update submission:", err);
  }
}

// ─── Configuration ──────────────────────────────────────────────────

/**
 * Get Shomoos config from integration_configs table.
 * Returns null if not configured or disabled.
 */
export async function getShomoosConfig(): Promise<ShomoosConfig | null> {
  const pool = getPool();
  if (!pool) return null;

  try {
    const [rows] = await pool.query<any[]>(
      "SELECT configJson, isEnabled FROM integration_configs WHERE integrationKey = 'shomoos' LIMIT 1"
    );
    if (rows.length === 0 || !rows[0].isEnabled) return null;
    if (!rows[0].configJson) return null;

    const config = JSON.parse(rows[0].configJson);
    if (!config.baseUrl || !config.apiKey || !config.facilityId) return null;

    return {
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      facilityId: config.facilityId,
      facilityLicense: config.facilityLicense || "",
      commercialReg: config.commercialReg || "",
      moiNumber: config.moiNumber || undefined,
    };
  } catch (err) {
    console.error("[Shomoos] Failed to get config:", err);
    return null;
  }
}

/**
 * Check if Shomoos integration is enabled and configured.
 */
export async function isShomoosEnabled(): Promise<boolean> {
  const config = await getShomoosConfig();
  return config !== null;
}

// ─── API Client ─────────────────────────────────────────────────────

/**
 * Make authenticated request to Shomoos API.
 */
async function shomoosRequest(
  config: ShomoosConfig,
  method: "GET" | "POST" | "PUT" | "DELETE",
  endpoint: string,
  body?: any
): Promise<ShomoosApiResponse> {
  const url = `${config.baseUrl.replace(/\/$/, "")}/${endpoint.replace(/^\//, "")}`;

  try {
    const resp = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiKey}`,
        "X-Facility-Id": config.facilityId,
        "Accept": "application/json",
        "Accept-Language": "ar",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30000),
    });

    const data = await resp.json().catch(() => ({}));

    if (resp.ok) {
      return {
        success: true,
        referenceId: data.referenceId || data.refId || data.id || undefined,
        message: data.message || "Success",
      };
    } else {
      return {
        success: false,
        errorCode: data.errorCode || `HTTP_${resp.status}`,
        message: data.message || `Shomoos API returned ${resp.status}: ${resp.statusText}`,
        errors: data.errors || undefined,
      };
    }
  } catch (err: any) {
    return {
      success: false,
      errorCode: "CONNECTION_ERROR",
      message: `Failed to connect to Shomoos API: ${err.message}`,
    };
  }
}

// ─── Core Operations ────────────────────────────────────────────────

/**
 * Register guest check-in with Shomoos.
 *
 * This sends the guest/tenant data to Shomoos when they check in to a property.
 * Called automatically on booking activation or manually from admin panel.
 */
export async function submitCheckIn(params: {
  guest: ShomoosGuestData;
  bookingId?: number;
  tenantId?: number;
  propertyId?: number;
  submittedBy?: number;
  submittedByName?: string;
}): Promise<{ success: boolean; submissionId: number | null; shomoosRefId?: string; error?: string }> {
  const config = await getShomoosConfig();
  if (!config) {
    return { success: false, submissionId: null, error: "Shomoos integration not configured or disabled" };
  }

  // Map ID type to Shomoos format
  const idTypeMap: Record<ShomoosIdType, string> = {
    national_id: "1", // Saudi National ID
    iqama: "2",       // Iqama (Resident Permit)
    passport: "3",    // Passport
  };

  const payload = {
    facilityId: config.facilityId,
    facilityLicense: config.facilityLicense,
    commercialRegistration: config.commercialReg,
    guest: {
      fullNameAr: params.guest.nameAr,
      fullNameEn: params.guest.nameEn,
      identityType: idTypeMap[params.guest.idType] || "3",
      identityNumber: params.guest.idNumber,
      nationality: params.guest.nationality,
      nationalityAr: params.guest.nationalityAr || params.guest.nationality,
      dateOfBirth: params.guest.dateOfBirth,
      gender: params.guest.gender,
      phoneNumber: params.guest.phone,
    },
    stay: {
      checkInDate: params.guest.checkInDate,
      checkOutDate: params.guest.checkOutDate,
      unitNumber: params.guest.unitNumber,
      propertyName: params.guest.propertyName || "",
    },
  };

  // Log submission as pending
  const submissionId = await logSubmission({
    bookingId: params.bookingId,
    tenantId: params.tenantId,
    propertyId: params.propertyId,
    submissionType: "check_in",
    status: "pending",
    requestPayload: payload,
    submittedBy: params.submittedBy,
    submittedByName: params.submittedByName,
  });

  // Send to Shomoos API
  const response = await shomoosRequest(config, "POST", "/api/v1/guests/checkin", payload);

  // Update submission with response
  if (submissionId) {
    await updateSubmission(submissionId, {
      status: response.success ? "submitted" : "failed",
      shomoosRefId: response.referenceId || null,
      responsePayload: response,
      errorMessage: response.success ? null : response.message,
    });
  }

  // Audit log
  try {
    await logAudit({
      userId: params.submittedBy || 0,
      userName: params.submittedByName || "system",
      action: "CREATE" as AuditAction,
      entityType: "SHOMOOS_SUBMISSION" as AuditEntityType,
      entityId: submissionId || 0,
      entityLabel: `Check-in: ${params.guest.nameEn} (${params.guest.idNumber})`,
      metadata: {
        bookingId: params.bookingId,
        success: response.success,
        shomoosRefId: response.referenceId,
      },
    });
  } catch {
    // Non-critical
  }

  return {
    success: response.success,
    submissionId,
    shomoosRefId: response.referenceId,
    error: response.success ? undefined : response.message,
  };
}

/**
 * Register guest check-out with Shomoos.
 */
export async function submitCheckOut(params: {
  shomoosRefId: string;
  checkOutDate: string;
  bookingId?: number;
  tenantId?: number;
  propertyId?: number;
  submittedBy?: number;
  submittedByName?: string;
}): Promise<{ success: boolean; submissionId: number | null; error?: string }> {
  const config = await getShomoosConfig();
  if (!config) {
    return { success: false, submissionId: null, error: "Shomoos integration not configured or disabled" };
  }

  const payload = {
    facilityId: config.facilityId,
    referenceId: params.shomoosRefId,
    checkOutDate: params.checkOutDate,
  };

  const submissionId = await logSubmission({
    bookingId: params.bookingId,
    tenantId: params.tenantId,
    propertyId: params.propertyId,
    submissionType: "check_out",
    status: "pending",
    shomoosRefId: params.shomoosRefId,
    requestPayload: payload,
    submittedBy: params.submittedBy,
    submittedByName: params.submittedByName,
  });

  const response = await shomoosRequest(config, "POST", "/api/v1/guests/checkout", payload);

  if (submissionId) {
    await updateSubmission(submissionId, {
      status: response.success ? "submitted" : "failed",
      responsePayload: response,
      errorMessage: response.success ? null : response.message,
    });
  }

  try {
    await logAudit({
      userId: params.submittedBy || 0,
      userName: params.submittedByName || "system",
      action: "UPDATE" as AuditAction,
      entityType: "SHOMOOS_SUBMISSION" as AuditEntityType,
      entityId: submissionId || 0,
      entityLabel: `Check-out: ref=${params.shomoosRefId}`,
      metadata: { bookingId: params.bookingId, success: response.success },
    });
  } catch {
    // Non-critical
  }

  return {
    success: response.success,
    submissionId,
    error: response.success ? undefined : response.message,
  };
}

/**
 * Register companion/dependent with Shomoos.
 */
export async function submitCompanion(params: {
  primaryRefId: string;
  companion: ShomoosCompanionData;
  bookingId?: number;
  tenantId?: number;
  propertyId?: number;
  submittedBy?: number;
  submittedByName?: string;
}): Promise<{ success: boolean; submissionId: number | null; error?: string }> {
  const config = await getShomoosConfig();
  if (!config) {
    return { success: false, submissionId: null, error: "Shomoos integration not configured or disabled" };
  }

  const idTypeMap: Record<ShomoosIdType, string> = {
    national_id: "1",
    iqama: "2",
    passport: "3",
  };

  const payload = {
    facilityId: config.facilityId,
    primaryGuestRefId: params.primaryRefId,
    companion: {
      fullNameAr: params.companion.nameAr,
      fullNameEn: params.companion.nameEn,
      identityType: idTypeMap[params.companion.idType] || "3",
      identityNumber: params.companion.idNumber,
      nationality: params.companion.nationality,
      dateOfBirth: params.companion.dateOfBirth,
      gender: params.companion.gender,
      relationship: params.companion.relationship,
    },
  };

  const submissionId = await logSubmission({
    bookingId: params.bookingId,
    tenantId: params.tenantId,
    propertyId: params.propertyId,
    submissionType: "companion",
    status: "pending",
    shomoosRefId: params.primaryRefId,
    requestPayload: payload,
    submittedBy: params.submittedBy,
    submittedByName: params.submittedByName,
  });

  const response = await shomoosRequest(config, "POST", "/api/v1/guests/companion", payload);

  if (submissionId) {
    await updateSubmission(submissionId, {
      status: response.success ? "submitted" : "failed",
      responsePayload: response,
      errorMessage: response.success ? null : response.message,
    });
  }

  return {
    success: response.success,
    submissionId,
    error: response.success ? undefined : response.message,
  };
}

// ─── Query Operations ───────────────────────────────────────────────

/**
 * Get all Shomoos submissions with optional filters.
 */
export async function getSubmissions(params?: {
  bookingId?: number;
  tenantId?: number;
  propertyId?: number;
  status?: ShomoosSubmissionStatus;
  submissionType?: ShomoosSubmissionType;
  limit?: number;
  offset?: number;
}): Promise<any[]> {
  const pool = getPool();
  if (!pool) return [];

  let query = "SELECT * FROM shomoos_submissions WHERE 1=1";
  const values: any[] = [];

  if (params?.bookingId) {
    query += " AND bookingId = ?";
    values.push(params.bookingId);
  }
  if (params?.tenantId) {
    query += " AND tenantId = ?";
    values.push(params.tenantId);
  }
  if (params?.propertyId) {
    query += " AND propertyId = ?";
    values.push(params.propertyId);
  }
  if (params?.status) {
    query += " AND status = ?";
    values.push(params.status);
  }
  if (params?.submissionType) {
    query += " AND submissionType = ?";
    values.push(params.submissionType);
  }

  query += " ORDER BY createdAt DESC";
  const limit = Math.min(Math.max(Math.trunc(Number(params?.limit) || 50), 1), 500);
  const offset = Math.max(Math.trunc(Number(params?.offset) || 0), 0);
  query += ` LIMIT ${limit} OFFSET ${offset}`;

  try {
    const [rows] = await pool.query<any[]>(query, values);
    return rows;
  } catch (err) {
    console.error("[Shomoos] Failed to get submissions:", err);
    return [];
  }
}

/**
 * Get submission count by status (for dashboard stats).
 */
export async function getSubmissionStats(): Promise<Record<string, number>> {
  const pool = getPool();
  if (!pool) return {};

  try {
    const [rows] = await pool.query<any[]>(
      "SELECT status, COUNT(*) as count FROM shomoos_submissions GROUP BY status"
    );
    const stats: Record<string, number> = {};
    for (const row of rows) {
      stats[row.status] = row.count;
    }
    return stats;
  } catch {
    return {};
  }
}

/**
 * Retry a failed submission.
 */
export async function retrySubmission(submissionId: number, submittedBy: number, submittedByName: string): Promise<{ success: boolean; error?: string }> {
  const pool = getPool();
  if (!pool) return { success: false, error: "Database unavailable" };

  try {
    const [rows] = await pool.query<any[]>(
      "SELECT * FROM shomoos_submissions WHERE id = ? LIMIT 1",
      [submissionId]
    );
    if (rows.length === 0) return { success: false, error: "Submission not found" };

    const submission = rows[0];
    if (submission.status !== "failed") {
      return { success: false, error: "Only failed submissions can be retried" };
    }

    const payload = typeof submission.requestPayload === "string"
      ? JSON.parse(submission.requestPayload)
      : submission.requestPayload;

    const config = await getShomoosConfig();
    if (!config) return { success: false, error: "Shomoos not configured" };

    let endpoint = "/api/v1/guests/checkin";
    if (submission.submissionType === "check_out") endpoint = "/api/v1/guests/checkout";
    if (submission.submissionType === "companion") endpoint = "/api/v1/guests/companion";

    const response = await shomoosRequest(config, "POST", endpoint, payload);

    await updateSubmission(submissionId, {
      status: response.success ? "submitted" : "failed",
      shomoosRefId: response.referenceId || submission.shomoosRefId,
      responsePayload: response,
      errorMessage: response.success ? null : response.message,
    });

    await logAudit({
      userId: submittedBy,
      userName: submittedByName,
      action: "UPDATE" as AuditAction,
      entityType: "SHOMOOS_SUBMISSION" as AuditEntityType,
      entityId: submissionId,
      entityLabel: `Retry ${submission.submissionType}`,
      metadata: { success: response.success },
    });

    return { success: response.success, error: response.success ? undefined : response.message };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Test Shomoos API connectivity.
 * Used by the integration test button in admin panel.
 */
export async function testConnection(): Promise<{ success: boolean; message: string }> {
  const config = await getShomoosConfig();
  if (!config) {
    return { success: false, message: "Shomoos not configured. Please add API credentials in Integration Settings." };
  }

  try {
    const url = `${config.baseUrl.replace(/\/$/, "")}/api/v1/health`;
    const resp = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${config.apiKey}`,
        "X-Facility-Id": config.facilityId,
        "Accept": "application/json",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (resp.ok) {
      return { success: true, message: `Connected to Shomoos API. Facility: ${config.facilityId}` };
    } else {
      return { success: false, message: `Shomoos API returned ${resp.status}: ${resp.statusText}` };
    }
  } catch (err: any) {
    return { success: false, message: `Connection failed: ${err.message}` };
  }
}

/**
 * Build guest data from a booking + user record.
 * Helper to convert MK data model to Shomoos format.
 */
export function buildGuestDataFromBooking(params: {
  user: {
    name?: string | null;
    nameAr?: string | null;
    displayName?: string | null;
    userType?: string | null;
    nationalId?: string | null;
    residentNo?: string | null;
    passportNo?: string | null;
    nationality?: string | null;
    nationalityAr?: string | null;
    dateOfBirth?: Date | string | null;
    phone?: string | null;
  };
  booking: {
    moveInDate: Date | string;
    moveOutDate: Date | string;
  };
  property: {
    title?: string | null;
    unitNumber?: string | null;
    buildingName?: string | null;
  };
}): ShomoosGuestData | null {
  const { user, booking, property } = params;

  // Determine ID type and number
  let idType: ShomoosIdType;
  let idNumber: string;

  if (user.userType === "saudi" && user.nationalId) {
    idType = "national_id";
    idNumber = user.nationalId;
  } else if (user.userType === "resident" && user.residentNo) {
    idType = "iqama";
    idNumber = user.residentNo;
  } else if (user.userType === "visitor" && user.passportNo) {
    idType = "passport";
    idNumber = user.passportNo;
  } else if (user.nationalId) {
    // Fallback: try nationalId field
    idType = user.nationalId.startsWith("1") ? "national_id" : "iqama";
    idNumber = user.nationalId;
  } else {
    return null; // Cannot submit without ID
  }

  const nameEn = user.name || user.displayName || "";
  const nameAr = user.nameAr || nameEn;

  const formatDate = (d: Date | string): string => {
    const date = typeof d === "string" ? new Date(d) : d;
    return date.toISOString().split("T")[0];
  };

  const dob = user.dateOfBirth ? formatDate(user.dateOfBirth) : "";

  return {
    nameAr,
    nameEn,
    idType,
    idNumber,
    nationality: user.nationality || "Saudi",
    nationalityAr: user.nationalityAr || user.nationality || "سعودي",
    dateOfBirth: dob,
    gender: "M", // Default; should be from user profile
    phone: user.phone || "",
    checkInDate: formatDate(booking.moveInDate),
    checkOutDate: formatDate(booking.moveOutDate),
    unitNumber: property.unitNumber || property.title || "1",
    propertyName: property.buildingName || property.title || "",
  };
}

