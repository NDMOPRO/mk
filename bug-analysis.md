# Bug Analysis & Fix Plan

## CRITICAL BUGS (will crash the bot)

### Bug 1: index.js imports non-existent exports from ops-v4.js
**File:** index.js lines 108-124
**Issue:** index.js imports these from `handlers/ops-v4.js` but they DON'T EXIST in that file:
- `handleSensitiveDataCheck` — NOT exported
- `handleNewMember` — NOT exported  
- `handleOpsLeaderboard` — NOT exported
- `handleOpsAway` — NOT exported
- `handleOpsBack` — NOT exported
- `handleOpsAvailability` — NOT exported
- `handleTopicRoutingSuggestion` — NOT exported
- `trackMentions` — NOT exported
- `markMentionResponse` — NOT exported
- `handleV4Passive` — NOT exported
- `initV4` — NOT exported
- `handlePollCallback` — should be `handlePollVoteCallback`

ops-v4.js only exports:
```
handleOpsRoles, handleOpsSetRole, handleOpsAudit, handleOpsVerify,
handleOpsOnboarding, handleOpsTeam, handleOpsPerformance, handleOpsLeave,
handleOpsPoll, handleOpsPin, handlePollVoteCallback
```

### Bug 2: index.js imports non-existent exports from ops.js
**File:** index.js lines 72-104
**Issue:** index.js imports these from `handlers/ops.js` but they DON'T EXIST:
- `handleOpsPassive` — NOT exported
- `registerTopicName` — NOT exported
- `handleOpsRecurring` — NOT exported (used on line 287)
- `handleOpsMeeting` — NOT exported (used on line 322)

### Bug 3: ops-v5.js calls non-existent function
**File:** ops-v5.js line 128
**Issue:** `v5Db.saveMessageTemplate()` — the actual export is `v5Db.saveTemplate()`

### Bug 4: ops-v5.js calls non-existent function  
**File:** ops-v5.js line 263
**Issue:** `v5Db.updatePhotoStatus()` — doesn't exist. Should use `v5Db.approvePhoto()` or `v5Db.rejectPhoto()`

### Bug 5: ops-scheduler.js calls non-existent functions
**File:** ops-scheduler.js line 583
**Issue:** `opsDb.getAllSlaConfigs()` — doesn't exist in ops-database.js. Should be `opsDb.getSlaConfig()`

### Bug 6: ops-scheduler.js calls non-existent v5 functions
**File:** ops-scheduler.js line 29, 1063, 1135
**Issue:** `v5Handlers.checkAndPostWeatherAlerts()` and `v5Handlers.initV5()` don't exist in ops-v5.js exports

### Bug 7: ops-scheduler.js follow-up uses wrong function name
**File:** ops-scheduler.js line 530
**Issue:** `opsDb.markFollowUpDone()` — should be `opsDb.markFollowUpSent()`

### Bug 8: ops-scheduler.js reminder uses wrong function name
**File:** ops-scheduler.js line 562
**Issue:** `opsDb.markReminderDone()` — should be `opsDb.markReminderSent()`

### Bug 9: ops.js executeTool log_maintenance wrong args
**File:** ops.js line 875
**Issue:** `opsDb.addMaintenanceLog()` called without chatId as first arg. Should be v5Db function.

### Bug 10: ops.js executeTool log_cleaning wrong args
**File:** ops.js line 879
**Issue:** `opsDb.addCleaningLog()` doesn't exist on opsDb. Should use v5Db.

### Bug 11: ops-v5.js handleOpsClean wrong function signature
**File:** ops-v5.js line 153
**Issue:** `v5Db.addCleaningLog(chatId, unitId, subCmd, cleaner, "", "completed", threadId)` — too many args. Signature is `addCleaningLog(chatId, unitId, cleaningType, cleanerName, notes, threadId)`.

### Bug 12: ops-scheduler.js sendWeeklyCeoMessage not defined
**File:** ops-scheduler.js line 1106
**Issue:** `sendWeeklyCeoMessage()` is called in tick() but never defined in the file.

### Bug 13: ops-database.js missing moveTask function
**File:** ops.js line 519
**Issue:** `opsDb.moveTask()` is called but not defined/exported in ops-database.js.

### Bug 14: ops-database.js missing addMaintenanceLog
**File:** ops.js executeTool
**Issue:** ops.js calls `opsDb.addMaintenanceLog()` but it's in ops-database-v5.js, not ops-database.js.

## AI SYSTEM PROMPT ISSUES

### Issue 1: Prompt is too basic
The current buildSystemPrompt() is only ~15 lines. It doesn't tell the AI about:
- All 49 features available
- Team members and their roles
- Topic purposes and what each thread is for
- Task history and current state
- How to use tools proactively
- Conversation context from the thread

### Issue 2: Memory is in-RAM only
conversationMemory is a Map() that resets on every deploy. No persistence.

### Issue 3: AI tools are incomplete
Only 7 tools defined. Missing: expense logging, occupancy updates, approval creation, follow-up creation, vendor follow-up, etc.
