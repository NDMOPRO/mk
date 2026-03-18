# Complete Analysis: User Management, Roles & Permissions

## 1. Database Schema (drizzle/schema.ts)

### users table (line 14-65)
- `id`: auto-increment int PK
- `openId`: varchar(64), NOT NULL, UNIQUE — format `local_{userId}` for local users
- `userId`: varchar(64), UNIQUE — the username
- `passwordHash`: varchar(255)
- `displayName`: varchar(100)
- `name`: text
- `nameAr`: text
- `email`: varchar(320)
- `phone`: varchar(20)
- `role`: enum("user", "admin", "landlord", "tenant"), default "user", NOT NULL
- `loginMethod`: varchar(64) — set to "local" for local users
- `isOwner`: boolean, default false
- `isBreakglassAdmin`: boolean, default false
- `createdAt`, `updatedAt`, `lastSignedIn`: timestamps

### adminPermissions table (line 400-407)
- `id`: auto-increment int PK
- `userId`: int, NOT NULL — references users.id
- `permissions`: json array of strings, NOT NULL
- `isRootAdmin`: boolean, default false
- `createdAt`, `updatedAt`: timestamps

### roles table (line 610-621)
- `id`: auto-increment int PK
- `name`: varchar(100), NOT NULL — English name
- `nameAr`: varchar(100), NOT NULL — Arabic name
- `description`: text
- `descriptionAr`: text
- `permissions`: json array of strings, NOT NULL
- `isSystem`: boolean, default false
- `isActive`: boolean, default true
- `createdAt`, `updatedAt`: timestamps

## 2. DB Functions (server/db.ts)

### User functions:
- `getUserByUserId(userId: string)` — line 1388: finds by username (userId column)
- `getUserByEmail(email: string)` — line 1430: finds by email
- `getUserByPhone(phone: string)` — line 1423: finds by phone
- `createLocalUser(data)` — line 1395: creates user with openId=`local_{userId}`, loginMethod="local"
  - Accepts: userId, passwordHash, displayName, name, nameAr, email, phone, role
  - Returns: insertId (number) or null
- `updateUserRole(userId, role)` — line 708: updates role enum
- `updateUserPassword(userId, passwordHash)` — line 1437
- `getAllUsers(limit, offset, search, role)` — line 721
- `deleteUser(userId: number)` — line 3132 (ALREADY ADDED by me): deletes by id

### Admin permissions functions:
- `getAdminPermissions(userId: number)` — line 1611: returns {id, userId, permissions[], isRootAdmin}
- `setAdminPermissions(userId, perms[], isRoot)` — line 1618: upsert (insert or update on duplicate)
- `getAllAdminPermissions()` — line 1625: returns all admin users joined with their permissions
- `deleteAdminPermissions(userId)` — line 1638: deletes permission row

## 3. Server Routers

### admin.router.ts — exported as `adminRouterDefs` → spread into appRouter
- Route path: `admin.*`
- `admin.users` — line 160: getAllUsers query
- `admin.updateUserRole` — line 165: mutation to change role
- `admin.createUser` — line 185 (ALREADY ADDED by me): mutation to create user
- `admin.deleteUser` — line 253 (ALREADY ADDED by me): mutation to delete user

### roles.router.ts — exported as `rolesRouterDefs` → spread into appRouter
- Route paths: `permissions.*`, `permissionMeta.*`, `roles.*`
- `permissions.list` — getAllAdminPermissions() (lists admin users with perms)
- `permissions.get` — getAdminPermissions by userId
- `permissions.set` — setAdminPermissions (protected: can't modify root admin)
- `permissions.delete` — deleteAdminPermissions (protected: can't delete root admin)
- `roles.list` — list all roles from roles table
- `roles.create` — create new role
- `roles.update` — update role (can't rename system roles)
- `roles.delete` — delete role (can't delete system roles)
- `roles.assignToUser` — assign role's permissions to a user via setAdminPermissions

## 4. Seed System

### seed-admin.ts — called on startup
- Seeds user "Hobart" (Khalid Abdullah) with root admin + all permissions
- `ensureAdminPermissions()` — ensures "Hobart" and "admin" users have root permissions

### seed-cities.ts — called on startup
- `seedDefaultRoles()` — seeds 5 system roles if roles table is empty:
  1. Super Admin (مدير عام) — all 23 permissions
  2. Property Manager (مدير عقارات) — 12 permissions
  3. Accountant (محاسب) — 5 permissions
  4. Support Agent (موظف دعم) — 7 permissions
  5. Viewer (مشاهد) — 5 permissions
- Note: roles are seeded ONLY if count == 0, so adding new roles to seed won't work if roles already exist

## 5. Client UI (AdminPermissions.tsx)

### Current capabilities:
- Create/edit/delete ROLES (with permission matrix)
- View admin users list (from permissions.list)
- Assign roles to existing admin users via dropdown
- NO create user UI
- NO delete user UI

### tRPC hooks used:
- `trpc.roles.list.useQuery()` — list roles
- `trpc.permissions.list.useQuery()` — list admin users
- `trpc.roles.create.useMutation()` — create role
- `trpc.roles.update.useMutation()` — update role
- `trpc.roles.delete.useMutation()` — delete role
- `trpc.roles.assignToUser.useMutation()` — assign role to user

### NOT used yet (but available from my additions):
- `trpc.admin.createUser.useMutation()` — create user
- `trpc.admin.deleteUser.useMutation()` — delete user

## 6. Audit Log (server/audit-log.ts)

### Valid AuditAction values (line 11):
"CREATE" | "UPDATE" | "ARCHIVE" | "RESTORE" | "DELETE" | "LINK_BEDS24" | "UNLINK_BEDS24" | "SEND" | "PUBLISH" | "UNPUBLISH" | "CONVERT" | "TEST" | "ENABLE" | "DISABLE" | "APPROVE" | "REJECT" | "REVIEW"

### Valid AuditEntityType values (line 12):
"BUILDING" | "UNIT" | "BEDS24_MAP" | "LEDGER" | "EXTENSION" | "PAYMENT_METHOD" | "WHATSAPP_MESSAGE" | "WHATSAPP_TEMPLATE" | "PROPERTY" | "SUBMISSION" | "INTEGRATION" | "KYC_REQUEST" | "INTEGRATION_CREDENTIAL" | "FEATURE_FLAG" | "USER_VERIFICATION"

### ISSUE FOUND: My createUser/deleteUser endpoints use:
- `action: 'create_user'` — NOT valid, should be `'CREATE'`
- `action: 'delete_user'` — NOT valid, should be `'DELETE'`
- `entityType: 'user'` — NOT valid, not in the enum

## 7. Permission Constants (server/permissions.ts)

### Available PERMISSIONS keys:
MANAGE_USERS, MANAGE_PROPERTIES, MANAGE_BOOKINGS, MANAGE_PAYMENTS, MANAGE_SERVICES, MANAGE_MAINTENANCE, MANAGE_CITIES, MANAGE_CMS, MANAGE_ROLES, MANAGE_KNOWLEDGE, VIEW_ANALYTICS, MANAGE_SETTINGS, SEND_NOTIFICATIONS, MANAGE_AI, MANAGE_PAYMENTS_OVERRIDE, MANAGE_WHATSAPP, MANAGE_KYC, MANAGE_INTEGRATIONS

## 8. Issues Found in My Previous Code Changes

### admin.router.ts createUser (line 185):
1. logAudit uses `action: 'create_user'` — INVALID. Must be `'CREATE'`
2. logAudit uses `entityType: 'user'` — INVALID. Not in AuditEntityType enum
3. Need to add "USER" to AuditEntityType or skip audit for now

### admin.router.ts deleteUser (line 253):
1. logAudit uses `action: 'delete_user'` — INVALID. Must be `'DELETE'`
2. logAudit uses `entityType: 'user'` — INVALID. Same issue

### db.ts deleteUser (line 3132):
- Looks correct. Simple delete by id.

## 9. Required Changes

### A. Fix audit log types (audit-log.ts):
- Add "USER" to AuditEntityType enum

### B. Fix admin.router.ts createUser/deleteUser:
- Change `action: 'create_user'` → `action: 'CREATE'`
- Change `action: 'delete_user'` → `action: 'DELETE'`
- Change `entityType: 'user'` → `entityType: 'USER'`

### C. Add "Operations Manager" and "CFO" roles to seed:
- Since roles table already has data, seed won't re-run
- Must add them via the roles.create tRPC endpoint OR add conditional seeding
- Better approach: add to seed-cities.ts seedDefaultRoles() with individual checks

### D. Seed the two new users in seed-admin.ts:
- operations@monthlykey.com — Mushtaq Ibn Mohammed — Operations Manager
- finance@monthlykey.com — Sameh Abulfadl — CFO
- Both as role: "admin" with appropriate permissions

### E. Update AdminPermissions.tsx UI:
- Add "Create User" dialog with form fields
- Add "Delete User" button next to each non-root admin user
- Wire up trpc.admin.createUser and trpc.admin.deleteUser mutations
