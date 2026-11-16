# Inbound WhatsApp Conversation Routing — Analysis

## Current State

### Existing conversation system (`/messages`)
- **conversations** table: `id, propertyId, tenantId, landlordId, lastMessageAt, createdAt`
- **messages** table: `id, conversationId, senderId, content, messageType(text|image|file), fileUrl, isRead, createdAt`
- DB methods: `getOrCreateConversation(tenantId, landlordId, propertyId?)`, `createMessage(data)`, `getConversationsByUser(userId)`, `getMessagesByConversation(convId)`, `markMessagesAsRead(convId, userId)`, `getUnreadMessageCount(userId)`
- tRPC: `message.getConversations`, `message.getMessages`, `message.send`, `message.startConversation`, `message.unreadCount`
- UI: `/messages` page with conversation list + chat panel (tenant↔landlord)

### Existing WhatsApp system
- **whatsapp_messages** table: outbound message log (recipientPhone, messageType, templateName, messageBody, status, channel, etc.)
- Taqnyat webhook: `POST /api/webhooks/taqnyat/whatsapp` → logs to audit_log + sends email notification
- **TODO comment in webhook**: "Route incoming messages to conversation system or chatbot"
- Admin WhatsApp page: `/admin/whatsapp` with tabs (Send, Templates, Logs, Settings)

### Key Constraints
- conversations table is tenantId↔landlordId (both are user IDs)
- WhatsApp inbound messages come from phone numbers, not user IDs
- Need a way to bridge phone→user lookup OR create a separate WhatsApp conversation model
- bearerToken auth must NOT change

## Design Decision: Separate WhatsApp Inbox

The existing `conversations` table is designed for tenant↔landlord internal messaging.
WhatsApp inbound messages are from external phone numbers that may or may not map to registered users.

**Best approach**: Create a dedicated WhatsApp conversation/inbox system that:
1. New tables: `wa_conversations` + `wa_messages` (separate from internal messaging)
2. Webhook routes inbound messages into wa_conversations (auto-creates or appends)
3. Admin can view inbox, reply via Taqnyat API (within 24h window)
4. If phone matches a registered user, link to userId for context
5. Admin UI: new "Inbox" tab in `/admin/whatsapp`

## Schema Design

### wa_conversations
- id (PK)
- contactPhone (varchar 20, indexed) — the WhatsApp sender
- contactName (varchar 255, nullable) — from WhatsApp profile or user lookup
- userId (int, nullable) — linked platform user if phone matches
- status: open | assigned | resolved | closed
- assignedTo (int, nullable) — admin user ID
- priority: normal | high | urgent
- lastMessageAt (timestamp)
- lastInboundAt (timestamp) — for 24h window tracking
- tags (json, string[]) — for categorization
- createdAt, updatedAt

### wa_messages
- id (PK)
- conversationId (FK → wa_conversations)
- direction: inbound | outbound
- senderPhone (varchar 20) — phone of sender
- senderName (varchar 255, nullable)
- content (text)
- messageType: text | image | audio | video | document | location
- mediaUrl (text, nullable)
- taqnyatMessageId (varchar 255, nullable) — provider message ID
- status: received | sent | delivered | read | failed
- metadata (json, nullable) — raw webhook payload
- createdAt (timestamp)

## Server Changes
1. Add tables to schema.ts
2. Add DB helper functions in db.ts
3. Modify taqnyat.ts webhook handler to route messages
4. Add admin tRPC routes for inbox management
5. Add reply functionality using sendTaqnyatWhatsAppText (24h window)

## Client Changes
1. Add "Inbox" tab to AdminWhatsApp.tsx
2. Conversation list with status badges, unread counts
3. Thread view with inbound/outbound messages
4. Reply input (sends via Taqnyat conversation API)
5. Status management (open/assigned/resolved/closed)
