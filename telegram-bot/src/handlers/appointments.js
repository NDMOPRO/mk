/**
 * Appointment Scheduling System — Handlers
 * ─────────────────────────────────────────────────────────────
 * Handles /appointment, /appointments, /cancel_appointment
 * Supports both internal team members (@username) and external contacts.
 * All responses are bilingual (English + Arabic).
 * Uses KSA timezone (UTC+3) for all times.
 */

const opsDb = require("../services/ops-database");
const { resolveTeamMember, getDisplayName, getDisplayNameAr } = require("../team-members");
const log = require("../utils/logger");

// ─── Constants ──────────────────────────────────────────────

const KSA_OFFSET_MS = 3 * 60 * 60 * 1000; // UTC+3
const DIV = "━━━━━━━━━━━━━━━━━━━━";

// ─── Utility Functions ──────────────────────────────────────

function getBilingualText(en, ar) {
  return `${en}\n${DIV}\n${ar}`;
}

function extractCommandArgs(text, command) {
  if (!text) return "";
  const re = new RegExp(`^\\/(?:${command})(?:@\\S+)?\\s*`, "i");
  return text.replace(re, "").trim();
}

function escMd(text) {
  if (!text) return "";
  // Markdown v1 only needs _ * ` [ escaped
  return String(text).replace(/([_*`\[])/g, "\\$1");
}

function ksaNow() {
  return new Date(Date.now() + KSA_OFFSET_MS);
}

/**
 * Format a UTC datetime string to KSA display format
 */
function formatKSA(utcDateStr) {
  if (!utcDateStr) return { en: "?", ar: "?" };
  const d = new Date(utcDateStr);
  d.setTime(d.getTime() + KSA_OFFSET_MS);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const daysAr = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const day = days[d.getUTCDay()];
  const dayAr = daysAr[d.getUTCDay()];
  const date = `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  const time = `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
  return { en: `${day} ${date} ${time} KSA`, ar: `${dayAr} ${date} ${time} بتوقيت السعودية` };
}

/**
 * Parse a natural-language date/time string into a UTC ISO datetime.
 * Supports: "tomorrow 10:00 AM", "2026-04-15 14:30", "today 3pm",
 *           "Apr 15 2:00 PM", "15 Apr 2:00 PM", etc.
 * All input times are assumed KSA (UTC+3).
 */
function parseDatetime(input) {
  if (!input) return null;
  const clean = input.trim();

  // Try ISO format: 2026-04-15 14:30 or 2026-04-15T14:30
  const isoMatch = clean.match(/^(\d{4}-\d{2}-\d{2})[T\s]+(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (isoMatch) {
    let hour = parseInt(isoMatch[2]);
    const min = parseInt(isoMatch[3]);
    const ampm = isoMatch[4];
    if (ampm) {
      if (ampm.toUpperCase() === "PM" && hour < 12) hour += 12;
      if (ampm.toUpperCase() === "AM" && hour === 12) hour = 0;
    }
    const ksaDate = new Date(`${isoMatch[1]}T${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}:00Z`);
    ksaDate.setTime(ksaDate.getTime() - KSA_OFFSET_MS);
    return ksaDate.toISOString().replace(/\.\d{3}Z$/, "");
  }

  // Month-name formats: "Apr 15 2:00 PM", "April 15 2026 2:00 PM", "15 Apr 2:00 PM"
  const monthNames = {
    jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
    apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6,
    aug: 7, august: 7, sep: 8, september: 8, oct: 9, october: 9,
    nov: 10, november: 10, dec: 11, december: 11,
  };

  // "Apr 15 2:00 PM" or "Apr 15 2026 2:00 PM"
  const monthFirstMatch = clean.match(/^([A-Za-z]+)\s+(\d{1,2})(?:\s+(\d{4}))?\s+(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (monthFirstMatch) {
    const monthStr = monthFirstMatch[1].toLowerCase();
    if (monthNames[monthStr] !== undefined) {
      const month = monthNames[monthStr];
      const dayNum = parseInt(monthFirstMatch[2]);
      const year = monthFirstMatch[3] ? parseInt(monthFirstMatch[3]) : ksaNow().getUTCFullYear();
      let hour = parseInt(monthFirstMatch[4]);
      const min = parseInt(monthFirstMatch[5]);
      const ampm = (monthFirstMatch[6] || "").toUpperCase();
      if (ampm === "PM" && hour < 12) hour += 12;
      if (ampm === "AM" && hour === 12) hour = 0;
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
      const ksaDate = new Date(`${dateStr}T${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}:00Z`);
      ksaDate.setTime(ksaDate.getTime() - KSA_OFFSET_MS);
      return ksaDate.toISOString().replace(/\.\d{3}Z$/, "");
    }
  }

  // "15 Apr 2:00 PM" or "15 April 2026 2:00 PM"
  const dayFirstMatch = clean.match(/^(\d{1,2})\s+([A-Za-z]+)(?:\s+(\d{4}))?\s+(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (dayFirstMatch) {
    const monthStr = dayFirstMatch[2].toLowerCase();
    if (monthNames[monthStr] !== undefined) {
      const month = monthNames[monthStr];
      const dayNum = parseInt(dayFirstMatch[1]);
      const year = dayFirstMatch[3] ? parseInt(dayFirstMatch[3]) : ksaNow().getUTCFullYear();
      let hour = parseInt(dayFirstMatch[4]);
      const min = parseInt(dayFirstMatch[5]);
      const ampm = (dayFirstMatch[6] || "").toUpperCase();
      if (ampm === "PM" && hour < 12) hour += 12;
      if (ampm === "AM" && hour === 12) hour = 0;
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
      const ksaDate = new Date(`${dateStr}T${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}:00Z`);
      ksaDate.setTime(ksaDate.getTime() - KSA_OFFSET_MS);
      return ksaDate.toISOString().replace(/\.\d{3}Z$/, "");
    }
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
    const ksaStr = `${ksa.getUTCFullYear()}-${String(ksa.getUTCMonth() + 1).padStart(2, "0")}-${String(ksa.getUTCDate()).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}:00Z`;
    const utc = new Date(ksaStr);
    utc.setTime(utc.getTime() - KSA_OFFSET_MS);
    return utc.toISOString().replace(/\.\d{3}Z$/, "");
  }

  // Day name: "Sunday 10:00 AM"
  const dayNames = {
    sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
    sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
    "الأحد": 0, "الاثنين": 1, "الثلاثاء": 2, "الأربعاء": 3, "الخميس": 4, "الجمعة": 5, "السبت": 6,
  };
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
 * Parse the /appointment command input.
 *
 * Supported formats:
 *   /appointment "AC Inspection" Apr 15 2:00 PM with "Ahmed - Tenant Unit 5" at "Mazra Property"
 *   /appointment "Budget Review" tomorrow 3:00 PM @Mushtaq @SAQ198
 *   /appointment "Title" 2026-04-15 14:30 @user1 with "External Name" at "Location" notes: some notes
 */
function parseAppointmentInput(text) {
  if (!text) return null;

  // Normalize smart quotes
  let input = text.replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"').replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'");

  // Extract internal attendees (@username)
  const internalMatches = input.match(/@\w+/g) || [];
  const attendeesInternal = internalMatches.map(a => a.toLowerCase());
  // Remove internal attendees from input for further parsing
  let remaining = input;
  internalMatches.forEach(a => { remaining = remaining.replace(a, ""); });

  // Extract external attendees: "with" keyword followed by quoted names or plain text
  const attendeesExternal = [];

  // Pattern: with "Name" or with "Name1" "Name2"
  const withMatch = remaining.match(/\bwith\s+((?:"[^"]+"\s*)+)/i);
  if (withMatch) {
    const externalStr = withMatch[1];
    const quotedNames = externalStr.match(/"([^"]+)"/g) || [];
    quotedNames.forEach(q => attendeesExternal.push(q.replace(/"/g, "").trim()));
    remaining = remaining.replace(withMatch[0], " ");
  } else {
    // Try: with plain-text-name (single external, no quotes, until "at" or "notes:" or end)
    const withPlainMatch = remaining.match(/\bwith\s+([^"@]+?)(?=\s+at\s+|\s+notes:|\s*$)/i);
    if (withPlainMatch) {
      const name = withPlainMatch[1].trim();
      if (name && name.length > 1) {
        attendeesExternal.push(name);
      }
      remaining = remaining.replace(withPlainMatch[0], " ");
    }
  }

  // Extract location: at "Location" or at Location
  let location = null;
  const atQuotedMatch = remaining.match(/\bat\s+"([^"]+)"/i);
  if (atQuotedMatch) {
    location = atQuotedMatch[1].trim();
    remaining = remaining.replace(atQuotedMatch[0], " ");
  } else {
    const atPlainMatch = remaining.match(/\bat\s+([^"@\n]+?)(?=\s+notes:|\s*$)/i);
    if (atPlainMatch) {
      location = atPlainMatch[1].trim();
      // Don't consume date-like words as location
      if (/^(today|tomorrow|غدا|غداً|اليوم|\d{4}-)/i.test(location)) {
        location = null;
      } else {
        remaining = remaining.replace(atPlainMatch[0], " ");
      }
    }
  }

  // Extract notes: notes: "text" or notes: text
  let notes = null;
  const notesMatch = remaining.match(/\bnotes?:\s*"?([^"]+)"?\s*$/i);
  if (notesMatch) {
    notes = notesMatch[1].trim();
    remaining = remaining.replace(notesMatch[0], " ");
  }

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
      // Try to find the date part by looking for known date words/patterns
      const dateWords = /\b(today|tomorrow|غدا|غداً|اليوم|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun|الأحد|الاثنين|الثلاثاء|الأربعاء|الخميس|الجمعة|السبت|\d{4}-\d{2}-\d{2}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)\b/i;
      const dateIdx = remaining.search(dateWords);
      if (dateIdx > 0) {
        title = remaining.substring(0, dateIdx).trim();
        dateStr = remaining.substring(dateIdx).trim();
      } else {
        title = remaining;
        dateStr = null;
      }
    }
  }

  // Clean up title
  if (title) title = title.replace(/^["']|["']$/g, "").trim();

  // Clean up dateStr — remove leftover noise
  if (dateStr) dateStr = dateStr.replace(/\s+/g, " ").trim();

  // Parse the datetime
  const appointmentDatetime = dateStr ? parseDatetime(dateStr) : null;

  return { title, appointmentDatetime, attendeesInternal, attendeesExternal, location, notes };
}

/**
 * Resolve internal attendee usernames to display names
 */
function resolveInternalAttendees(attendees) {
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
 * /appointment — Schedule a new appointment
 */
async function handleAppointment(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  const chatId = ctx.chat.id;
  const user = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;

  try {
    const text = ctx.message.text || "";
    const args = extractCommandArgs(text, "appointment");

    // Parse the input
    const parsed = parseAppointmentInput(args);
    if (!parsed || !parsed.title) {
      const en = [
        "📅 *Schedule an Appointment*",
        "",
        "Usage:",
        '`/appointment "AC Inspection" Apr 15 2:00 PM with "Ahmed - Tenant" at "Mazra Property"`',
        '`/appointment "Budget Review" tomorrow 3:00 PM @Mushtaq @SAQ198`',
        '`/appointment "Site Visit" 2026-04-20 10:00 AM with "Vendor Ali" at "Unit 5"`',
        "",
        "Options:",
        "  `with \"Name\"` — external contact",
        "  `@username` — internal team member",
        "  `at \"Location\"` — location",
        "  `notes: text` — additional notes",
      ].join("\n");
      const ar = [
        "📅 *جدولة موعد*",
        "",
        "الاستخدام:",
        '`/appointment "فحص التكييف" Apr 15 2:00 PM with "أحمد - مستأجر" at "عقار المزرعة"`',
        '`/appointment "مراجعة الميزانية" tomorrow 3:00 PM @Mushtaq @SAQ198`',
        '`/appointment "زيارة موقع" 2026-04-20 10:00 AM with "المورد علي" at "وحدة 5"`',
        "",
        "الخيارات:",
        "  `with \"الاسم\"` — جهة خارجية",
        "  `@username` — عضو فريق داخلي",
        "  `at \"الموقع\"` — الموقع",
        "  `notes: نص` — ملاحظات إضافية",
      ].join("\n");
      return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
    }

    if (!parsed.appointmentDatetime) {
      const en = "❌ *Could not parse the date/time.*\n\nPlease use a format like: `tomorrow 10:00 AM`, `Apr 15 2:00 PM`, or `2026-04-15 14:30`";
      const ar = "❌ *لم يتم التعرف على التاريخ/الوقت.*\n\nيرجى استخدام صيغة مثل: `tomorrow 10:00 AM` أو `Apr 15 2:00 PM` أو `2026-04-15 14:30`";
      return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
    }

    // Resolve internal attendees
    const resolvedInternal = resolveInternalAttendees(parsed.attendeesInternal);

    // Save to database
    const appointmentId = opsDb.createAppointment(chatId, threadId, parsed.title, parsed.appointmentDatetime, {
      location: parsed.location,
      notes: parsed.notes,
      attendeesInternal: parsed.attendeesInternal,
      attendeesExternal: parsed.attendeesExternal,
      createdBy: user,
    });

    // Build confirmation message
    const dt = formatKSA(parsed.appointmentDatetime);

    // Internal attendees list
    const internalListEn = resolvedInternal.length > 0
      ? resolvedInternal.map(a => `  👤 ${a.name} (@${a.username})`).join("\n")
      : null;
    const internalListAr = resolvedInternal.length > 0
      ? resolvedInternal.map(a => `  👤 ${a.nameAr} (@${a.username})`).join("\n")
      : null;

    // External attendees list
    const externalListEn = parsed.attendeesExternal.length > 0
      ? parsed.attendeesExternal.map(a => `  🤝 ${escMd(a)}`).join("\n")
      : null;
    const externalListAr = parsed.attendeesExternal.length > 0
      ? parsed.attendeesExternal.map(a => `  🤝 ${escMd(a)}`).join("\n")
      : null;

    const hasAttendees = resolvedInternal.length > 0 || parsed.attendeesExternal.length > 0;

    const en = [
      `✅ *Appointment Scheduled* — #A${appointmentId}`,
      "",
      `📌 *Title:* ${escMd(parsed.title)}`,
      `🕐 *When:* ${dt.en}`,
      parsed.location ? `📍 *Location:* ${escMd(parsed.location)}` : null,
      parsed.notes ? `📝 *Notes:* ${escMd(parsed.notes)}` : null,
      "",
      hasAttendees ? "👥 *Attendees:*" : null,
      internalListEn,
      externalListEn,
      !hasAttendees ? "  _No attendees specified_" : null,
      "",
      "🔔 Reminders: 1 hour and 15 min before",
      `👤 Created by: ${user}`,
    ].filter(Boolean).join("\n");

    const ar = [
      `✅ *تم جدولة الموعد* — #A${appointmentId}`,
      "",
      `📌 *العنوان:* ${escMd(parsed.title)}`,
      `🕐 *الموعد:* ${dt.ar}`,
      parsed.location ? `📍 *الموقع:* ${escMd(parsed.location)}` : null,
      parsed.notes ? `📝 *ملاحظات:* ${escMd(parsed.notes)}` : null,
      "",
      hasAttendees ? "👥 *الحضور:*" : null,
      internalListAr,
      externalListAr,
      !hasAttendees ? "  _لم يتم تحديد حضور_" : null,
      "",
      "🔔 تذكيرات: قبل ساعة و15 دقيقة",
      `👤 أنشأه: ${user}`,
    ].filter(Boolean).join("\n");

    await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });

  } catch (e) {
    log.error('Appointment', 'Error scheduling appointment', { error: e.message });
    const en = `❌ *Error scheduling appointment:* \`${e.message}\``;
    const ar = `❌ *خطأ في جدولة الموعد:* \`${e.message}\``;
    await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId }).catch(() => {});
  }
}

/**
 * /appointments — List all upcoming appointments
 */
async function handleAppointments(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  const chatId = ctx.chat.id;

  try {
    const appointments = opsDb.getUpcomingAppointments(chatId);

    if (appointments.length === 0) {
      const en = "📅 *Upcoming Appointments*\n\n_No appointments scheduled._\n\nUse `/appointment` to schedule one.";
      const ar = "📅 *المواعيد القادمة*\n\n_لا توجد مواعيد مجدولة._\n\nاستخدم `/appointment` لجدولة موعد.";
      return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
    }

    let enLines = ["📅 *Upcoming Appointments*", ""];
    let arLines = ["📅 *المواعيد القادمة*", ""];

    appointments.forEach((a, i) => {
      const dt = formatKSA(a.appointment_datetime);
      let intAttendees = [];
      let extAttendees = [];
      try { intAttendees = JSON.parse(a.attendees_internal || "[]"); } catch (e) {}
      try { extAttendees = JSON.parse(a.attendees_external || "[]"); } catch (e) {}

      const resolvedInt = resolveInternalAttendees(intAttendees);
      const allNamesEn = [
        ...resolvedInt.map(r => r.name),
        ...extAttendees,
      ].join(", ") || "None";
      const allNamesAr = [
        ...resolvedInt.map(r => r.nameAr),
        ...extAttendees,
      ].join("، ") || "لا يوجد";

      enLines.push(`*${i + 1}\\. #A${a.id} — ${escMd(a.title)}*`);
      enLines.push(`   🕐 ${dt.en}`);
      if (a.location) enLines.push(`   📍 ${escMd(a.location)}`);
      enLines.push(`   👥 ${allNamesEn}`);
      if (a.notes) enLines.push(`   📝 ${escMd(a.notes.substring(0, 60))}${a.notes.length > 60 ? "..." : ""}`);
      enLines.push("");

      arLines.push(`*${i + 1}\\. #A${a.id} — ${escMd(a.title)}*`);
      arLines.push(`   🕐 ${dt.ar}`);
      if (a.location) arLines.push(`   📍 ${escMd(a.location)}`);
      arLines.push(`   👥 ${allNamesAr}`);
      if (a.notes) arLines.push(`   📝 ${escMd(a.notes.substring(0, 60))}${a.notes.length > 60 ? "..." : ""}`);
      arLines.push("");
    });

    enLines.push(`_${appointments.length} appointment${appointments.length > 1 ? "s" : ""} scheduled_`);
    arLines.push(`_${appointments.length} موعد${appointments.length > 1 ? " مجدول" : " مجدول"}_`);

    await ctx.reply(getBilingualText(enLines.join("\n"), arLines.join("\n")), {
      parse_mode: "Markdown",
      message_thread_id: threadId,
    });

  } catch (e) {
    log.error('Appointment', 'Error listing appointments', { error: e.message });
    await ctx.reply(`❌ Error: ${e.message}`, { message_thread_id: threadId }).catch(() => {});
  }
}

/**
 * /cancel_appointment — Cancel an appointment
 * Format: /cancel_appointment #A1 or /cancel_appointment 1
 */
async function handleCancelAppointment(ctx) {
  const threadId = ctx.message?.message_thread_id || null;

  try {
    const text = ctx.message.text || "";
    const args = extractCommandArgs(text, "cancel_appointment");

    if (!args) {
      const en = "❌ *Cancel Appointment*\n\nUsage: `/cancel_appointment #A1` or `/cancel_appointment 1`\n\nUse `/appointments` to see appointment IDs.";
      const ar = "❌ *إلغاء موعد*\n\nالاستخدام: `/cancel_appointment #A1` أو `/cancel_appointment 1`\n\nاستخدم `/appointments` لعرض أرقام المواعيد.";
      return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
    }

    // Extract appointment ID
    const idMatch = args.match(/#?A?(\d+)/i);
    if (!idMatch) {
      const en = "❌ *Invalid appointment ID.*\n\nUse `/cancel_appointment #A1` or `/cancel_appointment 1`";
      const ar = "❌ *رقم موعد غير صالح.*\n\nاستخدم `/cancel_appointment #A1` أو `/cancel_appointment 1`";
      return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
    }

    const appointmentId = parseInt(idMatch[1]);
    const appointment = opsDb.getAppointmentById(appointmentId);

    if (!appointment) {
      const en = `❌ *Appointment #A${appointmentId} not found.*`;
      const ar = `❌ *لم يتم العثور على الموعد #A${appointmentId}.*`;
      return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
    }

    if (appointment.status === "cancelled") {
      const en = `ℹ️ Appointment #A${appointmentId} is already cancelled.`;
      const ar = `ℹ️ الموعد #A${appointmentId} ملغى بالفعل.`;
      return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
    }

    // Cancel the appointment
    opsDb.cancelAppointment(appointmentId);

    const dt = formatKSA(appointment.appointment_datetime);
    const en = [
      `🚫 *Appointment Cancelled* — #A${appointmentId}`,
      "",
      `📌 ${escMd(appointment.title)}`,
      `🕐 Was scheduled for: ${dt.en}`,
    ].join("\n");

    const ar = [
      `🚫 *تم إلغاء الموعد* — #A${appointmentId}`,
      "",
      `📌 ${escMd(appointment.title)}`,
      `🕐 كان مجدولاً في: ${dt.ar}`,
    ].join("\n");

    await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });

  } catch (e) {
    log.error('Appointment', 'Error cancelling appointment', { error: e.message });
    const en = `❌ *Error cancelling appointment:* \`${e.message}\``;
    const ar = `❌ *خطأ في إلغاء الموعد:* \`${e.message}\``;
    await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId }).catch(() => {});
  }
}

module.exports = {
  handleAppointment,
  handleAppointments,
  handleCancelAppointment,
  // Exported for scheduler use
  resolveInternalAttendees,
  formatKSA: formatKSA,
};
