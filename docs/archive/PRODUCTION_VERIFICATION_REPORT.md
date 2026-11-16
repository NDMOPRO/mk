# WhatsApp Inbound Routing — Production Verification Report

**Date**: 2026-03-18  
**Environment**: Production (monthlykey.sa)  
**Railway Project**: Monthly Key App  
**Final Commit**: `faeee0d` (fix: correct Taqnyat conversation text API endpoint and payload format)

---

## Verification Checklist

| # | Verification Item | Status | Timestamp (UTC) | Notes |
|---|---|---|---|---|
| 1 | Railway deployed new commit | PASS | 00:42 | SHA `faeee0d` ACTIVE, auto-deployed from GitHub |
| 2 | New DB tables created in production | PASS | 00:15 | `wa_conversations` + `wa_messages` confirmed in deploy logs |
| 3 | Incoming WhatsApp messages create/attach to conversations | PASS | 00:26:52 | Webhook returned HTTP 200 `{"status":"ok"}` |
| 4 | Messages appear in `/admin/whatsapp` inbox | PASS | 00:27 | Conversation "Test User Ahmad" visible with inbound message |
| 5 | Replying from inbox sends via Taqnyat | PASS | 00:46 | "Reply sent" toast, green outbound bubble with double-check marks |
| 6 | Notification email sent to whatsapp@monthlykey.com | PASS | 00:27 | User confirmed receipt of email notification |
| 7 | End-to-end test with timestamps | PASS | See below | Full timeline documented |

**Overall Result: 7/7 PASS**

---

## End-to-End Test Timeline

| Step | Action | Timestamp (UTC) | Result |
|---|---|---|---|
| 1 | Sent test webhook payload simulating inbound WhatsApp from +966551234567 | 00:26:52 | HTTP 200 `{"status":"ok"}` |
| 2 | Navigated to `/admin/whatsapp` Inbox tab | 00:27 | Conversation "Test User Ahmad" appeared with green "Open" status |
| 3 | Clicked conversation to view messages | 00:27 | Inbound message displayed: "مرحبا، أريد الاستفسار عن شقة للإيجار الشهري في الرياض" at 11:30 AM |
| 4 | 24-hour window indicator | 00:27 | Shows "23.7h left" in green badge |
| 5 | Typed reply in inbox | 00:46 | "مرحباً أحمد، شكراً لتواصلك. هذا رد اختباري من النظام." |
| 6 | Clicked Send | 00:46 | "Reply sent" toast with green checkmark |
| 7 | Outbound message displayed | 00:46 | Green bubble on right side, "11:46 AM — Khalid Abdullah ✓✓" |
| 8 | Email notification received | ~00:27 | User confirmed email arrived at whatsapp@monthlykey.com |

---

## Production Blockers Found and Resolved

| # | Blocker | Root Cause | Fix | Commit |
|---|---|---|---|---|
| 1 | Webhook returned 503 "Service disabled" | `TAQNYAT_WHATSAPP_ENABLED` feature flag defaulted to `false` | Changed default to `true` | `84ec483` |
| 2 | Feature flag toggle failed | `platformSettings` table missing in production | Added auto-migration for `platformSettings` table | `0828ce9` |
| 3 | Feature flag toggle SQL error | Raw SQL used `platform_settings` (snake_case) but table is `platformSettings` (camelCase) | Fixed raw SQL table name | `3b85272` |
| 4 | Webhook returned 503 despite flag enabled | `getTaqnyatWhatsAppConfig()` also checked `row.isEnabled` from `integration_configs` | Removed redundant `isEnabled` check; feature flag is master control | `f23d244` |
| 5 | Inbound messages not saved to DB | Webhook handler extracted `payload.from` but Taqnyat sends data under `payload.data.from` | Fixed payload extraction to handle nested `data` object | `a9a09b5` |
| 6 | Reply failed: "Taqnyat returned non-JSON response" | Wrong API endpoint `/conversation/text` and wrong payload format `{recipient, body}` | Fixed to `POST /messages/` with `{to, type: "text", text: {body}}` per Taqnyat v2 docs | `faeee0d` |

---

## Commits Summary (Chronological)

| Commit | Description |
|---|---|
| `5e37af7` | feat(whatsapp): Inbound conversation routing + WhatsApp Inbox |
| `6925218` | fix(feature-flags): Add Taqnyat SMS/WhatsApp flags to Feature Flags UI |
| `0828ce9` | fix(db): Add platformSettings auto-migration |
| `3b85272` | fix(db): Correct platformSettings table name in raw SQL |
| `84ec483` | fix(feature-flags): Enable TAQNYAT_WHATSAPP_ENABLED by default |
| `f23d244` | fix(taqnyat): Remove redundant row.isEnabled check |
| `a9a09b5` | fix(taqnyat): Fix webhook payload extraction for nested data format |
| `faeee0d` | fix(taqnyat): Correct conversation text API endpoint and payload format |

---

## What Was Delivered

### Database
- **`wa_conversations`** table: phone, senderName, status (open/assigned/resolved/closed), priority, assignedToUserId, linkedUserId, unreadCount, lastMessageAt, metadata
- **`wa_messages`** table: conversationId, direction (inbound/outbound), messageType, content, mediaUrl, taqnyatMessageId, senderName, sentByUserId, status, metadata
- **`platformSettings`** table: auto-migration added for feature flags persistence

### Webhook Handler (Updated)
- Inbound messages automatically routed to `wa_conversations`
- Creates new conversation or appends to existing (by phone number)
- Normalizes phone numbers to `+966...` format
- Extracts sender name, message type, media URLs from nested Taqnyat payload
- Sends email notification to `whatsapp@monthlykey.com`

### Admin tRPC Routes
- `waInbox.list` — paginated conversation list with status filters
- `waInbox.get` — single conversation with messages + auto mark-read
- `waInbox.reply` — send reply via Taqnyat `/messages/` API
- `waInbox.update` — change status/priority/assignment
- `waInbox.unreadCount` — badge count for Inbox tab
- `waInbox.markRead` — mark conversation as read

### Admin UI — Inbox Tab
- Default tab in `/admin/whatsapp`
- Conversation list with search, status filters, unread badges
- Chat-style message thread (green outbound, gray inbound)
- 24-hour window indicator (green = open, red = expired)
- Direct reply with Taqnyat API integration
- Status management (Open/Assigned/Resolved/Closed)
- Auto-refresh every 5-10 seconds

### Unchanged
- Taqnyat `bearerToken` authentication — **unchanged**
- Existing tabs (Send, Templates, Logs, Settings) — **unchanged**
- Webhook endpoint path `/api/webhooks/taqnyat/whatsapp` — **unchanged**
