import { TRPCError } from "@trpc/server";
import { adminWithPermission, router } from "./_core/trpc";
import { PERMISSIONS } from "./permissions";
import { z } from "zod";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { ENV } from "./_core/env";
import { eq } from "drizzle-orm";
import { integrationConfigs, auditLog } from "../drizzle/schema";
import { verifySmtpConnection, isSmtpConfigured } from "./email";
import { testS3Connection, reloadS3Client } from "./storage";

const pool = mysql.createPool(ENV.databaseUrl);
const db = drizzle(pool);

const DEFAULT_INTEGRATIONS = [
  { integrationKey: 'beds24', displayName: 'Beds24 PMS', displayNameAr: 'نظام إدارة Beds24' },
  { integrationKey: 'base44', displayName: 'Base44 Operations Workspace', displayNameAr: 'مساحة عمليات Base44' },
  { integrationKey: 'moyasar', displayName: 'Moyasar Payments', displayNameAr: 'مدفوعات مُيسّر' },
  { integrationKey: 'email', displayName: 'Email (SMTP)', displayNameAr: 'البريد الإلكتروني (SMTP)' },
  { integrationKey: 'maps', displayName: 'Google Maps', displayNameAr: 'خرائط جوجل' },
  { integrationKey: 'whatsapp', displayName: 'WhatsApp Cloud API', displayNameAr: 'واتساب كلاود API' },
  { integrationKey: 'storage', displayName: 'File Storage (S3/R2)', displayNameAr: 'تخزين الملفات (S3/R2)' },
  { integrationKey: 'ga4', displayName: 'Google Analytics (GA4)', displayNameAr: 'تحليلات جوجل (GA4)' },
  { integrationKey: 'shomoos', displayName: 'Shomoos (شموس)', displayNameAr: 'شموس - وزارة الداخلية' },
  { integrationKey: 'taqnyat_sms', displayName: 'Taqnyat SMS (تقنيات)', displayNameAr: 'تقنيات - رسائل SMS' },
  { integrationKey: 'taqnyat_whatsapp', displayName: 'Taqnyat WhatsApp (تقنيات)', displayNameAr: 'تقنيات - واتساب' },
];

function maskSecret(val: string | undefined | null): string {
  if (!val) return '';
  if (val.length <= 8) return '****';
  return val.substring(0, 4) + '****' + val.substring(val.length - 4);
}

function parseConfig(configJson: string | null): Record<string, string> {
  if (!configJson) return {};
  try { return JSON.parse(configJson); } catch { return {}; }
}

function maskConfig(config: Record<string, string>): Record<string, string> {
  const masked: Record<string, string> = {};
  for (const [key, val] of Object.entries(config)) {
    if (key.toLowerCase().includes('secret') || key.toLowerCase().includes('key') || key.toLowerCase().includes('token') || key.toLowerCase().includes('password')) masked[key] = maskSecret(val);
    else masked[key] = val;
  }
  return masked;
}

function resolveBase44SyncEndpoint(config: Record<string, string>): string | null {
  if (config.syncFunctionUrl) return config.syncFunctionUrl;
  const baseUrl = config.previewUrl || config.editorUrl;
  const functionName = config.syncFunctionName;
  if (!baseUrl || !functionName) return null;
  try {
    const url = new URL(baseUrl);
    return `${url.origin}/functions/${functionName}`;
  } catch {
    return null;
  }
}

function getConfigFields(key: string): { name: string; label: string; labelAr: string; isSecret: boolean }[] {
  switch (key) {
    case 'beds24':
      return [
        { name: 'apiUrl', label: 'API URL', labelAr: 'رابط API', isSecret: false },
        { name: 'refreshToken', label: 'Refresh Token', labelAr: 'رمز التحديث', isSecret: true },
        { name: 'webhookSecret', label: 'Webhook Secret', labelAr: 'سر الويب هوك', isSecret: true },
      ];
    case 'base44':
      return [
        { name: 'appId', label: 'Base44 App ID', labelAr: 'معرف تطبيق Base44', isSecret: false },
        { name: 'editorUrl', label: 'Editor URL', labelAr: 'رابط المحرر', isSecret: false },
        { name: 'previewUrl', label: 'Preview URL', labelAr: 'رابط المعاينة', isSecret: false },
        { name: 'syncFunctionUrl', label: 'Sync Function URL', labelAr: 'رابط دالة المزامنة', isSecret: false },
        { name: 'syncFunctionName', label: 'Sync Function Name', labelAr: 'اسم دالة المزامنة', isSecret: false },
        { name: 'apiKey', label: 'API Key / Bearer Token', labelAr: 'مفتاح API / رمز الوصول', isSecret: true },
        { name: 'workspaceName', label: 'Workspace Name', labelAr: 'اسم مساحة العمل', isSecret: false },
      ];
    case 'moyasar':
      return [
        { name: 'publishableKey', label: 'Publishable Key', labelAr: 'المفتاح العام', isSecret: false },
        { name: 'secretKey', label: 'Secret Key', labelAr: 'المفتاح السري', isSecret: true },
        { name: 'webhookSecret', label: 'Webhook Secret', labelAr: 'سر الويب هوك', isSecret: true },
        { name: 'mode', label: 'Mode (test/live)', labelAr: 'الوضع (تجريبي/حي)', isSecret: false },
        { name: 'enableMada', label: 'Enable Mada', labelAr: 'تفعيل مدى', isSecret: false },
        { name: 'enableApplePay', label: 'Enable Apple Pay', labelAr: 'تفعيل Apple Pay', isSecret: false },
        { name: 'enableGooglePay', label: 'Enable Google Pay', labelAr: 'تفعيل Google Pay', isSecret: false },
      ];
    case 'email':
      return [
        { name: 'smtpHost', label: 'SMTP Host', labelAr: 'خادم SMTP', isSecret: false },
        { name: 'smtpPort', label: 'SMTP Port', labelAr: 'منفذ SMTP', isSecret: false },
        { name: 'smtpUser', label: 'SMTP User', labelAr: 'مستخدم SMTP', isSecret: false },
        { name: 'smtpPassword', label: 'SMTP Password', labelAr: 'كلمة مرور SMTP', isSecret: true },
        { name: 'fromEmail', label: 'From Email', labelAr: 'البريد المرسل', isSecret: false },
      ];
    case 'maps':
      return [
        { name: 'provider', label: 'Provider (GOOGLE/MAPBOX/DISABLED)', labelAr: 'المزود (GOOGLE/MAPBOX/DISABLED)', isSecret: false },
        { name: 'apiKey', label: 'Google Maps API Key', labelAr: 'مفتاح Google Maps API', isSecret: true },
        { name: 'mapboxToken', label: 'Mapbox Access Token', labelAr: 'رمز وصول Mapbox', isSecret: true },
        { name: 'mapId', label: 'Google Map ID (optional)', labelAr: 'معرف الخريطة (اختياري)', isSecret: false },
        { name: 'showOnPropertyPage', label: 'Show on Property Page (true/false)', labelAr: 'عرض في صفحة العقار', isSecret: false },
        { name: 'enableGeocodingInAdmin', label: 'Enable Geocoding (true/false)', labelAr: 'تفعيل الترميز الجغرافي', isSecret: false },
        { name: 'enablePinPickerInAdmin', label: 'Enable Pin Picker (true/false)', labelAr: 'تفعيل اختيار الموقع بالدبوس', isSecret: false },
      ];
    case 'whatsapp':
      return [
        { name: 'phoneNumberId', label: 'Phone Number ID', labelAr: 'معرف رقم الهاتف', isSecret: false },
        { name: 'businessAccountId', label: 'Business Account ID', labelAr: 'معرف حساب الأعمال', isSecret: false },
        { name: 'accessToken', label: 'Access Token', labelAr: 'رمز الوصول', isSecret: true },
        { name: 'apiVersion', label: 'API Version (e.g. v20.0)', labelAr: 'إصدار API', isSecret: false },
        { name: 'webhookVerifyToken', label: 'Webhook Verify Token', labelAr: 'رمز التحقق من الويب هوك', isSecret: true },
      ];
    case 'storage':
      return [
        { name: 'endpoint', label: 'S3 Endpoint', labelAr: 'نقطة الوصول S3', isSecret: false },
        { name: 'bucket', label: 'Bucket Name', labelAr: 'اسم الحاوية', isSecret: false },
        { name: 'accessKeyId', label: 'Access Key ID', labelAr: 'معرف مفتاح الوصول', isSecret: true },
        { name: 'secretAccessKey', label: 'Secret Access Key', labelAr: 'مفتاح الوصول السري', isSecret: true },
        { name: 'region', label: 'Region', labelAr: 'المنطقة', isSecret: false },
        { name: 'publicBaseUrl', label: 'Public/CDN Base URL', labelAr: 'رابط CDN العام', isSecret: false },
      ];
    case 'ga4':
      return [
        { name: 'measurementId', label: 'Measurement ID (G-XXXXXXX)', labelAr: 'معرف القياس (G-XXXXXXX)', isSecret: false },
        { name: 'propertyId', label: 'GA4 Property ID (numeric)', labelAr: 'معرف الموقع (GA4)', isSecret: false },
        { name: 'serviceAccountJson', label: 'Service Account JSON (full key)', labelAr: 'مفتاح حساب الخدمة (JSON)', isSecret: true },
      ];
    case 'shomoos':
      return [
        { name: 'baseUrl', label: 'Shomoos API Base URL', labelAr: 'رابط API شموس', isSecret: false },
        { name: 'apiKey', label: 'API Key / Token', labelAr: 'مفتاح API / رمز الوصول', isSecret: true },
        { name: 'facilityId', label: 'Facility ID', labelAr: 'رقم المنشأة', isSecret: false },
      ];
    case 'taqnyat_sms':
      return [
        { name: 'bearerToken', label: 'Bearer Token (API Key)', labelAr: 'رمز الوصول', isSecret: true },
        { name: 'senderName', label: 'Sender Name', labelAr: 'اسم المرسل', isSecret: false },
      ];
    case 'taqnyat_whatsapp':
      return [
        { name: 'bearerToken', label: 'Bearer Token (API Key)', labelAr: 'رمز الوصول', isSecret: true },
        { name: 'webhookMode', label: 'Webhook Mode', labelAr: 'وضع الويب هوك', isSecret: false },
        { name: 'defaultCountryCode', label: 'Default Country Code', labelAr: 'رمز الدولة الافتراضي', isSecret: false },
      ];
    default:
      return [];
  }
}

export const integrationRouter = router({
  list: adminWithPermission(PERMISSIONS.MANAGE_SETTINGS).query(async () => {
    for (const def of DEFAULT_INTEGRATIONS) {
      const existing = await db.select().from(integrationConfigs).where(eq(integrationConfigs.integrationKey, def.integrationKey));
      if (existing.length === 0) {
        await db.insert(integrationConfigs).values({ integrationKey: def.integrationKey, displayName: def.displayName, displayNameAr: def.displayNameAr, isEnabled: false, status: 'not_configured' });
      }
    }
    const all = await db.select().from(integrationConfigs);
    return all.map(item => {
      if (item.integrationKey === 'email' && isSmtpConfigured()) {
        const envConfig: Record<string, string> = { smtpHost: ENV.smtpHost, smtpPort: String(ENV.smtpPort), smtpUser: ENV.smtpUser, smtpPassword: ENV.smtpPass, fromEmail: ENV.smtpFrom };
        return { ...item, status: item.status === 'healthy' ? 'healthy' : 'configured', configJson: null, maskedConfig: maskConfig(envConfig), configFields: getConfigFields(item.integrationKey) };
      }
      const config = parseConfig(item.configJson);
      if (item.integrationKey === 'base44') {
        const resolved = resolveBase44SyncEndpoint(config);
        if (resolved && !config.syncFunctionUrl) config.syncFunctionUrl = resolved;
      }
      return { ...item, configJson: null, maskedConfig: maskConfig(config), configFields: getConfigFields(item.integrationKey) };
    });
  }),

  getById: adminWithPermission(PERMISSIONS.MANAGE_SETTINGS).input(z.object({ id: z.number() })).query(async ({ input }) => {
    const [item] = await db.select().from(integrationConfigs).where(eq(integrationConfigs.id, input.id));
    if (!item) throw new TRPCError({ code: 'NOT_FOUND' });
    return { ...item, configJson: null, maskedConfig: maskConfig(parseConfig(item.configJson)), configFields: getConfigFields(item.integrationKey) };
  }),

  update: adminWithPermission(PERMISSIONS.MANAGE_SETTINGS).input(z.object({ id: z.number(), isEnabled: z.boolean().optional(), config: z.record(z.string(), z.string()).optional() })).mutation(async ({ ctx, input }) => {
    const [item] = await db.select().from(integrationConfigs).where(eq(integrationConfigs.id, input.id));
    if (!item) throw new TRPCError({ code: 'NOT_FOUND' });
    const updates: any = {};
    if (input.isEnabled !== undefined) updates.isEnabled = input.isEnabled;
    if (input.config) {
      const existingConfig = parseConfig(item.configJson);
      const newConfig = { ...existingConfig };
      for (const [key, val] of Object.entries(input.config)) if (val && !val.includes('****')) newConfig[key] = val;
      updates.configJson = JSON.stringify(newConfig);
      const fields = getConfigFields(item.integrationKey);
      const requiredFields = item.integrationKey === 'base44'
        ? ['appId', 'editorUrl']
        : fields.filter(f => f.isSecret || f.name.includes('Host') || f.name.includes('Url') || f.name.includes('Key')).map(f => f.name);
      const hasAllRequired = requiredFields.every((name) => newConfig[name] && newConfig[name].length > 0);
      updates.status = hasAllRequired ? 'configured' : 'not_configured';
    }
    await db.update(integrationConfigs).set(updates).where(eq(integrationConfigs.id, input.id));
    if (item.integrationKey === 'storage' && input.config) {
      const finalConfig = parseConfig(updates.configJson || item.configJson);
      if (finalConfig.bucket && finalConfig.accessKeyId && finalConfig.secretAccessKey) {
        process.env.S3_ENDPOINT = finalConfig.endpoint || '';
        process.env.S3_BUCKET = finalConfig.bucket;
        process.env.S3_ACCESS_KEY_ID = finalConfig.accessKeyId;
        process.env.S3_SECRET_ACCESS_KEY = finalConfig.secretAccessKey;
        process.env.S3_REGION = finalConfig.region || 'auto';
        if (finalConfig.publicBaseUrl) process.env.S3_PUBLIC_BASE_URL = finalConfig.publicBaseUrl;
        reloadS3Client();
      }
    }
    await db.insert(auditLog).values({ userId: ctx.user?.id ?? null, userName: ctx.user?.displayName ?? 'system', action: input.isEnabled !== undefined ? (input.isEnabled ? 'ENABLE' : 'DISABLE') : 'UPDATE', entityType: 'INTEGRATION', entityId: input.id, entityLabel: item.displayName, changes: input.config ? { fields: { old: 'masked', new: Object.keys(input.config).join(', ') } } as any : undefined });
    return { success: true };
  }),

  test: adminWithPermission(PERMISSIONS.MANAGE_SETTINGS).input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const [item] = await db.select().from(integrationConfigs).where(eq(integrationConfigs.id, input.id));
    if (!item) throw new TRPCError({ code: 'NOT_FOUND' });
    const config = parseConfig(item.configJson);
    let testResult: { success: boolean; message: string } = { success: false, message: 'Unknown integration' };
    try {
      switch (item.integrationKey) {
        case 'beds24': {
          const apiUrl = config.apiUrl || process.env.BEDS24_API_URL || 'https://beds24.com/api/v2';
          const token = config.refreshToken || process.env.BEDS24_REFRESH_TOKEN;
          if (!token) { testResult = { success: false, message: 'No refresh token configured' }; break; }
          try {
            const resp = await fetch(`${apiUrl}/properties`, { headers: { token }, signal: AbortSignal.timeout(10000) });
            testResult = resp.ok ? { success: true, message: `Connected to Beds24 API. Status: ${resp.status}` } : { success: false, message: `Beds24 API returned ${resp.status}: ${resp.statusText}` };
          } catch (e: any) { testResult = { success: false, message: `Connection failed: ${e.message}` }; }
          break;
        }
        case 'base44': {
          const appId = config.appId;
          const editorUrl = config.editorUrl;
          const endpoint = resolveBase44SyncEndpoint(config);
          if (!appId || !editorUrl) { testResult = { success: false, message: 'Base44 App ID and Editor URL are required' }; break; }
          if (endpoint) {
            try {
              const resp = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}) }, body: JSON.stringify({ mode: 'ping', appId }) , signal: AbortSignal.timeout(10000)});
              testResult = resp.ok ? { success: true, message: `Base44 sync function reachable at ${endpoint}` } : { success: false, message: `Base44 sync function returned HTTP ${resp.status}` };
            } catch (e: any) { testResult = { success: false, message: `Base44 function test failed: ${e.message}` }; }
          } else {
            const previewUrl = config.previewUrl;
            const looksValid = editorUrl.includes(appId) || (previewUrl ? previewUrl.includes(appId) : false);
            testResult = looksValid ? { success: true, message: 'Base44 app config saved. Add a sync function URL to execute outbound sync.' } : { success: !!config.apiKey, message: !!config.apiKey ? 'Base44 credentials saved. Review editor/preview URL if the wrong app opens.' : 'Base44 credentials are incomplete. Add API key / access token to continue with sync.' };
          }
          break;
        }
        case 'moyasar': {
          const secretKey = config.secretKey || process.env.MOYASAR_SECRET_KEY;
          if (!secretKey) { testResult = { success: false, message: 'No secret key configured' }; break; }
          try {
            const resp = await fetch('https://api.moyasar.com/v1/payments?page=1&per=1', { headers: { Authorization: `Basic ${Buffer.from(secretKey + ':').toString('base64')}` }, signal: AbortSignal.timeout(10000) });
            testResult = (resp.ok || resp.status === 200) ? { success: true, message: `Moyasar API connected. Mode: ${config.mode || 'test'}` } : { success: false, message: `Moyasar API returned ${resp.status}` };
          } catch (e: any) { testResult = { success: false, message: `Connection failed: ${e.message}` }; }
          break;
        }
        case 'email': {
          try { testResult = isSmtpConfigured() ? ((await verifySmtpConnection()) ? { success: true, message: 'SMTP connection verified successfully' } : { success: false, message: 'SMTP connection failed' }) : { success: false, message: 'SMTP not configured in environment' }; }
          catch (e: any) { testResult = { success: false, message: `SMTP test failed: ${e.message}` }; }
          break;
        }
        case 'storage': {
          const { endpoint, bucket, accessKeyId, secretAccessKey } = config; const region = config.region || 'auto';
          if (!bucket || !accessKeyId || !secretAccessKey) { testResult = { success: false, message: 'Bucket, Access Key ID, and Secret Access Key are required' }; break; }
          testResult = await testS3Connection({ endpoint, bucket, accessKeyId, secretAccessKey, region });
          break;
        }
        default:
          testResult = { success: true, message: `Configuration saved for ${item.integrationKey}` };
      }
    } catch (e: any) {
      testResult = { success: false, message: `Test error: ${e.message}` };
    }
    await db.update(integrationConfigs).set({ status: testResult.success ? 'healthy' : 'failing', lastTestedAt: new Date(), lastError: testResult.success ? null : testResult.message }).where(eq(integrationConfigs.id, input.id));
    await db.insert(auditLog).values({ userId: ctx.user?.id ?? null, userName: ctx.user?.displayName ?? 'system', action: 'TEST', entityType: 'INTEGRATION', entityId: input.id, entityLabel: item.displayName, metadata: { result: testResult.success ? 'healthy' : 'failing', message: testResult.message } as any });
    return testResult;
  }),

  credentials: router({
    list: adminWithPermission(PERMISSIONS.MANAGE_SETTINGS).query(async () => {
      const { getAllIntegrationSettings } = await import('./integration-settings');
      return getAllIntegrationSettings();
    }),
    update: adminWithPermission(PERMISSIONS.MANAGE_SETTINGS).input(z.object({ integrationKey: z.string(), config: z.record(z.string()), isEnabled: z.boolean() })).mutation(async ({ ctx, input }) => {
      const writeEnabled = process.env.ENABLE_INTEGRATION_PANEL_WRITE === 'true';
      if (!writeEnabled) return { success: false, error: 'Integration panel write is disabled. Set ENABLE_INTEGRATION_PANEL_WRITE=true to enable.' };
      const { updateIntegrationCredential } = await import('./integration-settings');
      return updateIntegrationCredential({ integrationKey: input.integrationKey, config: input.config, isEnabled: input.isEnabled, updatedBy: ctx.user.id, updatedByName: ctx.user.displayName || ctx.user.email || 'admin' });
    }),
  }),

  kyc: router({
    list: adminWithPermission(PERMISSIONS.MANAGE_SETTINGS).input(z.object({ status: z.string().optional(), userId: z.number().optional(), limit: z.number().optional(), offset: z.number().optional() }).optional()).query(async ({ input }) => { const { getKycRequests } = await import('./kyc-adapter'); return getKycRequests(input || undefined); }),
    documents: adminWithPermission(PERMISSIONS.MANAGE_SETTINGS).input(z.object({ requestId: z.number() })).query(async ({ input }) => { const { getKycDocuments } = await import('./kyc-adapter'); return getKycDocuments(input.requestId); }),
    approve: adminWithPermission(PERMISSIONS.MANAGE_SETTINGS).input(z.object({ requestId: z.number(), notes: z.string().optional() })).mutation(async ({ ctx, input }) => { const { approveKycRequest } = await import('./kyc-adapter'); return approveKycRequest({ requestId: input.requestId, reviewerId: ctx.user.id, reviewerName: ctx.user.displayName || ctx.user.email || 'admin', notes: input.notes }); }),
    reject: adminWithPermission(PERMISSIONS.MANAGE_SETTINGS).input(z.object({ requestId: z.number(), reason: z.string(), reasonCode: z.string().optional() })).mutation(async ({ ctx, input }) => { const { rejectKycRequest } = await import('./kyc-adapter'); return rejectKycRequest({ requestId: input.requestId, reviewerId: ctx.user.id, reviewerName: ctx.user.displayName || ctx.user.email || 'admin', reason: input.reason, reasonCode: input.reasonCode }); }),
  }),

  shomoos: router({
    submissions: adminWithPermission(PERMISSIONS.MANAGE_SETTINGS).input(z.object({ bookingId: z.number().optional(), tenantId: z.number().optional(), propertyId: z.number().optional(), status: z.string().optional(), submissionType: z.string().optional(), limit: z.number().optional(), offset: z.number().optional() }).optional()).query(async ({ input }) => { const { getSubmissions } = await import('./shomoos'); return getSubmissions(input as any || undefined); }),
    stats: adminWithPermission(PERMISSIONS.MANAGE_SETTINGS).query(async () => { const { getSubmissionStats } = await import('./shomoos'); return getSubmissionStats(); }),
    checkIn: adminWithPermission(PERMISSIONS.MANAGE_SETTINGS).input(z.object({ bookingId: z.number() })).mutation(async ({ ctx, input }) => { const { submitCheckIn, buildGuestDataFromBooking } = await import('./shomoos'); const { getUserById } = await import('./db'); const dbModule = await import('./db'); const pool2 = dbModule.getPool(); if (!pool2) return { success: false, error: 'Database unavailable' }; const [bookingRows] = await pool2.query<any[]>('SELECT b.*, p.title as propertyTitle, p.unitNumber, p.buildingName FROM bookings b LEFT JOIN properties p ON b.propertyId = p.id WHERE b.id = ? LIMIT 1', [input.bookingId]); if (bookingRows.length === 0) return { success: false, error: 'Booking not found' }; const booking = bookingRows[0]; const tenant = await getUserById(booking.tenantId); if (!tenant) return { success: false, error: 'Tenant not found' }; const guestData = buildGuestDataFromBooking({ user: tenant, booking: { moveInDate: booking.moveInDate, moveOutDate: booking.moveOutDate }, property: { title: booking.propertyTitle, unitNumber: booking.unitNumber, buildingName: booking.buildingName } }); if (!guestData) return { success: false, error: 'Tenant identity data incomplete.' }; return submitCheckIn({ guest: guestData, bookingId: input.bookingId, tenantId: booking.tenantId, propertyId: booking.propertyId, submittedBy: ctx.user.id, submittedByName: ctx.user.displayName || ctx.user.email || 'admin' }); }),
    checkOut: adminWithPermission(PERMISSIONS.MANAGE_SETTINGS).input(z.object({ submissionId: z.number(), checkOutDate: z.string() })).mutation(async ({ ctx, input }) => { const { submitCheckOut } = await import('./shomoos'); const pool2 = (await import('./db')).getPool(); if (!pool2) return { success: false, error: 'Database unavailable' }; const [rows] = await pool2.query<any[]>('SELECT * FROM shomoos_submissions WHERE id = ? AND submissionType = "check_in" LIMIT 1', [input.submissionId]); if (rows.length === 0) return { success: false, error: 'Check-in submission not found' }; const sub = rows[0]; if (!sub.shomoosRefId) return { success: false, error: 'No Shomoos reference ID.' }; return submitCheckOut({ shomoosRefId: sub.shomoosRefId, checkOutDate: input.checkOutDate, bookingId: sub.bookingId, tenantId: sub.tenantId, propertyId: sub.propertyId, submittedBy: ctx.user.id, submittedByName: ctx.user.displayName || ctx.user.email || 'admin' }); }),
    retry: adminWithPermission(PERMISSIONS.MANAGE_SETTINGS).input(z.object({ submissionId: z.number() })).mutation(async ({ ctx, input }) => { const { retrySubmission } = await import('./shomoos'); return retrySubmission(input.submissionId, ctx.user.id, ctx.user.displayName || ctx.user.email || 'admin'); }),
    isEnabled: adminWithPermission(PERMISSIONS.MANAGE_SETTINGS).query(async () => { const { isShomoosEnabled } = await import('./shomoos'); return { enabled: await isShomoosEnabled() }; }),
  }),

  flags: router({
    list: adminWithPermission(PERMISSIONS.MANAGE_SETTINGS).query(async () => { const { getAllFlags } = await import('./feature-flags'); return getAllFlags(); }),
    update: adminWithPermission(PERMISSIONS.MANAGE_SETTINGS).input(z.object({ key: z.string(), value: z.string() })).mutation(async ({ ctx, input }) => { const { getPool: getP } = await import('./db'); const p = getP(); if (!p) return { success: false, error: 'Database unavailable' }; await p.execute('INSERT INTO platformSettings (settingKey, settingValue) VALUES (?, ?) ON DUPLICATE KEY UPDATE settingValue = VALUES(settingValue)', [input.key, input.value]); const { invalidateFlagCache } = await import('./feature-flags'); invalidateFlagCache(); const { logAudit: la } = await import('./audit-log'); await la({ userId: ctx.user.id, userName: ctx.user.displayName || ctx.user.email || 'admin', action: 'UPDATE', entityType: 'FEATURE_FLAG', entityId: 0, entityLabel: input.key, changes: { value: { old: 'unknown', new: input.value } } }); return { success: true }; }),
  }),
});
