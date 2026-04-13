/**
 * Activity Logger — Silent Team Activity Tracking
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Silently logs all non-command messages from team members in the
 * ops group into the activity_log table.
 *
 * Also performs smart photo-to-task matching: when a photo with a
 * caption is received, it compares the caption against all pending
 * tasks and silently links the photo as evidence if a match is found.
 *
 * The bot NEVER replies or acknowledges these messages.
 */

const opsDb = require('./ops-database');
const { resolveTeamMember, getDisplayName } = require('../team-members');
const log = require('../utils/logger');

// ─── Keyword extraction helpers ──────────────────────────────

/**
 * Tokenise a string into lowercase words, stripping punctuation.
 * Short words (≤ 2 chars) and common stop-words are excluded.
 */
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'to', 'of', 'in', 'on',
  'at', 'by', 'for', 'with', 'as', 'from', 'into', 'and', 'or', 'but',
  'not', 'no', 'so', 'if', 'it', 'its', 'this', 'that', 'we', 'i',
  'my', 'our', 'your', 'their', 'his', 'her', 'up', 'out', 'all',
  'just', 'now', 'also', 'very', 'more', 'some', 'any', 'per', 'am',
]);

function tokenise(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

/**
 * Compute a simple Jaccard-like overlap score between two token sets.
 * Returns a value between 0 (no overlap) and 1 (identical).
 */
function overlapScore(tokensA, tokensB) {
  if (!tokensA.length || !tokensB.length) return 0;
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/**
 * Check whether a caption token appears as a substring inside any task token,
 * or vice versa. This handles cases like "cleaning" matching "clean".
 */
function partialMatch(tokensA, tokensB) {
  for (const a of tokensA) {
    for (const b of tokensB) {
      if (a.includes(b) || b.includes(a)) return true;
    }
  }
  return false;
}

// ─── Match threshold ─────────────────────────────────────────
// A score ≥ MATCH_THRESHOLD or at least MIN_SHARED_TOKENS shared
// tokens triggers a link.
const MATCH_THRESHOLD = 0.12;
const MIN_SHARED_TOKENS = 2;

/**
 * Find the best-matching pending task for a given caption.
 * Returns { task, score } or null if no match meets the threshold.
 */
function findMatchingTask(caption, tasks) {
  if (!caption || !tasks || tasks.length === 0) return null;

  const captionTokens = tokenise(caption);
  if (captionTokens.length === 0) return null;

  let best = null;
  let bestScore = 0;

  for (const task of tasks) {
    const taskTokens = tokenise((task.title || '') + ' ' + (task.description || ''));
    if (taskTokens.length === 0) continue;

    const score = overlapScore(captionTokens, taskTokens);
    const hasPartial = partialMatch(captionTokens, taskTokens);

    // Count shared tokens
    const setCaption = new Set(captionTokens);
    const setTask = new Set(taskTokens);
    let shared = 0;
    for (const t of setCaption) { if (setTask.has(t)) shared++; }

    const qualifies = score >= MATCH_THRESHOLD || (hasPartial && shared >= 1) || shared >= MIN_SHARED_TOKENS;

    if (qualifies && score > bestScore) {
      bestScore = score;
      best = { task, score };
    }
  }

  return best;
}

// ─── KSA time formatter ──────────────────────────────────────

function ksaTimeString(utcDateStr) {
  // utcDateStr is SQLite datetime: "YYYY-MM-DD HH:MM:SS"
  const d = utcDateStr ? new Date(utcDateStr.replace(' ', 'T') + 'Z') : new Date();
  const ksa = new Date(d.getTime() + 3 * 60 * 60 * 1000);
  const h = ksa.getUTCHours();
  const m = String(ksa.getUTCMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

// ─── Main exported functions ─────────────────────────────────

/**
 * Silently log a text message from a team member.
 * Call this from the bot.on('text') handler AFTER the ops group check.
 * Does NOT reply to the user.
 */
function logTextActivity(ctx) {
  try {
    const chatId = ctx.chat.id;
    const threadId = ctx.message?.message_thread_id || null;
    const from = ctx.message?.from;
    if (!from || from.is_bot) return;

    const username = from.username || null;
    const displayName = username
      ? getDisplayName(username)
      : [from.first_name, from.last_name].filter(Boolean).join(' ') || 'Unknown';

    const text = ctx.message.text || '';
    if (!text.trim()) return;

    opsDb.logActivity(chatId, threadId, username, displayName, 'text', text, null);
    log.info('ActivityLog', `[text] ${displayName}: ${text.substring(0, 60)}`);
  } catch (e) {
    log.error('ActivityLog', 'logTextActivity failed', { error: e.message });
  }
}

/**
 * Silently log a photo message and attempt smart task matching.
 * If a matching pending task is found, silently link the photo as evidence.
 * Does NOT reply to the user.
 */
function logPhotoActivity(ctx) {
  try {
    const chatId = ctx.chat.id;
    const threadId = ctx.message?.message_thread_id || null;
    const from = ctx.message?.from;
    if (!from || from.is_bot) return;

    const username = from.username || null;
    const displayName = username
      ? getDisplayName(username)
      : [from.first_name, from.last_name].filter(Boolean).join(' ') || 'Unknown';

    // Get the highest-resolution photo file_id
    const photos = ctx.message.photo;
    const fileId = photos && photos.length > 0 ? photos[photos.length - 1].file_id : null;
    const caption = ctx.message.caption || null;

    // Log the activity
    opsDb.logActivity(chatId, threadId, username, displayName, 'photo', caption, fileId);
    log.info('ActivityLog', `[photo] ${displayName}: ${(caption || '(no caption)').substring(0, 60)}`);

    // Smart task matching — only if there is a caption
    if (caption && fileId) {
      try {
        const pendingTasks = opsDb.getAllPendingTasks(chatId);
        const match = findMatchingTask(caption, pendingTasks);

        if (match) {
          opsDb.addTaskEvidence(match.task.id, fileId, caption, displayName);
          log.info('ActivityLog', `[photo-evidence] Linked photo to task #${match.task.id} "${match.task.title}" (score: ${match.score.toFixed(2)}) by ${displayName}`);
        }
      } catch (matchErr) {
        log.error('ActivityLog', 'Task matching failed', { error: matchErr.message });
      }
    }
  } catch (e) {
    log.error('ActivityLog', 'logPhotoActivity failed', { error: e.message });
  }
}

/**
 * Silently log a voice/audio message.
 */
function logVoiceActivity(ctx) {
  try {
    const chatId = ctx.chat.id;
    const threadId = ctx.message?.message_thread_id || null;
    const from = ctx.message?.from;
    if (!from || from.is_bot) return;

    const username = from.username || null;
    const displayName = username
      ? getDisplayName(username)
      : [from.first_name, from.last_name].filter(Boolean).join(' ') || 'Unknown';

    const voice = ctx.message.voice || ctx.message.audio;
    const fileId = voice?.file_id || null;
    const duration = voice?.duration ? `${voice.duration}s` : null;
    const caption = ctx.message.caption || (duration ? `Voice note (${duration})` : 'Voice note');

    opsDb.logActivity(chatId, threadId, username, displayName, 'voice', caption, fileId);
    log.info('ActivityLog', `[voice] ${displayName}: ${caption}`);
  } catch (e) {
    log.error('ActivityLog', 'logVoiceActivity failed', { error: e.message });
  }
}

/**
 * Silently log a document/file message.
 */
function logDocumentActivity(ctx) {
  try {
    const chatId = ctx.chat.id;
    const threadId = ctx.message?.message_thread_id || null;
    const from = ctx.message?.from;
    if (!from || from.is_bot) return;

    const username = from.username || null;
    const displayName = username
      ? getDisplayName(username)
      : [from.first_name, from.last_name].filter(Boolean).join(' ') || 'Unknown';

    const doc = ctx.message.document || ctx.message.video;
    const fileId = doc?.file_id || null;
    const fileName = doc?.file_name || doc?.mime_type || 'file';
    const caption = ctx.message.caption || `Document: ${fileName}`;

    opsDb.logActivity(chatId, threadId, username, displayName, 'document', caption, fileId);
    log.info('ActivityLog', `[document] ${displayName}: ${caption.substring(0, 60)}`);
  } catch (e) {
    log.error('ActivityLog', 'logDocumentActivity failed', { error: e.message });
  }
}

/**
 * Format today's activity log into a bilingual report section.
 * Returns a string ready to append to the daily report, or null if no activity.
 */
function formatActivityReportSection(chatId) {
  try {
    const entries = opsDb.getTodayActivity(chatId);
    if (!entries || entries.length === 0) return null;

    // Group by display name
    const byUser = {};
    for (const e of entries) {
      const name = e.user_display_name || e.user_username || 'Unknown';
      if (!byUser[name]) byUser[name] = [];
      byUser[name].push(e);
    }

    const typeEmoji = { text: '💬', photo: '📸', voice: '🎙️', document: '📎' };

    // English section
    let en = `👥 *Team Activity Log (${entries.length} updates):*\n`;
    for (const [name, items] of Object.entries(byUser)) {
      en += `\n  👤 *${name}* (${items.length}):\n`;
      for (const item of items) {
        const time = ksaTimeString(item.timestamp);
        const emoji = typeEmoji[item.message_type] || '💬';
        const text = (item.caption_or_text || '').substring(0, 80);
        const ellipsis = (item.caption_or_text || '').length > 80 ? '…' : '';
        en += `    ${emoji} ${text}${ellipsis} — _${time}_\n`;
      }
    }

    // Arabic section
    let ar = `👥 *سجل نشاط الفريق (${entries.length} تحديث):*\n`;
    for (const [name, items] of Object.entries(byUser)) {
      ar += `\n  👤 *${name}* (${items.length}):\n`;
      for (const item of items) {
        const time = ksaTimeString(item.timestamp);
        const emoji = typeEmoji[item.message_type] || '💬';
        const text = (item.caption_or_text || '').substring(0, 80);
        const ellipsis = (item.caption_or_text || '').length > 80 ? '…' : '';
        ar += `    ${emoji} ${text}${ellipsis} — _${time}_\n`;
      }
    }

    return `${en}\n━━━━━━━━━━━━━━\n${ar}`;
  } catch (e) {
    log.error('ActivityLog', 'formatActivityReportSection failed', { error: e.message });
    return null;
  }
}

/**
 * Format today's task evidence into a bilingual report section.
 * Returns a string ready to append to the daily report, or null if no evidence.
 */
function formatEvidenceReportSection(chatId) {
  try {
    const evidence = opsDb.getTodayTaskEvidence(chatId);
    if (!evidence || evidence.length === 0) return null;

    // Group by task
    const byTask = {};
    for (const e of evidence) {
      const key = `#${e.task_id}: ${e.task_title}`;
      if (!byTask[key]) byTask[key] = [];
      byTask[key].push(e);
    }

    let en = `📸 *Photo Evidence Received Today (${evidence.length}):*\n`;
    for (const [taskLabel, items] of Object.entries(byTask)) {
      en += `\n  📌 *${taskLabel}*\n`;
      for (const item of items) {
        const time = ksaTimeString(item.submitted_at);
        const caption = (item.caption || '').substring(0, 80);
        en += `    📸 "${caption}" — _${item.submitted_by || 'Unknown'}_ at _${time}_\n`;
      }
    }

    let ar = `📸 *صور الإثبات المستلمة اليوم (${evidence.length}):*\n`;
    for (const [taskLabel, items] of Object.entries(byTask)) {
      ar += `\n  📌 *${taskLabel}*\n`;
      for (const item of items) {
        const time = ksaTimeString(item.submitted_at);
        const caption = (item.caption || '').substring(0, 80);
        ar += `    📸 "${caption}" — _${item.submitted_by || 'غير معروف'}_ الساعة _${time}_\n`;
      }
    }

    return `${en}\n━━━━━━━━━━━━━━\n${ar}`;
  } catch (e) {
    log.error('ActivityLog', 'formatEvidenceReportSection failed', { error: e.message });
    return null;
  }
}

module.exports = {
  logTextActivity,
  logPhotoActivity,
  logVoiceActivity,
  logDocumentActivity,
  formatActivityReportSection,
  formatEvidenceReportSection,
  // Exposed for testing
  findMatchingTask,
  tokenise,
};
