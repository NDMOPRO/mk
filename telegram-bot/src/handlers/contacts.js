/**
 * Contact Management System — Monthly Key Operations HQ
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * Commands:
 *   /addcontact          — Conversational wizard to add a new contact
 *   /contacts            — List all contacts
 *   /contact search X    — Search contacts by name
 *   /contact type X      — Filter contacts by type/profession
 *   /contact نوع X       — Same in Arabic
 *   /deletecontact #C1   — Delete a contact (admin only)
 *   /editcontact #C1     — Edit a contact via conversational flow
 *
 * All responses are bilingual (English + Arabic).
 */

const opsDb = require('../services/ops-database');
const { getDisplayName, isTeamAdmin } = require('../team-members');
const log = require('../utils/logger');

// ─── Constants ──────────────────────────────────────────────
const OPS_GROUP_ID = -1003967447285;
const DIV = '━━━━━━━━━━━━━━━━━━━━';
const CONTACTS_TOPIC_NAME = '04 — Contacts | جهات الاتصال 📇';

// In-memory cache for the contacts topic thread ID
let contactsTopicThreadId = null;

// In-memory session store for conversational flows (keyed by `chatId:userId`)
const sessions = {};
const SESSION_TTL_MS = 15 * 60 * 1000; // 15 minutes

// Clean up abandoned sessions every 5 minutes
let _sessionCleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const key of Object.keys(sessions)) {
    if (sessions[key].lastActivity && now - sessions[key].lastActivity > SESSION_TTL_MS) {
      delete sessions[key];
    }
  }
}, 5 * 60 * 1000);
// Allow Node to exit even if this interval is still running
if (_sessionCleanupInterval.unref) _sessionCleanupInterval.unref();

function sessionKey(ctx) {
  return `${ctx.chat.id}:${ctx.from.id}`;
}

// ─── Helpers ────────────────────────────────────────────────

function escMd(text) {
  if (!text) return '';
  return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

/**
 * Detect language from text — returns 'ar' if mostly Arabic characters, else 'en'.
 */
function detectLang(text) {
  if (!text) return 'en';
  const arabicChars = (text.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g) || []).length;
  const latinChars = (text.match(/[a-zA-Z]/g) || []).length;
  return arabicChars > latinChars ? 'ar' : 'en';
}

/**
 * Format a KSA datetime string from a UTC SQLite datetime.
 */
function ksaDateStr(utcStr) {
  if (!utcStr) return 'N/A';
  const d = new Date(utcStr.replace(' ', 'T') + 'Z');
  const ksa = new Date(d.getTime() + 3 * 60 * 60 * 1000);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[ksa.getUTCMonth()]} ${ksa.getUTCDate()}, ${ksa.getUTCFullYear()}`;
}

/**
 * Build a bilingual contact card for display.
 */
function formatContactCard(contact) {
  const id = `#C${contact.id}`;
  let card = `${DIV}\n`;
  card += `📇 *Contact ${id}*\n`;
  card += `*Name | الاسم:* ${contact.name}\n`;
  card += `*Phone | الهاتف:* \`${contact.phone}\`\n`;
  if (contact.email) {
    card += `*Email | البريد:* ${contact.email}\n`;
  }
  if (contact.contact_type) {
    card += `*Type | النوع:* ${contact.contact_type}\n`;
  }
  if (contact.notes) {
    card += `*Notes | ملاحظات:* ${contact.notes}\n`;
  }
  if (contact.added_by_name) {
    card += `*Added by | أضافه:* ${contact.added_by_name}\n`;
  }
  card += `*Date | التاريخ:* ${ksaDateStr(contact.created_at)}\n`;
  card += DIV;
  return card;
}

// ─── Topic Management ───────────────────────────────────────

/**
 * Get or create the Contacts forum topic.
 * Returns the thread_id (message_thread_id) for posting contact cards.
 */
async function getOrCreateContactsTopic(bot) {
  // 1. Check in-memory cache
  if (contactsTopicThreadId) return contactsTopicThreadId;

  // 2. Check database (bot_state)
  const savedId = opsDb.getBotState('contacts_topic_thread_id');
  if (savedId) {
    const tid = parseInt(savedId);
    // Verify it still exists by sending a silent action (or just trust it for now)
    try {
      // We'll trust the DB ID if it exists. If it fails later, the error handler will catch it.
      contactsTopicThreadId = tid;
      return tid;
    } catch (e) {
      log.error('Contacts', `Saved topic thread ${tid} is invalid: ${e.message}`);
    }
  }

  // 3. Create new topic if none found or valid
  try {
    const result = await bot.telegram.createForumTopic(OPS_GROUP_ID, CONTACTS_TOPIC_NAME, {
      icon_custom_emoji_id: undefined,
    });
    contactsTopicThreadId = result.message_thread_id;
    
    // Save to DB immediately
    opsDb.setBotState('contacts_topic_thread_id', contactsTopicThreadId.toString());
    
    log.info('Contacts', `Created new contacts topic: thread ${contactsTopicThreadId}`);
    return contactsTopicThreadId;
  } catch (e) {
    log.error('Contacts', `Could not create contacts topic: ${e.message}`);
    return null;
  }
}

/**
 * Set the contacts topic thread ID externally (e.g., from env or config).
 */
function setContactsTopicThread(threadId) {
  if (threadId) {
    contactsTopicThreadId = threadId;
    // Also persist to DB so restarts without the env var still work
    try {
      opsDb.setBotState('contacts_topic_thread_id', threadId.toString());
    } catch (e) {
      log.error('Contacts', `Failed to persist topic thread ID to DB: ${e.message}`);
    }
  }
}

// ─── Google Sheets Sync ─────────────────────────────────────

async function syncContactToSheets(contact, action) {
  try {
    const googleSync = require('../services/google-sync');
    if (!googleSync.isConfigured()) return;

    const contactData = {
      id: contact.id,
      name: contact.name,
      phone: contact.phone,
      email: contact.email || '',
      type: contact.contact_type || '',
      notes: contact.notes || '',
      added_by: contact.added_by_name || '',
      created_at: contact.created_at || '',
    };

    await googleSync.syncContact(contactData, action);
    log.info('Contacts', `Synced contact #C${contact.id} to Google Sheets (${action})`);
  } catch (e) {
    log.error('Contacts', `Google Sheets sync failed: ${e.message}`);
  }
}

// ─── Post Contact Card to Topic ─────────────────────────────

async function postContactCard(bot, contact) {
  try {
    const threadId = await getOrCreateContactsTopic(bot);
    const card = formatContactCard(contact);
    const opts = { parse_mode: 'Markdown' };
    if (threadId) opts.message_thread_id = threadId;

    const sent = await bot.telegram.sendMessage(OPS_GROUP_ID, card, opts);
    // Store the message ID for future reference
    opsDb.updateContactMessageId(contact.id, sent.message_id);
    return sent;
  } catch (e) {
    log.error('Contacts', `Failed to post contact card: ${e.message}`);
    return null;
  }
}

// ─── Conversational Flow Steps ──────────────────────────────

const STEPS = {
  NAME: 'name',
  PHONE: 'phone',
  EMAIL: 'email',
  TYPE: 'type',
  NOTES: 'notes',
  CONFIRM: 'confirm',
};

function getPrompt(step, lang) {
  const prompts = {
    [STEPS.NAME]: {
      en: '👤 *What is the contact\'s full name?*',
      ar: '👤 *ما اسم جهة الاتصال بالكامل؟*',
    },
    [STEPS.PHONE]: {
      en: '📱 *What is their phone number?* (Required)\nExample: +966 55 123 4567',
      ar: '📱 *ما رقم الهاتف؟* (مطلوب)\nمثال: +966 55 123 4567',
    },
    [STEPS.EMAIL]: {
      en: '📧 *What is their email?*\nType "skip" to skip.',
      ar: '📧 *ما البريد الإلكتروني؟*\nاكتب "تخطي" أو "skip" للتخطي.',
    },
    [STEPS.TYPE]: {
      en: '🏷️ *What do they do?*\n(e.g., Plumber, Tenant, AC Technician, Lawyer, Vendor)',
      ar: '🏷️ *ما طبيعة عمله؟*\n(مثال: سباك، مستأجر، فني تكييف، محامي، مورد)',
    },
    [STEPS.NOTES]: {
      en: '📝 *Any notes?*\nType "skip" to skip.',
      ar: '📝 *أي ملاحظات؟*\nاكتب "تخطي" أو "skip" للتخطي.',
    },
  };
  const p = prompts[step];
  if (!p) return '';
  if (lang === 'ar') return `${p.ar}\n\n${p.en}`;
  return `${p.en}\n\n${p.ar}`;
}

// ─── /addcontact Command ────────────────────────────────────

async function handleAddContact(ctx) {
  const key = sessionKey(ctx);
  const userText = (ctx.message.text || '').replace(/^\/addcontact(?:@\S+)?\s*/, '').trim();
  const lang = detectLang(userText || ctx.from?.language_code || 'en');

  sessions[key] = {
    mode: 'add',
    step: STEPS.NAME,
    lang,
    data: {},
    lastActivity: Date.now(),
  };

  const prompt = getPrompt(STEPS.NAME, lang);
  const threadId = ctx.message?.message_thread_id;
  await ctx.reply(prompt, {
    parse_mode: 'Markdown',
    ...(threadId ? { message_thread_id: threadId } : {}),
  });
}

// ─── /editcontact Command ───────────────────────────────────

async function handleEditContact(ctx) {
  const text = (ctx.message.text || '').replace(/^\/editcontact(?:@\S+)?\s*/, '').trim();
  const threadId = ctx.message?.message_thread_id;

  // Extract contact ID: #C1, C1, or just 1
  const idMatch = text.match(/#?C?(\d+)/i);
  if (!idMatch) {
    return ctx.reply(
      `❌ *Please specify a contact ID.*\nFormat: /editcontact #C1\n\n${DIV}\n\n❌ *يرجى تحديد رقم جهة الاتصال.*\nالصيغة: /editcontact #C1`,
      { parse_mode: 'Markdown', ...(threadId ? { message_thread_id: threadId } : {}) }
    );
  }

  const contactId = parseInt(idMatch[1]);
  const contact = opsDb.getContactById(contactId);
  if (!contact) {
    return ctx.reply(
      `❌ *Contact #C${contactId} not found.*\n\n${DIV}\n\n❌ *جهة الاتصال #C${contactId} غير موجودة.*`,
      { parse_mode: 'Markdown', ...(threadId ? { message_thread_id: threadId } : {}) }
    );
  }

  const key = sessionKey(ctx);
  const lang = detectLang(text || 'en');

  sessions[key] = {
    mode: 'edit',
    step: STEPS.NAME,
    lang,
    contactId,
    lastActivity: Date.now(),
    data: {
      name: contact.name,
      phone: contact.phone,
      email: contact.email,
      contact_type: contact.contact_type,
      notes: contact.notes,
    },
  };

  const currentCard = formatContactCard(contact);
  const editMsg = lang === 'ar'
    ? `✏️ *تعديل جهة الاتصال #C${contactId}:*\n\n${currentCard}\n\n👤 *ما الاسم الجديد؟*\nاكتب "keep" أو "ابقاء" للإبقاء على الحالي.`
    : `✏️ *Editing Contact #C${contactId}:*\n\n${currentCard}\n\n👤 *What is the new name?*\nType "keep" to keep the current value.`;

  await ctx.reply(editMsg, {
    parse_mode: 'Markdown',
    ...(threadId ? { message_thread_id: threadId } : {}),
  });
}

// ─── /deletecontact Command ─────────────────────────────────

async function handleDeleteContact(ctx) {
  const text = (ctx.message.text || '').replace(/^\/deletecontact(?:@\S+)?\s*/, '').trim();
  const threadId = ctx.message?.message_thread_id;
  const username = ctx.from?.username?.toLowerCase();

  // Admin check
  if (!isTeamAdmin(username)) {
    return ctx.reply(
      `🔒 *Only admins can delete contacts.*\n\n${DIV}\n\n🔒 *فقط المسؤولون يمكنهم حذف جهات الاتصال.*`,
      { parse_mode: 'Markdown', ...(threadId ? { message_thread_id: threadId } : {}) }
    );
  }

  const idMatch = text.match(/#?C?(\d+)/i);
  if (!idMatch) {
    return ctx.reply(
      `❌ *Please specify a contact ID.*\nFormat: /deletecontact #C1\n\n${DIV}\n\n❌ *يرجى تحديد رقم جهة الاتصال.*\nالصيغة: /deletecontact #C1`,
      { parse_mode: 'Markdown', ...(threadId ? { message_thread_id: threadId } : {}) }
    );
  }

  const contactId = parseInt(idMatch[1]);
  const contact = opsDb.getContactById(contactId);
  if (!contact) {
    return ctx.reply(
      `❌ *Contact #C${contactId} not found.*\n\n${DIV}\n\n❌ *جهة الاتصال #C${contactId} غير موجودة.*`,
      { parse_mode: 'Markdown', ...(threadId ? { message_thread_id: threadId } : {}) }
    );
  }

  // Delete from DB
  opsDb.deleteContact(contactId);

  // Try to delete the card message from the topic
  if (contact.topic_message_id) {
    try {
      await ctx.telegram.deleteMessage(OPS_GROUP_ID, contact.topic_message_id);
    } catch (e) {
      log.error('Contacts', `Could not delete topic message: ${e.message}`);
    }
  }

  // Sync deletion to Google Sheets
  syncContactToSheets(contact, 'delete');

  const deleterName = getDisplayName(username);
  return ctx.reply(
    `🗑️ *Contact #C${contactId} deleted.*\n📇 ${contact.name} — ${contact.phone}\nDeleted by: ${deleterName}\n\n${DIV}\n\n🗑️ *تم حذف جهة الاتصال #C${contactId}.*\n📇 ${contact.name} — ${contact.phone}\nحذفه: ${deleterName}`,
    { parse_mode: 'Markdown', ...(threadId ? { message_thread_id: threadId } : {}) }
  );
}

// ─── /contacts Command ──────────────────────────────────────

async function handleContacts(ctx) {
  const threadId = ctx.message?.message_thread_id;
  const contacts = opsDb.getAllContacts(OPS_GROUP_ID);

  if (!contacts || contacts.length === 0) {
    return ctx.reply(
      `📇 *No contacts saved yet.*\nUse /addcontact to add one.\n\n${DIV}\n\n📇 *لا توجد جهات اتصال محفوظة بعد.*\nاستخدم /addcontact لإضافة واحدة.`,
      { parse_mode: 'Markdown', ...(threadId ? { message_thread_id: threadId } : {}) }
    );
  }

  let msg = `📇 *All Contacts (${contacts.length}):*\n📇 *جميع جهات الاتصال (${contacts.length}):*\n\n`;
  for (const c of contacts.slice(0, 30)) {
    msg += formatContactCard(c) + '\n\n';
  }
  if (contacts.length > 30) {
    msg += `_...and ${contacts.length - 30} more_\n_...و${contacts.length - 30} أخرى_`;
  }

  // Split into chunks if too long
  if (msg.length > 4000) {
    const chunks = splitMessage(msg, 4000);
    for (const chunk of chunks) {
      await ctx.reply(chunk, { parse_mode: 'Markdown', ...(threadId ? { message_thread_id: threadId } : {}) });
    }
  } else {
    await ctx.reply(msg, { parse_mode: 'Markdown', ...(threadId ? { message_thread_id: threadId } : {}) });
  }
}

// ─── /contact search/type Command ───────────────────────────

async function handleContactSearch(ctx) {
  const text = (ctx.message.text || '').replace(/^\/contact(?:@\S+)?\s*/, '').trim();
  const threadId = ctx.message?.message_thread_id;

  if (!text) {
    return ctx.reply(
      `📇 *Contact Search:*\n• /contact search Ahmed\n• /contact type plumber\n• /contact نوع سباك\n\n${DIV}\n\n📇 *بحث جهات الاتصال:*\n• /contact search أحمد\n• /contact type سباك\n• /contact نوع مستأجر`,
      { parse_mode: 'Markdown', ...(threadId ? { message_thread_id: threadId } : {}) }
    );
  }

  let results = [];
  let searchLabel = '';

  // Parse: "search X", "type X", "نوع X"
  const searchMatch = text.match(/^search\s+(.+)/i);
  const typeMatch = text.match(/^(?:type|نوع)\s+(.+)/i);

  if (searchMatch) {
    const query = searchMatch[1].trim();
    results = opsDb.searchContactsByName(OPS_GROUP_ID, query);
    searchLabel = `🔍 Search: "${query}" | بحث: "${query}"`;
  } else if (typeMatch) {
    const query = typeMatch[1].trim();
    results = opsDb.searchContactsByType(OPS_GROUP_ID, query);
    searchLabel = `🏷️ Type: "${query}" | النوع: "${query}"`;
  } else {
    // Default: treat as name search
    results = opsDb.searchContactsByName(OPS_GROUP_ID, text);
    searchLabel = `🔍 Search: "${text}" | بحث: "${text}"`;
  }

  if (!results || results.length === 0) {
    return ctx.reply(
      `${searchLabel}\n\n❌ *No contacts found.*\n\n${DIV}\n\n❌ *لم يتم العثور على جهات اتصال.*`,
      { parse_mode: 'Markdown', ...(threadId ? { message_thread_id: threadId } : {}) }
    );
  }

  let msg = `${searchLabel}\n📇 *${results.length} contact(s) found | ${results.length} جهة اتصال:*\n\n`;
  for (const c of results.slice(0, 20)) {
    msg += formatContactCard(c) + '\n\n';
  }

  if (msg.length > 4000) {
    const chunks = splitMessage(msg, 4000);
    for (const chunk of chunks) {
      await ctx.reply(chunk, { parse_mode: 'Markdown', ...(threadId ? { message_thread_id: threadId } : {}) });
    }
  } else {
    await ctx.reply(msg, { parse_mode: 'Markdown', ...(threadId ? { message_thread_id: threadId } : {}) });
  }
}

// ─── Conversational Text Handler ────────────────────────────

/**
 * Handle text input during an active add/edit contact session.
 * Returns true if the message was consumed, false otherwise.
 */
async function handleContactTextInput(ctx, bot) {
  const key = sessionKey(ctx);
  const session = sessions[key];
  if (!session) return false;

  const text = (ctx.message.text || '').trim();
  const threadId = ctx.message?.message_thread_id;
  const lang = session.lang;
  const isEdit = session.mode === 'edit';
  const isSkip = /^(skip|تخطي|تخطى)$/i.test(text);
  const isKeep = /^(keep|ابقاء|إبقاء|ابقي)$/i.test(text);
  const isCancel = /^(cancel|إلغاء|الغاء)$/i.test(text);

  // Cancel at any point
  if (isCancel) {
    delete sessions[key];
    return ctx.reply(
      `❌ *Cancelled.*\n\n${DIV}\n\n❌ *تم الإلغاء.*`,
      { parse_mode: 'Markdown', ...(threadId ? { message_thread_id: threadId } : {}) }
    ).then(() => true);
  }

  const replyOpts = { parse_mode: 'Markdown', ...(threadId ? { message_thread_id: threadId } : {}) };

  // Refresh TTL on each interaction
  session.lastActivity = Date.now();

  switch (session.step) {
    case STEPS.NAME: {
      if (isEdit && isKeep) {
        // Keep current name
      } else if (!text || isSkip) {
        await ctx.reply(
          lang === 'ar'
            ? '❌ *الاسم مطلوب. يرجى إدخال الاسم.*'
            : '❌ *Name is required. Please enter the name.*',
          replyOpts
        );
        return true;
      } else {
        session.data.name = text;
      }
      session.step = STEPS.PHONE;
      const phonePrompt = isEdit
        ? (lang === 'ar'
          ? `📱 *ما رقم الهاتف الجديد؟* (الحالي: \`${session.data.phone}\`)\nاكتب "keep" أو "ابقاء" للإبقاء.`
          : `📱 *New phone number?* (Current: \`${session.data.phone}\`)\nType "keep" to keep.`)
        : getPrompt(STEPS.PHONE, lang);
      await ctx.reply(phonePrompt, replyOpts);
      return true;
    }

    case STEPS.PHONE: {
      if (isEdit && isKeep) {
        // Keep current phone
      } else if (!text || isSkip) {
        await ctx.reply(
          lang === 'ar'
            ? '❌ *رقم الهاتف مطلوب ولا يمكن تخطيه.*\n📱 يرجى إدخال رقم الهاتف.'
            : '❌ *Phone number is required and cannot be skipped.*\n📱 Please enter the phone number.',
          replyOpts
        );
        return true;
      } else {
        session.data.phone = text;
      }
      session.step = STEPS.EMAIL;
      const emailPrompt = isEdit
        ? (lang === 'ar'
          ? `📧 *ما البريد الإلكتروني الجديد؟* (الحالي: ${session.data.email || 'لا يوجد'})\nاكتب "skip" أو "تخطي" للتخطي، أو "keep" أو "ابقاء" للإبقاء.`
          : `📧 *New email?* (Current: ${session.data.email || 'none'})\nType "skip" to clear, or "keep" to keep.`)
        : getPrompt(STEPS.EMAIL, lang);
      await ctx.reply(emailPrompt, replyOpts);
      return true;
    }

    case STEPS.EMAIL: {
      if (isEdit && isKeep) {
        // Keep current email
      } else if (isSkip) {
        if (!isEdit) session.data.email = null;
      } else {
        session.data.email = text;
      }
      session.step = STEPS.TYPE;
      const typePrompt = isEdit
        ? (lang === 'ar'
          ? `🏷️ *ما النوع الجديد؟* (الحالي: ${session.data.contact_type || 'لا يوجد'})\nاكتب "keep" أو "ابقاء" للإبقاء.`
          : `🏷️ *New type?* (Current: ${session.data.contact_type || 'none'})\nType "keep" to keep.`)
        : getPrompt(STEPS.TYPE, lang);
      await ctx.reply(typePrompt, replyOpts);
      return true;
    }

    case STEPS.TYPE: {
      if (isEdit && isKeep) {
        // Keep current type
      } else if (isSkip) {
        if (!isEdit) session.data.contact_type = null;
      } else {
        session.data.contact_type = text;
      }
      session.step = STEPS.NOTES;
      const notesPrompt = isEdit
        ? (lang === 'ar'
          ? `📝 *أي ملاحظات جديدة؟* (الحالي: ${session.data.notes || 'لا يوجد'})\nاكتب "skip" أو "تخطي" للتخطي، أو "keep" أو "ابقاء" للإبقاء.`
          : `📝 *New notes?* (Current: ${session.data.notes || 'none'})\nType "skip" to clear, or "keep" to keep.`)
        : getPrompt(STEPS.NOTES, lang);
      await ctx.reply(notesPrompt, replyOpts);
      return true;
    }

    case STEPS.NOTES: {
      if (isEdit && isKeep) {
        // Keep current notes
      } else if (isSkip) {
        if (!isEdit) session.data.notes = null;
      } else {
        session.data.notes = text;
      }
      session.step = STEPS.CONFIRM;

      // Show summary and ask for confirmation
      const d = session.data;
      const summary = `📇 *Contact Summary | ملخص جهة الاتصال:*\n\n`
        + `*Name | الاسم:* ${d.name}\n`
        + `*Phone | الهاتف:* \`${d.phone}\`\n`
        + `*Email | البريد:* ${d.email || '—'}\n`
        + `*Type | النوع:* ${d.contact_type || '—'}\n`
        + `*Notes | ملاحظات:* ${d.notes || '—'}\n\n`
        + (lang === 'ar'
          ? '✅ اكتب "yes" أو "نعم" للحفظ، أو "cancel" أو "إلغاء" للإلغاء.'
          : '✅ Type "yes" or "نعم" to save, or "cancel" to cancel.');

      await ctx.reply(summary, replyOpts);
      return true;
    }

    case STEPS.CONFIRM: {
      const isYes = /^(yes|y|نعم|اي|أي|ok|اوكي|حفظ|save)$/i.test(text);
      if (!isYes) {
        delete sessions[key];
        await ctx.reply(
          `❌ *Cancelled.*\n\n${DIV}\n\n❌ *تم الإلغاء.*`,
          replyOpts
        );
        return true;
      }

      const username = ctx.from?.username || null;
      const addedByName = getDisplayName(username);

      if (isEdit) {
        // Update existing contact
        opsDb.updateContact(session.contactId, session.data);
        const updated = opsDb.getContactById(session.contactId);

        // Re-post the card to the topic (delete old, post new)
        if (updated.topic_message_id) {
          try { await ctx.telegram.deleteMessage(OPS_GROUP_ID, updated.topic_message_id); } catch (e) {}
        }
        await postContactCard(bot || ctx.telegram, updated);

        // Sync to Google Sheets
        syncContactToSheets(updated, 'update');

        delete sessions[key];

        const card = formatContactCard(updated);
        await ctx.reply(
          `✅ *Contact #C${session.contactId} updated!*\n\n${card}\n\n${DIV}\n\n✅ *تم تحديث جهة الاتصال #C${session.contactId}!*`,
          replyOpts
        );
      } else {
        // Add new contact
        const d = session.data;
        const contactId = opsDb.addContact(OPS_GROUP_ID, {
          name: d.name,
          phone: d.phone,
          email: d.email,
          contact_type: d.contact_type,
          notes: d.notes,
          added_by_username: username,
          added_by_name: addedByName,
        });

        const newContact = opsDb.getContactById(contactId);

        // Post card to the contacts topic
        await postContactCard(bot || ctx.telegram, newContact);

        // Sync to Google Sheets
        syncContactToSheets(newContact, 'add');

        delete sessions[key];

        const card = formatContactCard(newContact);
        await ctx.reply(
          `✅ *Contact #C${contactId} saved!*\nCard posted to the Contacts topic.\n\n${card}\n\n${DIV}\n\n✅ *تم حفظ جهة الاتصال #C${contactId}!*\nتم نشر البطاقة في موضوع جهات الاتصال.`,
          replyOpts
        );
      }

      return true;
    }

    default: {
      delete sessions[key];
      return false;
    }
  }
}

/**
 * Check if a user has an active contact session.
 */
function hasActiveSession(ctx) {
  return !!sessions[sessionKey(ctx)];
}

// ─── Message Splitting Helper ───────────────────────────────

function splitMessage(text, maxLen) {
  const chunks = [];
  let remaining = text;
  while (remaining.length > maxLen) {
    let splitAt = remaining.lastIndexOf('\n', maxLen);
    if (splitAt < maxLen / 2) splitAt = maxLen;
    chunks.push(remaining.substring(0, splitAt));
    remaining = remaining.substring(splitAt);
  }
  if (remaining.trim()) chunks.push(remaining);
  return chunks;
}

// ─── Exports ────────────────────────────────────────────────

module.exports = {
  handleAddContact,
  handleEditContact,
  handleDeleteContact,
  handleContacts,
  handleContactSearch,
  handleContactTextInput,
  hasActiveSession,
  setContactsTopicThread,
  getOrCreateContactsTopic,
  postContactCard,
  postOrEnsurePinnedGuide,
  postCEOAnnouncement,
};

// ─── Pinned Guide & CEO Announcement ────────────────────────

async function postOrEnsurePinnedGuide(bot) {
  try {
    const threadId = await getOrCreateContactsTopic(bot);
    if (!threadId) return; // Fallback to general, don't pin there

    // Check if we already posted the guide
    const existingMsgId = opsDb.getBotState('contacts_guide_msg_id');
    const existingThreadId = opsDb.getBotState('contacts_guide_thread_id');

    if (existingMsgId && existingThreadId === threadId.toString()) {
      // It's already posted in the CURRENT canonical thread.
      return;
    }

    const guideText = `📇 *Contact Management System Guide*

Welcome to the new Operations Contact Directory! This system helps us keep track of all our important contacts (vendors, tenants, technicians, etc.) in one organized place, automatically synced to Google Sheets.

*How to use:*
• /addcontact — Starts a wizard to add a new contact (Phone number is required!)
• /contacts — Lists all saved contacts
• \`/contact search [name]\` — Search by name (e.g., \`/contact search Ahmed\`)
• \`/contact type [type]\` — Filter by profession (e.g., \`/contact type plumber\`)
• \`/editcontact #[ID]\` — Edit an existing contact (e.g., \`/editcontact #C1\`)
• \`/deletecontact #[ID]\` — Delete a contact (Admins only)

*Notes:*
- You can skip optional fields (like email or notes) by typing "skip" during the wizard.
- Every contact added here is instantly synced to our Operations Google Sheet.

${DIV}

📇 *دليل نظام إدارة جهات الاتصال*

مرحباً بكم في دليل جهات الاتصال الجديد للعمليات! يساعدنا هذا النظام في تتبع جميع جهات الاتصال المهمة (الموردين، المستأجرين، الفنيين، إلخ) في مكان واحد منظم، مع مزامنة تلقائية مع جداول بيانات جوجل.

*طريقة الاستخدام:*
• /addcontact — بدء خطوات إضافة جهة اتصال جديدة (رقم الهاتف مطلوب!)
• /contacts — عرض جميع جهات الاتصال المحفوظة
• \`/contact search [الاسم]\` — البحث بالاسم (مثال: \`/contact search أحمد\`)
• \`/contact نوع [النوع]\` — التصفية حسب المهنة (مثال: \`/contact نوع سباك\`)
• \`/editcontact #[الرقم]\` — تعديل جهة اتصال (مثال: \`/editcontact #C1\`)
• \`/deletecontact #[الرقم]\` — حذف جهة اتصال (للمسؤولين فقط)

*ملاحظات:*
- يمكنك تخطي الحقول الاختيارية (مثل البريد الإلكتروني أو الملاحظات) بكتابة "skip" أو "تخطي".
- يتم مزامنة كل جهة اتصال تضاف هنا فوراً مع جدول بيانات العمليات على جوجل.`;

    const sent = await bot.telegram.sendMessage(OPS_GROUP_ID, guideText, {
      parse_mode: 'Markdown',
      message_thread_id: threadId,
    });

    // Pin the message
    await bot.telegram.pinChatMessage(OPS_GROUP_ID, sent.message_id, {
      disable_notification: true,
    });

    // Save state so we don't post it again
    opsDb.setBotState('contacts_guide_msg_id', sent.message_id.toString());
    opsDb.setBotState('contacts_guide_thread_id', threadId.toString());
    log.info('Contacts', `Posted and pinned guide message in thread ${threadId}`);
  } catch (e) {
    log.error('Contacts', `Failed to post pinned guide: ${e.message}`);
  }
}

async function postCEOAnnouncement(bot) {
  try {
    // Check if already announced
    if (opsDb.getBotState('contacts_ceo_announced')) return;

    // CEO Update topic thread ID (from ops.js THREAD_IDS.CEO_UPDATE = 4)
    const CEO_TOPIC_THREAD = 4;

    const announcementText = `📢 *CEO Update: New Contact Management System*

Team,

As our operations continue to grow, keeping our contacts organized is more important than ever. I'm excited to announce that our new **Contact Management System** is now live directly within this Telegram group.

You can now easily save, search, and manage all our operational contacts—vendors, tenants, technicians, and partners—using simple commands. Everything is automatically backed up and synced to our Google Sheets.

**Please start using this system today.** Whenever you work with a new technician or vendor, use the /addcontact command to save their details so the entire team can access them when needed.

Let's keep building! 🚀

${DIV}

📢 *تحديث المدير التنفيذي: نظام إدارة جهات الاتصال الجديد*

فريقنا العزيز،

مع استمرار نمو عملياتنا، أصبح تنظيم جهات الاتصال الخاصة بنا أكثر أهمية من أي وقت مضى. يسعدني أن أعلن أن **نظام إدارة جهات الاتصال** الجديد أصبح متاحاً الآن مباشرة داخل هذه المجموعة.

يمكنكم الآن بسهولة حفظ والبحث عن وإدارة جميع جهات الاتصال التشغيلية — الموردين، المستأجرين، الفنيين، والشركاء — باستخدام أوامر بسيطة. يتم نسخ كل شيء احتياطياً ومزامنته تلقائياً مع جداول بيانات جوجل الخاصة بنا.

**يرجى البدء في استخدام هذا النظام من اليوم.** كلما تعاملتم مع فني أو مورد جديد، استخدموا الأمر /addcontact لحفظ بياناته حتى يتمكن الفريق بأكمله من الوصول إليها عند الحاجة.

لنمضي قدماً! 🚀`;

    await bot.telegram.sendMessage(OPS_GROUP_ID, announcementText, {
      parse_mode: 'Markdown',
      message_thread_id: CEO_TOPIC_THREAD,
    });

    opsDb.setBotState('contacts_ceo_announced', 'true');
    log.info('Contacts', 'Posted CEO announcement for Contact Management System');
  } catch (e) {
    log.error('Contacts', `Failed to post CEO announcement: ${e.message}`);
  }
}
