/**
 * AI Operations Consultant — Monthly Key
 * ─────────────────────────────────────────────────────────────
 * Analyzes operational data using OpenAI and generates comprehensive
 * bilingual reports (Arabic first, then English) for the CEO.
 *
 * Features:
 *  - Weekly consultant reports (Sunday 8 PM KSA)
 *  - On-demand /consultant command
 *  - Today-only quick analysis
 *  - Stores reports in consultant_reports table
 */

const { OpenAI } = require("openai");
const log = require("../utils/logger");
const opsDb = require("./ops-database");
const { getAllTeamMembers, getTeamDirectory } = require("../team-members");

// ─── Constants ─────────────────────────────────────────────────
const OPS_GROUP_ID = Number(process.env.OPS_GROUP_ID) || -1003967447285;
const KSA_OFFSET_MS = 3 * 60 * 60 * 1000;
const THREAD_CEO_UPDATE = 4;
const DIV = "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━";
const MODEL = "gpt-4.1-mini";

// ─── OpenAI Client ─────────────────────────────────────────────
const openai = new OpenAI({
  timeout: 60000,
  maxRetries: 2,
});

// ─── KSA Time Helpers ──────────────────────────────────────────

function ksaNow() {
  return new Date(Date.now() + KSA_OFFSET_MS);
}

function formatKsaDate(utcStr) {
  if (!utcStr) return "N/A";
  const d = new Date(utcStr.replace(" ", "T") + (utcStr.includes("Z") ? "" : "Z"));
  const ksa = new Date(d.getTime() + KSA_OFFSET_MS);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[ksa.getUTCMonth()]} ${ksa.getUTCDate()}, ${ksa.getUTCFullYear()}`;
}

function formatKsaTime(utcStr) {
  if (!utcStr) return "";
  const d = new Date(utcStr.replace(" ", "T") + (utcStr.includes("Z") ? "" : "Z"));
  const ksa = new Date(d.getTime() + KSA_OFFSET_MS);
  const h = ksa.getUTCHours();
  const m = String(ksa.getUTCMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

// ─── Data Summarizer ───────────────────────────────────────────
// Condenses raw DB data into a structured text summary for the AI prompt

function summarizeDataForAI(data, periodLabel) {
  const lines = [];

  lines.push(`=== OPERATIONAL DATA: ${periodLabel} ===`);
  lines.push(`Period: ${data.period.start} to ${data.period.end} (UTC)`);
  lines.push("");

  // ─── Task Summary ─────────────────────────────────────────
  lines.push("--- TASKS ---");
  lines.push(`Created: ${data.tasks.created.length}`);
  lines.push(`Completed: ${data.tasks.completed.length}`);
  lines.push(`Currently Pending: ${data.tasks.pending.length}`);
  lines.push(`Overdue: ${data.tasks.overdue.length}`);
  lines.push(`Cancelled: ${data.tasks.cancelled.length}`);
  if (data.tasks.avgResolutionHours) {
    lines.push(`Average Resolution Time: ${data.tasks.avgResolutionHours} hours`);
  }

  // Created tasks detail
  if (data.tasks.created.length > 0) {
    lines.push("\nTasks Created This Period:");
    for (const t of data.tasks.created.slice(0, 50)) {
      lines.push(`  #${t.id}: "${t.title}" | Assigned: ${t.assigned_to || "Unassigned"} | Priority: ${t.priority || "normal"} | Due: ${t.due_date || "none"} | Status: ${t.status} | Topic: ${t.topic_name || "General"}`);
    }
  }

  // Completed tasks detail
  if (data.tasks.completed.length > 0) {
    lines.push("\nTasks Completed This Period:");
    for (const t of data.tasks.completed.slice(0, 50)) {
      const created = formatKsaDate(t.created_at);
      const done = formatKsaDate(t.done_at);
      lines.push(`  #${t.id}: "${t.title}" | Assigned: ${t.assigned_to || "Unassigned"} | Created: ${created} | Done: ${done}`);
    }
  }

  // Overdue tasks
  if (data.tasks.overdue.length > 0) {
    lines.push("\nOverdue Tasks (CRITICAL):");
    for (const t of data.tasks.overdue) {
      lines.push(`  #${t.id}: "${t.title}" | Assigned: ${t.assigned_to || "Unassigned"} | Due: ${t.due_date} | Days Overdue: ${Math.floor((Date.now() - new Date(t.due_date).getTime()) / 86400000)}`);
    }
  }

  // Per-assignee
  if (data.tasks.byAssignee.length > 0) {
    lines.push("\nPer-Assignee Breakdown:");
    for (const a of data.tasks.byAssignee) {
      lines.push(`  ${a.assigned_to}: Total=${a.total}, Done=${a.done}, Pending=${a.pending}, Overdue=${a.overdue}`);
    }
  }

  // Per-topic
  if (data.tasks.byTopic.length > 0) {
    lines.push("\nPer-Topic Breakdown:");
    for (const t of data.tasks.byTopic) {
      lines.push(`  ${t.topic_name || "General"}: Total=${t.total}, Done=${t.done}, Pending=${t.pending}`);
    }
  }

  // ─── Activity Log ─────────────────────────────────────────
  lines.push("\n--- TEAM ACTIVITY ---");
  if (data.activityByUser.length > 0) {
    const grouped = {};
    for (const a of data.activityByUser) {
      const name = a.user_display_name || "Unknown";
      if (!grouped[name]) grouped[name] = {};
      grouped[name][a.message_type] = a.count;
    }
    for (const [name, types] of Object.entries(grouped)) {
      const parts = Object.entries(types).map(([t, c]) => `${t}: ${c}`).join(", ");
      lines.push(`  ${name}: ${parts}`);
    }
  } else {
    lines.push("  No activity recorded.");
  }

  // Sample activity messages (for context)
  if (data.activities.length > 0) {
    lines.push("\nRecent Activity Messages (sample):");
    const sample = data.activities.slice(-30);
    for (const a of sample) {
      const time = formatKsaTime(a.timestamp);
      const text = (a.caption_or_text || "").substring(0, 100);
      lines.push(`  [${time}] ${a.user_display_name} (${a.message_type}): ${text}`);
    }
  }

  // ─── Task Evidence ────────────────────────────────────────
  if (data.evidence.length > 0) {
    lines.push("\n--- PHOTO EVIDENCE SUBMITTED ---");
    for (const e of data.evidence) {
      lines.push(`  Task #${e.task_id} "${e.task_title}": "${e.caption || "no caption"}" by ${e.submitted_by} at ${formatKsaTime(e.submitted_at)}`);
    }
  }

  // ─── Meetings ─────────────────────────────────────────────
  if (data.meetings.length > 0) {
    lines.push("\n--- MEETINGS ---");
    for (const m of data.meetings) {
      lines.push(`  "${m.title}" | Status: ${m.status} | Time: ${formatKsaDate(m.meeting_datetime)} ${formatKsaTime(m.meeting_datetime)} | Attendees: ${m.attendees || "N/A"}`);
    }
  }

  // ─── Appointments ─────────────────────────────────────────
  if (data.appointments.length > 0) {
    lines.push("\n--- APPOINTMENTS ---");
    for (const a of data.appointments) {
      lines.push(`  "${a.title}" | Status: ${a.status} | Time: ${formatKsaDate(a.appointment_datetime)} ${formatKsaTime(a.appointment_datetime)} | Attendees: ${a.attendees || "N/A"} | Location: ${a.location || "N/A"}`);
    }
  }

  // ─── Escalations ──────────────────────────────────────────
  if (data.slaAlerts.length > 0) {
    lines.push("\n--- SLA ESCALATIONS ---");
    for (const s of data.slaAlerts) {
      lines.push(`  Task #${s.task_id} "${s.task_title}" | Assigned: ${s.assigned_to || "Unassigned"} | Alert: ${s.alert_type}`);
    }
  }

  // ─── Vendor Follow-ups ────────────────────────────────────
  if (data.vendorFollowups.length > 0) {
    lines.push("\n--- VENDOR FOLLOW-UPS ---");
    for (const v of data.vendorFollowups) {
      lines.push(`  "${v.vendor_name || v.message_text?.substring(0, 50)}" | Status: ${v.status} | Deadline: ${v.deadline_at || "N/A"}`);
    }
  }

  // ─── Upcoming (Next Week) ────────────────────────────────
  lines.push("\n--- UPCOMING (Next 7 Days) ---");
  if (data.upcoming.tasks.length > 0) {
    lines.push("Tasks Due:");
    for (const t of data.upcoming.tasks) {
      lines.push(`  #${t.id}: "${t.title}" | Due: ${t.due_date} | Assigned: ${t.assigned_to || "Unassigned"}`);
    }
  }
  if (data.upcoming.meetings.length > 0) {
    lines.push("Meetings:");
    for (const m of data.upcoming.meetings) {
      lines.push(`  "${m.title}" | ${formatKsaDate(m.meeting_datetime)} ${formatKsaTime(m.meeting_datetime)}`);
    }
  }
  if (data.upcoming.appointments.length > 0) {
    lines.push("Appointments:");
    for (const a of data.upcoming.appointments) {
      lines.push(`  "${a.title}" | ${formatKsaDate(a.appointment_datetime)} ${formatKsaTime(a.appointment_datetime)} | Location: ${a.location || "N/A"}`);
    }
  }

  return lines.join("\n");
}

// ─── AI Analysis ───────────────────────────────────────────────

const SYSTEM_PROMPT = `أنت مستشار عمليات محترف لشركة "المفتاح الشهري" (Monthly Key)، وهي شركة إدارة عقارات في المملكة العربية السعودية.

مهمتك: تحليل البيانات التشغيلية وتقديم تقرير شامل ومفصل.

فريق العمل:
TEAM_DIRECTORY

قواعد التقرير:
1. اكتب التقرير بالعربية أولاً، ثم بالإنجليزية بعد خط فاصل
2. استخدم أسماء أعضاء الفريق الحقيقية (ليس أسماء المستخدمين)
3. كن محدداً وعملياً — اذكر أرقام المهام والتواريخ والأسماء
4. حدد المشاكل بوضوح واقترح حلولاً عملية
5. لا تكن عاماً — كل نقطة يجب أن تكون مبنية على البيانات الفعلية
6. إذا لم تكن هناك بيانات كافية، اذكر ذلك بصراحة

هيكل التقرير المطلوب:

القسم العربي:
📊 ملخص الفترة
👥 تحليل أداء الفريق (لكل عضو)
⚠️ المشاكل المكتشفة
💡 توصيات التحسين
📅 أولويات الفترة القادمة
📈 لوحة المؤشرات

ثم خط فاصل: ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

القسم الإنجليزي:
📊 Period Summary
👥 Team Performance Analysis
⚠️ Problems Detected
💡 Improvement Suggestions
📅 Next Period Priorities
📈 Key Metrics Dashboard

استخدم الإيموجي بشكل معتدل ومهني. اجعل التقرير سهل القراءة.`;

async function generateAIAnalysis(dataSummary, periodLabel) {
  const systemPrompt = SYSTEM_PROMPT.replace("TEAM_DIRECTORY", getTeamDirectory());

  const userPrompt = `قم بتحليل البيانات التشغيلية التالية وأنشئ تقرير المستشار للفترة: ${periodLabel}

${dataSummary}

أنشئ تقريراً شاملاً ومفصلاً. ابدأ بالعربية ثم الإنجليزية.`;

  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 4000,
      temperature: 0.7,
    });

    const text = response.choices?.[0]?.message?.content;
    if (!text) throw new Error("Empty AI response");
    return text;
  } catch (error) {
    log.error("Consultant", "AI analysis failed", { error: error.message });
    throw error;
  }
}

// ─── Report Generation ─────────────────────────────────────────

/**
 * Generate a consultant report for a given period.
 * @param {string} reportType - "weekly" | "daily" | "on-demand"
 * @param {string} sinceUtc - Start of period (UTC)
 * @param {string} untilUtc - End of period (UTC)
 * @param {string} periodLabel - Human-readable label for the period
 * @returns {object} { reportText, data }
 */
async function generateReport(reportType, sinceUtc, untilUtc, periodLabel) {
  log.info("Consultant", `Generating ${reportType} report: ${periodLabel}`);

  // 1. Gather data
  const data = opsDb.getConsultantPeriodData(OPS_GROUP_ID, sinceUtc, untilUtc);

  // 2. Summarize for AI
  const dataSummary = summarizeDataForAI(data, periodLabel);
  log.info("Consultant", `Data summary: ${dataSummary.length} chars, ${dataSummary.split("\n").length} lines`);

  // 3. Generate AI analysis
  const aiAnalysis = await generateAIAnalysis(dataSummary, periodLabel);

  // 4. Build the final report
  const ksa = ksaNow();
  const dateStr = `${ksa.getUTCFullYear()}-${String(ksa.getUTCMonth() + 1).padStart(2, "0")}-${String(ksa.getUTCDate()).padStart(2, "0")}`;

  let header;
  if (reportType === "weekly") {
    header = `🧠 *تقرير المستشار الأسبوعي | Weekly Consultant Report*\n📅 ${periodLabel}\n${DIV}`;
  } else if (reportType === "daily") {
    header = `🧠 *تقرير المستشار اليومي | Daily Consultant Report*\n📅 ${dateStr}\n${DIV}`;
  } else {
    header = `🧠 *تقرير المستشار | Consultant Report*\n📅 ${periodLabel}\n${DIV}`;
  }

  // Quick stats line
  const statsLine = [
    `📋 ${data.tasks.created.length} created`,
    `✅ ${data.tasks.completed.length} completed`,
    `⏳ ${data.tasks.pending.length} pending`,
    `🔴 ${data.tasks.overdue.length} overdue`,
  ].join(" | ");

  const reportText = `${header}\n\n${statsLine}\n\n${aiAnalysis}`;

  return { reportText, data, sinceUtc, untilUtc };
}

/**
 * Generate and post a weekly consultant report.
 * Called by the scheduler every Sunday at 8 PM KSA.
 */
async function generateWeeklyReport(bot) {
  try {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const sinceUtc = weekAgo.toISOString().replace("T", " ").substring(0, 19);
    const untilUtc = now.toISOString().replace("T", " ").substring(0, 19);

    const ksa = ksaNow();
    const endDate = `${ksa.getUTCFullYear()}-${String(ksa.getUTCMonth() + 1).padStart(2, "0")}-${String(ksa.getUTCDate()).padStart(2, "0")}`;
    const startKsa = new Date(ksa.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startDate = `${startKsa.getUTCFullYear()}-${String(startKsa.getUTCMonth() + 1).padStart(2, "0")}-${String(startKsa.getUTCDate()).padStart(2, "0")}`;
    const periodLabel = `${startDate} → ${endDate}`;

    const { reportText } = await generateReport("weekly", sinceUtc, untilUtc, periodLabel);

    // Post to CEO Update topic — split if too long
    const messages = splitMessage(reportText, 4000);
    let firstMsgId = null;

    for (let i = 0; i < messages.length; i++) {
      const sent = await bot.telegram.sendMessage(OPS_GROUP_ID, messages[i], {
        parse_mode: "Markdown",
        message_thread_id: THREAD_CEO_UPDATE,
      });
      if (i === 0) firstMsgId = sent.message_id;
    }

    // Save to DB
    opsDb.saveConsultantReport("weekly", sinceUtc, untilUtc, reportText, firstMsgId);
    log.info("Consultant", `Weekly report posted (msg ${firstMsgId})`);

    return { success: true, messageId: firstMsgId };
  } catch (error) {
    log.error("Consultant", "Weekly report failed", { error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Generate and post a today-only consultant report.
 */
async function generateTodayReport(bot) {
  try {
    const now = new Date();
    const ksaOffset = KSA_OFFSET_MS;
    const ksaNowDate = new Date(now.getTime() + ksaOffset);
    const ksaMidnight = new Date(Date.UTC(ksaNowDate.getUTCFullYear(), ksaNowDate.getUTCMonth(), ksaNowDate.getUTCDate()));
    const utcStart = new Date(ksaMidnight.getTime() - ksaOffset);
    const sinceUtc = utcStart.toISOString().replace("T", " ").substring(0, 19);
    const untilUtc = now.toISOString().replace("T", " ").substring(0, 19);

    const ksa = new Date(now.getTime() + ksaOffset);
    const dateStr = `${ksa.getUTCFullYear()}-${String(ksa.getUTCMonth() + 1).padStart(2, "0")}-${String(ksa.getUTCDate()).padStart(2, "0")}`;

    const { reportText } = await generateReport("daily", sinceUtc, untilUtc, `Today: ${dateStr}`);

    const messages = splitMessage(reportText, 4000);
    let firstMsgId = null;

    for (let i = 0; i < messages.length; i++) {
      const sent = await bot.telegram.sendMessage(OPS_GROUP_ID, messages[i], {
        parse_mode: "Markdown",
        message_thread_id: THREAD_CEO_UPDATE,
      });
      if (i === 0) firstMsgId = sent.message_id;
    }

    opsDb.saveConsultantReport("daily", sinceUtc, untilUtc, reportText, firstMsgId);
    log.info("Consultant", `Today report posted (msg ${firstMsgId})`);

    return { success: true, messageId: firstMsgId };
  } catch (error) {
    log.error("Consultant", "Today report failed", { error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Generate an on-demand consultant report (since last weekly report or last 7 days).
 */
async function generateOnDemandReport(bot, threadId) {
  try {
    const lastWeekly = opsDb.getLastConsultantReport("weekly");
    const now = new Date();
    let sinceUtc;
    let periodLabel;

    if (lastWeekly && lastWeekly.period_end) {
      sinceUtc = lastWeekly.period_end;
      periodLabel = `Since last report: ${formatKsaDate(lastWeekly.period_end)} → Now`;
    } else {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      sinceUtc = weekAgo.toISOString().replace("T", " ").substring(0, 19);
      periodLabel = "Last 7 days";
    }

    const untilUtc = now.toISOString().replace("T", " ").substring(0, 19);

    const { reportText } = await generateReport("on-demand", sinceUtc, untilUtc, periodLabel);

    const targetThread = threadId || THREAD_CEO_UPDATE;
    const messages = splitMessage(reportText, 4000);
    let firstMsgId = null;

    for (let i = 0; i < messages.length; i++) {
      const sent = await bot.telegram.sendMessage(OPS_GROUP_ID, messages[i], {
        parse_mode: "Markdown",
        message_thread_id: targetThread,
      });
      if (i === 0) firstMsgId = sent.message_id;
    }

    opsDb.saveConsultantReport("on-demand", sinceUtc, untilUtc, reportText, firstMsgId);
    log.info("Consultant", `On-demand report posted (msg ${firstMsgId})`);

    return { success: true, messageId: firstMsgId };
  } catch (error) {
    log.error("Consultant", "On-demand report failed", { error: error.message });
    return { success: false, error: error.message };
  }
}

// ─── Message Splitting ─────────────────────────────────────────

function splitMessage(text, maxLen) {
  if (text.length <= maxLen) return [text];

  const parts = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      parts.push(remaining);
      break;
    }

    // Try to split at a double newline near the limit
    let splitAt = remaining.lastIndexOf("\n\n", maxLen);
    if (splitAt < maxLen * 0.5) {
      // Try single newline
      splitAt = remaining.lastIndexOf("\n", maxLen);
    }
    if (splitAt < maxLen * 0.3) {
      // Hard split
      splitAt = maxLen;
    }

    parts.push(remaining.substring(0, splitAt));
    remaining = remaining.substring(splitAt).trimStart();
  }

  return parts;
}

// ─── Exports ───────────────────────────────────────────────────

module.exports = {
  generateWeeklyReport,
  generateTodayReport,
  generateOnDemandReport,
  generateReport,
  THREAD_CEO_UPDATE,
};
