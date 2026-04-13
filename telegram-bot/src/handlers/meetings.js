/**
 * Meeting Management Handlers — Scheduled Meetings System
 * ─────────────────────────────────────────────────────────────
 * Handles /meeting schedule, /meetings, /notes, /cancel_meeting
 * All responses are bilingual (English + Arabic).
 * Uses KSA timezone (UTC+3) for all times.
 */

const opsDb = require("../services/ops-database");
const googleSync = require("../services/google-sync");
const { resolveTeamMember, getDisplayName, getDisplayNameAr } = require("../team-members");

// ─── Constants ──────────────────────────────────────────────

const KSA_OFFSET_MS = 3 * 60 * 60 * 1000; // UTC+3

// ─── Utility Functions ──────────────────────────────────────

function getBilingualText(en, ar) {
  return `${en}\n━━━━━━━━━━━━━━\n${ar}`;
}

function extractCommandArgs(text, command) {
  if (!text) return "";
  const re = new RegExp(`^\\/(?:${command})(?:@\\S+)?\\s*`, "i");
  return text.replace(re, "").trim();
}

function escMd(text) {
  if (!text) return "";
  return String(text).replace(/[_*[\]()~`>#+=|{}.!\\-]/g, "\\$&");
}

/**
 * Get current time in KSA (UTC+3)
 */
function ksaNow() {
  return new Date(Date.now() + KSA_OFFSET_MS);
}

/**
 * Format a UTC datetime string to KSA display format
 */
function formatKSA(utcDateStr) {
  if (!utcDateStr) return "?";
  const d = new Date(utcDateStr);
  d.setTime(d.getTime() + KSA_OFFSET_MS);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const daysAr = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  const day = days[d.getUTCDay()];
  const dayAr = daysAr[d.getUTCDay()];
  const date = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  const time = `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
  return { en: `${day} ${date} ${time} KSA`, ar: `${dayAr} ${date} ${time} بتوقيت السعودية` };
}

/**
 * Parse a natural-language date/time string into a UTC ISO datetime.
 * Supports: "tomorrow 10:00 AM", "2026-04-15 14:30", "today 3pm", etc.
 * All input times are assumed KSA (UTC+3).
 */
function parseDatetime(input) {
  if (!input) return null;
  const clean = input.trim();

  // Try ISO format first: 2026-04-15 14:30 or 2026-04-15T14:30
  const isoMatch = clean.match(/^(\d{4}-\d{2}-\d{2})[T\s]+(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (isoMatch) {
    let hour = parseInt(isoMatch[2]);
    const min = parseInt(isoMatch[3]);
    const ampm = isoMatch[4];
    if (ampm) {
      if (ampm.toUpperCase() === "PM" && hour < 12) hour += 12;
      if (ampm.toUpperCase() === "AM" && hour === 12) hour = 0;
    }
    // Input is KSA, convert to UTC by subtracting 3 hours
    const ksaDate = new Date(`${isoMatch[1]}T${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}:00Z`);
    ksaDate.setTime(ksaDate.getTime() - KSA_OFFSET_MS);
    return ksaDate.toISOString().replace(/\.\d{3}Z$/, "");
  }

  // Relative: "today" or "tomorrow" + time
  const relMatch = clean.match(/^(today|tomorrow|غدا|غداً|اليوم)\s+(\d{1,2}):?(\d{2})?\s*(AM|PM|صباحا|صباحاً|مساء|مساءً)?$/i);
  if (relMatch) {
    const ksa = ksaNow();
    const dayWord = relMatch[1].toLowerCase();
    if (dayWord === "tomorrow" || dayWord === "غدا" || dayWord === "غداً") {
      ksa.setUTCDate(ksa.getUTCDate() + 1);
    }
    let hour = parseInt(relMatch[2]);
    const min = parseInt(relMatch[3] || "0");
    const ampm = (relMatch[4] || "").toLowerCase();
    if (ampm === "pm" || ampm === "مساء" || ampm === "مساءً") {
      if (hour < 12) hour += 12;
    } else if (ampm === "am" || ampm === "صباحا" || ampm === "صباحاً") {
      if (hour === 12) hour = 0;
    }
    // Build KSA datetime then convert to UTC
    const ksaStr = `${ksa.getUTCFullYear()}-${String(ksa.getUTCMonth() + 1).padStart(2, "0")}-${String(ksa.getUTCDate()).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}:00Z`;
    const utc = new Date(ksaStr);
    utc.setTime(utc.getTime() - KSA_OFFSET_MS);
    return utc.toISOString().replace(/\.\d{3}Z$/, "");
  }

  // Day name: "Sunday 10:00 AM", "الأحد 10:00"
  const dayNames = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
    sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
    "الأحد": 0, "الاثنين": 1, "الثلاثاء": 2, "الأربعاء": 3, "الخميس": 4, "الجمعة": 5, "السبت": 6 };
  const dayMatch = clean.match(/^(\S+)\s+(\d{1,2}):?(\d{2})?\s*(AM|PM|صباحا|صباحاً|مساء|مساءً)?$/i);
  if (dayMatch && dayNames[dayMatch[1].toLowerCase()] !== undefined) {
    const targetDay = dayNames[dayMatch[1].toLowerCase()];
    const ksa = ksaNow();
    const currentDay = ksa.getUTCDay();
    let daysAhead = targetDay - currentDay;
    if (daysAhead <= 0) daysAhead += 7;
    ksa.setUTCDate(ksa.getUTCDate() + daysAhead);
    let hour = parseInt(dayMatch[2]);
    const min = parseInt(dayMatch[3] || "0");
    const ampm = (dayMatch[4] || "").toLowerCase();
    if (ampm === "pm" || ampm === "مساء" || ampm === "مساءً") {
      if (hour < 12) hour += 12;
    } else if (ampm === "am" || ampm === "صباحا" || ampm === "صباحاً") {
      if (hour === 12) hour = 0;
    }
    const ksaStr = `${ksa.getUTCFullYear()}-${String(ksa.getUTCMonth() + 1).padStart(2, "0")}-${String(ksa.getUTCDate()).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}:00Z`;
    const utc = new Date(ksaStr);
    utc.setTime(utc.getTime() - KSA_OFFSET_MS);
    return utc.toISOString().replace(/\.\d{3}Z$/, "");
  }

  return null;
}

/**
 * Parse the /meeting command input.
 * Format: /meeting "Title" datetime @attendee1 @attendee2 [location:Room A] [agenda:Discuss Q2]
 * Also: /meeting Title - datetime @attendee1 @attendee2
 */
function parseMeetingInput(text) {
  if (!text) return null;

  // Normalize smart quotes
  let input = text.replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"').replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'");

  // Extract attendees (@username)
  const attendeeMatches = input.match(/@\w+/g) || [];
  const attendees = attendeeMatches.map(a => a.toLowerCase());
  // Remove attendees from input for further parsing
  let remaining = input;
  attendeeMatches.forEach(a => { remaining = remaining.replace(a, ""); });

  // Extract optional location: and agenda:
  let location = null;
  let agenda = null;
  const locMatch = remaining.match(/location:\s*([^@\n]+?)(?=\s+agenda:|$)/i);
  if (locMatch) { location = locMatch[1].trim(); remaining = remaining.replace(locMatch[0], ""); }
  const agendaMatch = remaining.match(/agenda:\s*([^@\n]+?)$/i);
  if (agendaMatch) { agenda = agendaMatch[1].trim(); remaining = remaining.replace(agendaMatch[0], ""); }

  remaining = remaining.trim();

  // Extract title (in quotes or before the date)
  let title = null;
  let dateStr = null;

  const quotedTitle = remaining.match(/^"([^"]+)"\s*(.*)/);
  if (quotedTitle) {
    title = quotedTitle[1].trim();
    dateStr = quotedTitle[2].trim();
  } else {
    // Try splitting by dash: "Title - datetime"
    const dashSplit = remaining.split(/\s+-\s+/);
    if (dashSplit.length >= 2) {
      title = dashSplit[0].trim();
      dateStr = dashSplit.slice(1).join(" - ").trim();
    } else {
      // Try to find the date part by looking for known date words
      const dateWords = /\b(today|tomorrow|غدا|غداً|اليوم|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun|الأحد|الاثنين|الثلاثاء|الأربعاء|الخميس|الجمعة|السبت|\d{4}-\d{2}-\d{2})\b/i;
      const dateIdx = remaining.search(dateWords);
      if (dateIdx > 0) {
        title = remaining.substring(0, dateIdx).trim();
        dateStr = remaining.substring(dateIdx).trim();
      } else {
        // Last resort: first sentence is title, rest is date
        title = remaining;
        dateStr = null;
      }
    }
  }

  // Clean up title
  if (title) title = title.replace(/^["']|["']$/g, "").trim();

  // Parse the datetime
  const meetingDatetime = dateStr ? parseDatetime(dateStr) : null;

  return { title, meetingDatetime, attendees, location, agenda };
}

/**
 * Resolve attendee usernames to display names
 */
function resolveAttendees(attendees) {
  return attendees.map(a => {
    const clean = a.replace(/^@/, "");
    const member = resolveTeamMember(clean);
    return {
      username: clean,
      name: member ? member.name : clean,
      nameAr: member ? member.nameAr : clean,
    };
  });
}

// ═══════════════════════════════════════════════════════════════
// ═══ Command Handlers ═══════════════════════════════════════
// ═══════════════════════════════════════════════════════════════

/**
 * /meeting — Enhanced to support both real-time and scheduled meetings
 * Adds "schedule" subcommand while preserving existing start/end/note/status
 */
async function handleScheduleMeeting(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  const chatId = ctx.chat.id;
  const user = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;

  try {
    const text = ctx.message.text || "";
    const args = extractCommandArgs(text, "meeting");

    // Parse the input
    const parsed = parseMeetingInput(args);
    if (!parsed || !parsed.title) {
      const en = [
        "📅 *Schedule a Meeting*",
        "",
        "Usage:",
        '`/meeting "Weekly Standup" tomorrow 10:00 AM @Mushtaq @SAQ198`',
        '`/meeting "Budget Review" 2026-04-15 14:30 @Mushtaq`',
        '`/meeting Team Sync - today 3:00 PM @SAQ198`',
        "",
        "Optional: `location:Room A` `agenda:Discuss Q2 targets`",
      ].join("\n");
      const ar = [
        "📅 *جدولة اجتماع*",
        "",
        "الاستخدام:",
        '`/meeting "الاجتماع الأسبوعي" غداً 10:00 صباحاً @Mushtaq @SAQ198`',
        '`/meeting "مراجعة الميزانية" 2026-04-15 14:30 @Mushtaq`',
        '`/meeting مزامنة الفريق - اليوم 3:00 مساءً @SAQ198`',
        "",
        "اختياري: `location:غرفة أ` `agenda:مناقشة أهداف الربع الثاني`",
      ].join("\n");
      return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
    }

    if (!parsed.meetingDatetime) {
      const en = "❌ *Could not parse the date/time.*\n\nPlease use a format like: `tomorrow 10:00 AM` or `2026-04-15 14:30`";
      const ar = "❌ *لم يتم التعرف على التاريخ/الوقت.*\n\nيرجى استخدام صيغة مثل: `غداً 10:00 صباحاً` أو `2026-04-15 14:30`";
      return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
    }

    // Resolve attendees
    const resolved = resolveAttendees(parsed.attendees);

    // Save to database
    const meetingId = opsDb.scheduleNewMeeting(chatId, threadId, parsed.title, parsed.meetingDatetime, {
      location: parsed.location,
      agenda: parsed.agenda,
      attendees: parsed.attendees,
      createdBy: user,
    });

    // Try to create Google Calendar event
    let calendarNote = "";
    let calendarNoteAr = "";
    if (googleSync.isConfigured()) {
      try {
        const calResult = await googleSync.createCalendarEvent({
          title: parsed.title,
          datetime: parsed.meetingDatetime,
          attendees: parsed.attendees.map(a => a.replace(/^@/, "")),
          location: parsed.location || "",
          description: parsed.agenda || "",
        });
        if (calResult && calResult.success) {
          calendarNote = "\n📆 Google Calendar event created";
          calendarNoteAr = "\n📆 تم إنشاء حدث في تقويم جوجل";
        }
      } catch (e) {
        console.error("[Meeting] Calendar event creation failed:", e.message);
      }
    }

    // Build confirmation message
    const dt = formatKSA(parsed.meetingDatetime);
    const attendeeListEn = resolved.length > 0
      ? resolved.map(a => `  👤 ${a.name} (@${a.username})`).join("\n")
      : "  _No attendees specified_";
    const attendeeListAr = resolved.length > 0
      ? resolved.map(a => `  👤 ${a.nameAr} (@${a.username})`).join("\n")
      : "  _لم يتم تحديد حضور_";

    const en = [
      `✅ *Meeting Scheduled* — #M${meetingId}`,
      "",
      `📌 *Title:* ${escMd(parsed.title)}`,
      `🕐 *When:* ${dt.en}`,
      parsed.location ? `📍 *Location:* ${escMd(parsed.location)}` : null,
      parsed.agenda ? `📋 *Agenda:* ${escMd(parsed.agenda)}` : null,
      "",
      "👥 *Attendees:*",
      attendeeListEn,
      "",
      "🔔 Reminders will be sent 30 min and 5 min before",
      calendarNote,
    ].filter(Boolean).join("\n");

    const ar = [
      `✅ *تم جدولة الاجتماع* — #M${meetingId}`,
      "",
      `📌 *العنوان:* ${escMd(parsed.title)}`,
      `🕐 *الموعد:* ${dt.ar}`,
      parsed.location ? `📍 *الموقع:* ${escMd(parsed.location)}` : null,
      parsed.agenda ? `📋 *جدول الأعمال:* ${escMd(parsed.agenda)}` : null,
      "",
      "👥 *الحضور:*",
      attendeeListAr,
      "",
      "🔔 سيتم إرسال تذكيرات قبل 30 دقيقة و5 دقائق",
      calendarNoteAr,
    ].filter(Boolean).join("\n");

    await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });

  } catch (e) {
    console.error("[handleScheduleMeeting] Error:", e.message);
    const en = `❌ *Error scheduling meeting:* \`${e.message}\``;
    const ar = `❌ *خطأ في جدولة الاجتماع:* \`${e.message}\``;
    await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId }).catch(() => {});
  }
}

/**
 * /meetings — List all upcoming scheduled meetings
 */
async function handleListMeetings(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  const chatId = ctx.chat.id;

  try {
    const meetings = opsDb.getUpcomingMeetings(chatId);

    if (meetings.length === 0) {
      const en = "📅 *Upcoming Meetings*\n\n_No meetings scheduled._\n\nUse `/meeting` to schedule one.";
      const ar = "📅 *الاجتماعات القادمة*\n\n_لا توجد اجتماعات مجدولة._\n\nاستخدم `/meeting` لجدولة اجتماع.";
      return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
    }

    let enLines = ["📅 *Upcoming Meetings*", ""];
    let arLines = ["📅 *الاجتماعات القادمة*", ""];

    meetings.forEach((m, i) => {
      const dt = formatKSA(m.meeting_datetime);
      let attendees = [];
      try { attendees = JSON.parse(m.attendees || "[]"); } catch (e) {}
      const resolved = resolveAttendees(attendees);
      const attendeeNamesEn = resolved.map(a => a.name).join(", ") || "None";
      const attendeeNamesAr = resolved.map(a => a.nameAr).join("، ") || "لا يوجد";

      enLines.push(`*${i + 1}\\. #M${m.id} — ${escMd(m.title)}*`);
      enLines.push(`   🕐 ${dt.en}`);
      if (m.location) enLines.push(`   📍 ${escMd(m.location)}`);
      enLines.push(`   👥 ${attendeeNamesEn}`);
      enLines.push("");

      arLines.push(`*${i + 1}\\. #M${m.id} — ${escMd(m.title)}*`);
      arLines.push(`   🕐 ${dt.ar}`);
      if (m.location) arLines.push(`   📍 ${escMd(m.location)}`);
      arLines.push(`   👥 ${attendeeNamesAr}`);
      arLines.push("");
    });

    enLines.push(`_${meetings.length} meeting${meetings.length > 1 ? "s" : ""} scheduled_`);
    arLines.push(`_${meetings.length} اجتماع${meetings.length > 1 ? "ات" : ""} مجدولة_`);

    await ctx.reply(getBilingualText(enLines.join("\n"), arLines.join("\n")), {
      parse_mode: "Markdown",
      message_thread_id: threadId,
    });

  } catch (e) {
    console.error("[handleListMeetings] Error:", e.message);
    await ctx.reply(`❌ Error: ${e.message}`, { message_thread_id: threadId }).catch(() => {});
  }
}

/**
 * /notes — Add meeting notes with action items
 * Format: /notes #M1 Key decisions were made. Action: @Mushtaq to prepare budget
 * Or:     /notes Meeting Title - Key decisions. Action: @SAQ198 to review
 */
async function handleMeetingNotes(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  const chatId = ctx.chat.id;
  const user = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;

  try {
    const text = ctx.message.text || "";
    const args = extractCommandArgs(text, "notes");

    if (!args) {
      const en = [
        "📝 *Meeting Notes*",
        "",
        "Usage:",
        "`/notes #M1 Key decisions were made`",
        "`/notes Weekly Standup - Budget approved. Action: @Mushtaq prepare report`",
        "",
        "Action items with @mentions will auto-create tasks.",
      ].join("\n");
      const ar = [
        "📝 *محضر الاجتماع*",
        "",
        "الاستخدام:",
        "`/notes #M1 تم اتخاذ قرارات مهمة`",
        "`/notes الاجتماع الأسبوعي - تمت الموافقة على الميزانية. إجراء: @Mushtaq إعداد التقرير`",
        "",
        "البنود مع @إشارات ستنشئ مهام تلقائياً.",
      ].join("\n");
      return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
    }

    // Try to find the meeting by ID or title
    let meeting = null;
    let notesText = args;

    // Check for #M<id> reference
    const idMatch = args.match(/^#M(\d+)\s+([\s\S]+)/i);
    if (idMatch) {
      meeting = opsDb.getScheduledMeetingById(parseInt(idMatch[1]));
      notesText = idMatch[2].trim();
    } else {
      // Try to match by title (before dash)
      const dashSplit = args.split(/\s+-\s+/);
      if (dashSplit.length >= 2) {
        const titleSearch = dashSplit[0].trim().toLowerCase();
        const allMeetings = opsDb.getScheduledMeetings(chatId);
        meeting = allMeetings.find(m => m.title.toLowerCase().includes(titleSearch));
        notesText = dashSplit.slice(1).join(" - ").trim();
      }
      // If no match, try to find the most recent meeting
      if (!meeting) {
        const allMeetings = opsDb.getScheduledMeetings(chatId);
        if (allMeetings.length === 1) {
          meeting = allMeetings[0];
        }
      }
    }

    if (!meeting) {
      const en = "❌ *Meeting not found.*\n\nUse `#M<id>` to specify the meeting, e.g., `/notes #M1 Your notes here`\n\nUse `/meetings` to see scheduled meetings.";
      const ar = "❌ *لم يتم العثور على الاجتماع.*\n\nاستخدم `#M<رقم>` لتحديد الاجتماع، مثال: `/notes #M1 ملاحظاتك هنا`\n\nاستخدم `/meetings` لعرض الاجتماعات.";
      return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
    }

    // Extract action items (lines starting with "Action:" or containing @mentions with verbs)
    const actionItems = [];
    const actionPatterns = [
      /action:\s*@(\w+)\s+(.+?)(?:\.|$)/gi,
      /(?:todo|task|إجراء):\s*@(\w+)\s+(.+?)(?:\.|$)/gi,
    ];
    for (const pattern of actionPatterns) {
      let match;
      while ((match = pattern.exec(notesText)) !== null) {
        const assignee = `@${match[1]}`;
        const action = match[2].trim();
        const member = resolveTeamMember(match[1]);
        actionItems.push({
          assignee,
          assigneeName: member ? member.name : match[1],
          action,
        });
      }
    }

    // Save notes
    const noteId = opsDb.addMeetingNotes(meeting.id, notesText, actionItems, user);

    // Auto-create tasks for action items
    const createdTasks = [];
    for (const item of actionItems) {
      try {
        const taskId = opsDb.addTask(chatId, threadId, null, item.action, {
          assignedTo: item.assigneeName + ` (${item.assignee})`,
          priority: "normal",
          createdBy: user,
        });
        createdTasks.push({ taskId, ...item });
      } catch (e) {
        console.error("[MeetingNotes] Failed to create task:", e.message);
      }
    }

    // Build response
    const en = [
      `✅ *Notes saved for Meeting #M${meeting.id}*`,
      `📌 ${escMd(meeting.title)}`,
      "",
      `📝 ${escMd(notesText.substring(0, 200))}${notesText.length > 200 ? "..." : ""}`,
      "",
      actionItems.length > 0 ? "📋 *Action Items Created:*" : null,
      ...createdTasks.map(t => `  ✅ Task #${t.taskId}: ${escMd(t.action)} → ${t.assigneeName}`),
      "",
      `👤 Recorded by: ${user}`,
    ].filter(Boolean).join("\n");

    const ar = [
      `✅ *تم حفظ المحضر للاجتماع #M${meeting.id}*`,
      `📌 ${escMd(meeting.title)}`,
      "",
      `📝 ${escMd(notesText.substring(0, 200))}${notesText.length > 200 ? "..." : ""}`,
      "",
      actionItems.length > 0 ? "📋 *بنود العمل المنشأة:*" : null,
      ...createdTasks.map(t => `  ✅ مهمة #${t.taskId}: ${escMd(t.action)} → ${t.assigneeName}`),
      "",
      `👤 سُجل بواسطة: ${user}`,
    ].filter(Boolean).join("\n");

    await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });

  } catch (e) {
    console.error("[handleMeetingNotes] Error:", e.message);
    const en = `❌ *Error saving notes:* \`${e.message}\``;
    const ar = `❌ *خطأ في حفظ المحضر:* \`${e.message}\``;
    await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId }).catch(() => {});
  }
}

/**
 * /cancel_meeting — Cancel a scheduled meeting
 * Format: /cancel_meeting #M1 or /cancel_meeting 1
 */
async function handleCancelMeeting(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  const chatId = ctx.chat.id;

  try {
    const text = ctx.message.text || "";
    const args = extractCommandArgs(text, "cancel_meeting");

    if (!args) {
      const en = "❌ *Cancel Meeting*\n\nUsage: `/cancel_meeting #M1` or `/cancel_meeting 1`\n\nUse `/meetings` to see meeting IDs.";
      const ar = "❌ *إلغاء اجتماع*\n\nالاستخدام: `/cancel_meeting #M1` أو `/cancel_meeting 1`\n\nاستخدم `/meetings` لعرض أرقام الاجتماعات.";
      return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
    }

    // Extract meeting ID
    const idMatch = args.match(/#?M?(\d+)/i);
    if (!idMatch) {
      const en = "❌ *Invalid meeting ID.*\n\nUse `/cancel_meeting #M1` or `/cancel_meeting 1`";
      const ar = "❌ *رقم اجتماع غير صالح.*\n\nاستخدم `/cancel_meeting #M1` أو `/cancel_meeting 1`";
      return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
    }

    const meetingId = parseInt(idMatch[1]);
    const meeting = opsDb.getScheduledMeetingById(meetingId);

    if (!meeting) {
      const en = `❌ *Meeting #M${meetingId} not found.*`;
      const ar = `❌ *لم يتم العثور على الاجتماع #M${meetingId}.*`;
      return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
    }

    if (meeting.status === "cancelled") {
      const en = `ℹ️ Meeting #M${meetingId} is already cancelled.`;
      const ar = `ℹ️ الاجتماع #M${meetingId} ملغى بالفعل.`;
      return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
    }

    // Cancel the meeting
    opsDb.cancelScheduledMeeting(meetingId);

    // Try to delete Google Calendar event
    if (googleSync.isConfigured() && meeting.calendar_event_id) {
      try {
        await googleSync.deleteCalendarEvent(meetingId);
      } catch (e) {
        console.error("[CancelMeeting] Calendar event deletion failed:", e.message);
      }
    }

    const dt = formatKSA(meeting.meeting_datetime);
    const en = [
      `🚫 *Meeting Cancelled* — #M${meetingId}`,
      "",
      `📌 ${escMd(meeting.title)}`,
      `🕐 Was scheduled for: ${dt.en}`,
    ].join("\n");

    const ar = [
      `🚫 *تم إلغاء الاجتماع* — #M${meetingId}`,
      "",
      `📌 ${escMd(meeting.title)}`,
      `🕐 كان مجدولاً في: ${dt.ar}`,
    ].join("\n");

    await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });

  } catch (e) {
    console.error("[handleCancelMeeting] Error:", e.message);
    const en = `❌ *Error cancelling meeting:* \`${e.message}\``;
    const ar = `❌ *خطأ في إلغاء الاجتماع:* \`${e.message}\``;
    await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId }).catch(() => {});
  }
}

module.exports = {
  handleScheduleMeeting,
  handleListMeetings,
  handleMeetingNotes,
  handleCancelMeeting,
  // Exported for scheduler use
  resolveAttendees,
  formatKSA,
};
