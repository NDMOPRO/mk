/**
 * ops-v5.js — Feature handlers for features 40–47
 *
 * 40. Maintenance Log
 * 41. Custom Workflows
 * 42. Template Messages
 * 43. Auto-Categorization (enhanced topic routing — integrated into AI system prompt)
 * 44. Trend Analysis
 * 45. Receipt Scanner
 * 46. Weather Alerts
 * 47. Cleaning Log
 */
"use strict";

const v5Db = require("../services/ops-database-v5");
const opsDb = require("../services/ops-database");
const config = require("../config");
const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");

const OPS_GROUP_ID = -1003967447285;

// Topic thread IDs
const THREAD_CEO_UPDATE = 4;
const THREAD_OPS_FOLLOWUP = 5;

// ═══════════════════════════════════════════════════════════════
// ═══ Utility Helpers ═════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════

function getThreadId(ctx) {
  return ctx.message?.message_thread_id || null;
}

function getChatId(ctx) {
  return ctx.chat.id;
}

function getFromUser(ctx) {
  return ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name || "Unknown";
}

function formatDate(isoStr) {
  if (!isoStr) return "—";
  try {
    const d = new Date(isoStr.replace(" ", "T") + (isoStr.includes("Z") ? "" : "Z"));
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Riyadh" });
  } catch (e) {
    return isoStr.split("T")[0] || isoStr.split(" ")[0];
  }
}

function formatCurrency(amount) {
  return `${Number(amount || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} SAR`;
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 40: Maintenance Log ════════════════════════════
// ═══════════════════════════════════════════════════════════════

async function handleOpsMlog(ctx) {
  const chatId = getChatId(ctx);
  const threadId = getThreadId(ctx);
  const fromUser = getFromUser(ctx);
  const args = ctx.message.text.split(/\s+/).slice(1);

  if (!args.length || args[0] === "summary") {
    // Show summary
    const summary = v5Db.getMaintenanceSummary(chatId);
    const stats = v5Db.getMaintenanceStats(chatId);
    if (!summary.length) {
      return ctx.reply("🔧 No maintenance records yet.\n\nUsage: `/mlog unit5 \"Description\" 1500`", { parse_mode: "Markdown", message_thread_id: threadId });
    }
    let msg = `🔧 *Maintenance Summary*\n\n`;
    msg += `📊 *All Time:* ${stats.total.count} entries | ${formatCurrency(stats.total.total_cost)}\n`;
    msg += `📅 *This Month:* ${stats.thisMonth.count} entries | ${formatCurrency(stats.thisMonth.total_cost)}\n\n`;
    msg += `🏠 *By Unit:*\n`;
    for (const row of summary) {
      msg += `• *${row.unit_id}*: ${row.count} jobs | ${formatCurrency(row.total_cost)} | Last: ${formatDate(row.last_maintenance)}\n`;
    }
    if (stats.topUnits.length > 0) {
      msg += `\n🔴 *Most Maintenance Needed:*\n`;
      for (const u of stats.topUnits.slice(0, 3)) {
        msg += `• ${u.unit_id}: ${u.count} jobs\n`;
      }
    }
    return ctx.reply(msg, { parse_mode: "Markdown", message_thread_id: threadId });
  }

  // /mlog unit5 — show history for unit
  if (args.length === 1 && !args[0].startsWith('"')) {
    const unitId = args[0];
    const logs = v5Db.getMaintenanceByUnit(chatId, unitId);
    if (!logs.length) {
      return ctx.reply(`🔧 No maintenance records for *${unitId}* yet.`, { parse_mode: "Markdown", message_thread_id: threadId });
    }
    let msg = `🔧 *Maintenance History — ${unitId}*\n\n`;
    let totalCost = 0;
    for (const log of logs.slice(0, 15)) {
      msg += `• *#${log.id}* ${formatDate(log.created_at)}: ${log.description}`;
      if (log.cost > 0) msg += ` — ${formatCurrency(log.cost)}`;
      if (log.performed_by) msg += ` (${log.performed_by})`;
      msg += "\n";
      totalCost += log.cost || 0;
    }
    msg += `\n💰 *Total Cost:* ${formatCurrency(totalCost)}`;
    if (logs.length > 15) msg += `\n_...and ${logs.length - 15} more entries_`;
    return ctx.reply(msg, { parse_mode: "Markdown", message_thread_id: threadId });
  }

  // /mlog unit5 "Description" 3000 @Mushtaq
  const unitId = args[0];
  const fullText = ctx.message.text.replace(/^\/mlog\s+\S+\s*/, "");
  const descMatch = fullText.match(/"([^"]+)"/);
  const description = descMatch ? descMatch[1] : fullText.replace(/@\S+/g, "").replace(/\d+(\.\d+)?/, "").trim();
  const costMatch = fullText.match(/\b(\d+(?:\.\d+)?)\b/);
  const cost = costMatch ? parseFloat(costMatch[1]) : 0;
  const assigneeMatch = fullText.match(/@(\S+)/);
  const performedBy = assigneeMatch ? `@${assigneeMatch[1]}` : fromUser;

  if (!description) {
    return ctx.reply(`❌ Usage: \`/mlog unit5 "Description" 1500 @Mushtaq\``, { parse_mode: "Markdown", message_thread_id: threadId });
  }

  const logId = v5Db.addMaintenanceLog(chatId, unitId, description, cost, performedBy, threadId, threadId);
  let msg = `🔧 *Maintenance Logged #${logId}*\n\n`;
  msg += `🏠 Unit: *${unitId}*\n`;
  msg += `📝 ${description}\n`;
  if (cost > 0) msg += `💰 Cost: *${formatCurrency(cost)}*\n`;
  msg += `👤 By: ${performedBy}\n`;
  msg += `📅 ${formatDate(new Date().toISOString())}`;
  await ctx.reply(msg, { parse_mode: "Markdown", message_thread_id: threadId });
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 41: Custom Workflows ═══════════════════════════
// ═══════════════════════════════════════════════════════════════

async function handleOpsWorkflow(ctx) {
  const chatId = getChatId(ctx);
  const threadId = getThreadId(ctx);
  const fromUser = getFromUser(ctx);
  const text = ctx.message.text;
  const args = text.split(/\s+/).slice(1);
  const subCmd = args[0]?.toLowerCase();

  if (!subCmd || subCmd === "list") {
    const templates = v5Db.getWorkflowTemplates(chatId);
    if (!templates.length) {
      return ctx.reply(`📋 No workflow templates yet.\n\nCreate one:\n\`/workflow create "New Tenant Onboarding" "Collect documents" "Sign contract" "Hand over keys"\``, { parse_mode: "Markdown", message_thread_id: threadId });
    }
    let msg = `📋 *Workflow Templates (${templates.length})*\n\n`;
    for (const t of templates) {
      let steps;
      try { steps = JSON.parse(t.steps); } catch (e) { steps = []; }
      msg += `*${t.name}* — ${steps.length} steps\n`;
      steps.forEach((s, i) => { msg += `  ${i + 1}. ${s}\n`; });
      msg += "\n";
    }
    return ctx.reply(msg, { parse_mode: "Markdown", message_thread_id: threadId });
  }

  if (subCmd === "create") {
    // Extract quoted strings: "name" "step1" "step2" ...
    const quoted = text.match(/"([^"]+)"/g);
    if (!quoted || quoted.length < 2) {
      return ctx.reply(`❌ Usage: \`/workflow create "Workflow Name" "Step 1" "Step 2" "Step 3"\``, { parse_mode: "Markdown", message_thread_id: threadId });
    }
    const name = quoted[0].replace(/"/g, "");
    const steps = quoted.slice(1).map(s => s.replace(/"/g, ""));
    const id = v5Db.createWorkflowTemplate(chatId, name, steps, fromUser);
    let msg = `✅ *Workflow Template Created #${id}*\n\n*${name}*\n`;
    steps.forEach((s, i) => { msg += `${i + 1}. ${s}\n`; });
    msg += `\nStart it with: \`/workflow start "${name}" unit5\``;
    return ctx.reply(msg, { parse_mode: "Markdown", message_thread_id: threadId });
  }

  if (subCmd === "start") {
    const quoted = text.match(/"([^"]+)"/g);
    const unitArg = args[args.length - 1];
    if (!quoted || !unitArg) {
      return ctx.reply(`❌ Usage: \`/workflow start "Workflow Name" unit5\``, { parse_mode: "Markdown", message_thread_id: threadId });
    }
    const name = quoted[0].replace(/"/g, "");
    const unitId = unitArg.replace(/"/g, "");
    const template = v5Db.getWorkflowTemplate(chatId, name);
    if (!template) {
      return ctx.reply(`❌ Workflow template "*${name}*" not found. Use \`/workflow list\` to see available templates.`, { parse_mode: "Markdown", message_thread_id: threadId });
    }
    let steps;
    try { steps = JSON.parse(template.steps); } catch (e) { steps = []; }
    const instanceId = v5Db.startWorkflow(chatId, template.id, template.name, unitId, steps, fromUser, threadId);
    let msg = `🚀 *Workflow Started #${instanceId}*\n\n`;
    msg += `📋 *${template.name}*\n`;
    msg += `🏠 Unit: *${unitId}*\n\n`;
    msg += `*Current Step (1/${steps.length}):*\n➡️ ${steps[0]}\n\n`;
    msg += `When done, run: \`/workflow next ${unitId}\``;
    return ctx.reply(msg, { parse_mode: "Markdown", message_thread_id: threadId });
  }

  if (subCmd === "next") {
    const unitId = args[1];
    if (!unitId) return ctx.reply(`❌ Usage: \`/workflow next unit5\``, { parse_mode: "Markdown", message_thread_id: threadId });
    const instance = v5Db.getActiveWorkflow(chatId, unitId);
    if (!instance) return ctx.reply(`❌ No active workflow for *${unitId}*. Start one with \`/workflow start "Name" ${unitId}\``, { parse_mode: "Markdown", message_thread_id: threadId });
    let steps;
    try { steps = JSON.parse(instance.steps); } catch (e) { steps = []; }
    const completedStep = steps[instance.current_step];
    const updated = v5Db.advanceWorkflow(instance.id);
    if (updated.status === "completed") {
      let msg = `🎉 *Workflow Completed!*\n\n`;
      msg += `📋 *${instance.template_name}*\n`;
      msg += `🏠 Unit: *${instance.unit_id}*\n\n`;
      msg += `✅ All ${steps.length} steps completed!\n`;
      msg += `Last step: ${completedStep}`;
      return ctx.reply(msg, { parse_mode: "Markdown", message_thread_id: threadId });
    }
    const nextStep = steps[updated.current_step];
    let msg = `✅ *Step ${instance.current_step + 1} Done*\n\n`;
    msg += `~~${completedStep}~~\n\n`;
    msg += `*Next Step (${updated.current_step + 1}/${steps.length}):*\n➡️ ${nextStep}\n\n`;
    msg += `Run \`/workflow next ${unitId}\` when done.`;
    return ctx.reply(msg, { parse_mode: "Markdown", message_thread_id: threadId });
  }

  if (subCmd === "status") {
    const unitId = args[1];
    if (!unitId) return ctx.reply(`❌ Usage: \`/workflow status unit5\``, { parse_mode: "Markdown", message_thread_id: threadId });
    const instances = v5Db.getWorkflowStatus(chatId, unitId);
    if (!instances.length) return ctx.reply(`📋 No workflows found for *${unitId}*.`, { parse_mode: "Markdown", message_thread_id: threadId });
    let msg = `📋 *Workflow Status — ${unitId}*\n\n`;
    for (const inst of instances.slice(0, 5)) {
      let steps;
      try { steps = JSON.parse(inst.steps); } catch (e) { steps = []; }
      const statusEmoji = inst.status === "completed" ? "✅" : "🔄";
      msg += `${statusEmoji} *${inst.template_name}*\n`;
      msg += `  Progress: ${inst.current_step}/${inst.total_steps} steps\n`;
      msg += `  Started: ${formatDate(inst.started_at)}\n`;
      if (inst.status === "active" && steps[inst.current_step]) {
        msg += `  Current: ${steps[inst.current_step]}\n`;
      }
      msg += "\n";
    }
    return ctx.reply(msg, { parse_mode: "Markdown", message_thread_id: threadId });
  }

  if (subCmd === "delete") {
    const name = text.match(/"([^"]+)"/)?.[1] || args.slice(1).join(" ");
    if (!name) return ctx.reply(`❌ Usage: \`/workflow delete "Workflow Name"\``, { parse_mode: "Markdown", message_thread_id: threadId });
    const template = v5Db.getWorkflowTemplate(chatId, name);
    if (!template) return ctx.reply(`❌ Template "*${name}*" not found.`, { parse_mode: "Markdown", message_thread_id: threadId });
    v5Db.deleteWorkflowTemplate(template.id);
    return ctx.reply(`🗑️ Workflow template "*${name}*" deleted.`, { parse_mode: "Markdown", message_thread_id: threadId });
  }

  return ctx.reply(`📋 *Workflow Commands:*\n\n\`/workflow list\` — View templates\n\`/workflow create "Name" "Step1" "Step2"\` — Create template\n\`/workflow start "Name" unit5\` — Start workflow\n\`/workflow next unit5\` — Advance to next step\n\`/workflow status unit5\` — Check progress\n\`/workflow delete "Name"\` — Remove template`, { parse_mode: "Markdown", message_thread_id: threadId });
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 42: Template Messages ══════════════════════════
// ═══════════════════════════════════════════════════════════════

async function handleOpsTemplate(ctx) {
  const chatId = getChatId(ctx);
  const threadId = getThreadId(ctx);
  const fromUser = getFromUser(ctx);
  const text = ctx.message.text;
  const args = text.split(/\s+/).slice(1);
  const subCmd = args[0]?.toLowerCase();

  if (!subCmd || subCmd === "list") {
    const templates = v5Db.getTemplates(chatId);
    if (!templates.length) {
      return ctx.reply(`📄 No message templates yet.\n\nCreate one:\n\`/template save "inspection" "Property Inspection\\nUnit: {unit}\\nDate: {date}\\nCondition: \\nNotes: "\``, { parse_mode: "Markdown", message_thread_id: threadId });
    }
    let msg = `📄 *Message Templates (${templates.length})*\n\n`;
    for (const t of templates) {
      const preview = t.content.substring(0, 60).replace(/\n/g, " ");
      msg += `• *${t.name}* — ${preview}${t.content.length > 60 ? "..." : ""}\n`;
    }
    msg += `\nUse: \`/template use "name" unit5\``;
    return ctx.reply(msg, { parse_mode: "Markdown", message_thread_id: threadId });
  }

  if (subCmd === "save") {
    const quoted = text.match(/"([^"]+)"/g);
    if (!quoted || quoted.length < 2) {
      return ctx.reply(`❌ Usage: \`/template save "name" "Template content with {unit} and {date} variables"\``, { parse_mode: "Markdown", message_thread_id: threadId });
    }
    const name = quoted[0].replace(/"/g, "");
    const content = quoted[1].replace(/"/g, "").replace(/\\n/g, "\n");
    const id = v5Db.saveTemplate(chatId, name, content, fromUser);
    return ctx.reply(`✅ Template "*${name}*" saved (#${id}).\n\nUse it with: \`/template use "${name}" unit5\``, { parse_mode: "Markdown", message_thread_id: threadId });
  }

  if (subCmd === "use") {
    const quoted = text.match(/"([^"]+)"/g);
    const nameRaw = quoted?.[0]?.replace(/"/g, "") || args[1];
    const unitId = args[args.length - 1];
    if (!nameRaw) return ctx.reply(`❌ Usage: \`/template use "name" unit5\``, { parse_mode: "Markdown", message_thread_id: threadId });
    const template = v5Db.getTemplate(chatId, nameRaw);
    if (!template) return ctx.reply(`❌ Template "*${nameRaw}*" not found. Use \`/template list\` to see available templates.`, { parse_mode: "Markdown", message_thread_id: threadId });
    const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Riyadh" });
    const filled = template.content
      .replace(/\{unit\}/gi, unitId || "")
      .replace(/\{date\}/gi, today)
      .replace(/\{user\}/gi, fromUser)
      .replace(/\{day\}/gi, new Date().toLocaleDateString("en-GB", { weekday: "long", timeZone: "Asia/Riyadh" }));
    return ctx.reply(filled, { message_thread_id: threadId });
  }

  if (subCmd === "delete") {
    const name = text.match(/"([^"]+)"/)?.[1] || args.slice(1).join(" ");
    if (!name) return ctx.reply(`❌ Usage: \`/template delete "name"\``, { parse_mode: "Markdown", message_thread_id: threadId });
    v5Db.deleteTemplate(chatId, name);
    return ctx.reply(`🗑️ Template "*${name}*" deleted.`, { parse_mode: "Markdown", message_thread_id: threadId });
  }

  return ctx.reply(`📄 *Template Commands:*\n\n\`/template list\` — View all templates\n\`/template save "name" "content"\` — Save template\n\`/template use "name" unit5\` — Use template\n\`/template delete "name"\` — Remove template\n\n*Variables:* \`{unit}\`, \`{date}\`, \`{user}\`, \`{day}\``, { parse_mode: "Markdown", message_thread_id: threadId });
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 44: Trend Analysis ═════════════════════════════
// ═══════════════════════════════════════════════════════════════

async function handleOpsTrends(ctx, openaiClient) {
  const chatId = getChatId(ctx);
  const threadId = getThreadId(ctx);

  try {
    await ctx.sendChatAction("typing");
  } catch (e) {}

  try {
    const data = v5Db.getTrendData(chatId);

    // Build a data summary for the AI
    const dataSummary = JSON.stringify({
      tasksByMonth: data.tasksByMonth,
      expensesByMonth: data.expensesByMonth,
      maintenanceByMonth: data.maintenanceByMonth,
      repeatMaintenanceUnits: data.repeatUnits,
      tasksByTopic: data.tasksByTopic,
      avgResolutionHours: data.avgResolutionHours,
      overdueCount: data.overdueCount,
    }, null, 2);

    const prompt = `You are an operations analyst for Monthly Key, a monthly rental platform in Saudi Arabia.

Analyze this operational data and identify meaningful trends, patterns, and insights. Be specific with numbers and percentages. Highlight:
1. Task completion trends (improving/declining?)
2. Expense trends (increasing/decreasing?)
3. Maintenance patterns (which units have recurring issues?)
4. Resolution time trends
5. Topic-specific insights (which areas need attention?)
6. Any anomalies or concerns

Data:
${dataSummary}

Provide a concise, actionable analysis in 5-8 bullet points. Use emojis. Be direct and specific.`;

    const response = await openaiClient.chat.completions.create({
      model: config.aiModel || "gpt-4.1-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 800,
      temperature: 0.4,
    });

    const analysis = response.choices[0]?.message?.content || "Unable to generate analysis.";

    let msg = `📈 *Operational Trends Analysis*\n`;
    msg += `_Generated: ${new Date().toLocaleDateString("en-GB", { timeZone: "Asia/Riyadh" })}_\n\n`;
    msg += analysis;

    try {
      await ctx.reply(msg, { parse_mode: "Markdown", message_thread_id: threadId });
    } catch (e) {
      await ctx.reply(msg.replace(/[_*`\[\]]/g, ""), { message_thread_id: threadId });
    }
  } catch (error) {
    console.error("[Ops-v5] Trends error:", error.message);
    await ctx.reply("❌ Error generating trend analysis. Please try again.", { message_thread_id: threadId });
  }
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 45: Receipt Scanner ════════════════════════════
// ═══════════════════════════════════════════════════════════════

async function handleReceiptScan(ctx, openaiClient) {
  const chatId = getChatId(ctx);
  const threadId = getThreadId(ctx);
  const fromUser = getFromUser(ctx);

  if (!ctx.message.photo) return false;

  try {
    // Get the highest resolution photo
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    const file = await ctx.telegram.getFile(photo.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${config.botToken}/${file.file_path}`;

    // Use OpenAI Vision to check if it's a receipt and extract data
    const response = await openaiClient.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [{
        role: "user",
        content: [
          {
            type: "text",
            text: `Analyze this image. Is it a receipt, invoice, or bill?

If YES, extract:
- amount (number only, in SAR or convert to SAR if another currency)
- vendor (store/company name)
- date (YYYY-MM-DD format, or today if not visible)
- description (what was purchased/service provided)
- category (one of: maintenance, supplies, utilities, services, food, transport, other)

Respond in JSON format:
{
  "is_receipt": true/false,
  "amount": 1500,
  "vendor": "Al-Faisal Store",
  "date": "2026-04-12",
  "description": "AC parts and compressor",
  "category": "maintenance",
  "confidence": "high/medium/low"
}

If NOT a receipt, respond: {"is_receipt": false}`
          },
          {
            type: "image_url",
            image_url: { url: fileUrl, detail: "low" }
          }
        ]
      }],
      max_tokens: 300,
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content || "{}";
    let parsed;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch (e) {
      return false;
    }

    if (!parsed.is_receipt) return false;

    // Auto-log as expense
    const caption = ctx.message.caption || "";
    const propertyMatch = caption.match(/#(\w+)/);
    const propertyTag = propertyMatch ? propertyMatch[1] : null;

    const expId = opsDb.addExpense(chatId, threadId, "Receipt Scan", parsed.amount, parsed.description || `Receipt from ${parsed.vendor}`, {
      propertyTag: propertyTag,
      category: parsed.category || "other",
      createdBy: fromUser,
    });

    let msg = `🧾 *Receipt Scanned!*\n\n`;
    msg += `💰 Amount: *${formatCurrency(parsed.amount)}*\n`;
    msg += `🏪 Vendor: *${parsed.vendor || "Unknown"}*\n`;
    msg += `📝 ${parsed.description || "Receipt"}\n`;
    msg += `📂 Category: ${parsed.category || "other"}\n`;
    if (parsed.date) msg += `📅 Date: ${parsed.date}\n`;
    if (propertyTag) msg += `🏠 Property: #${propertyTag}\n`;
    msg += `\n✅ Logged as Expense #${expId}`;
    if (parsed.confidence === "low") msg += `\n\n⚠️ _Low confidence — please verify the amount_`;

    await ctx.reply(msg, { parse_mode: "Markdown", message_thread_id: threadId });
    return true;
  } catch (error) {
    console.error("[Ops-v5] Receipt scan error:", error.message);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 46: Weather Command Handler ════════════════════
// ═══════════════════════════════════════════════════════════════

async function handleOpsWeather(ctx) {
  const chatId = getChatId(ctx);
  const threadId = getThreadId(ctx);

  try {
    await ctx.sendChatAction("typing");
  } catch (e) {}

  try {
    const weatherData = await fetchWeatherRiyadh();
    if (!weatherData) {
      return ctx.reply("❌ Could not fetch weather data. Please try again.", { message_thread_id: threadId });
    }

    const { current, forecast } = weatherData;
    let msg = `🌤️ *Weather — Riyadh*\n`;
    msg += `_${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "short", timeZone: "Asia/Riyadh" })}_\n\n`;
    msg += `🌡️ Temperature: *${current.temp}°C* (feels like ${current.feels_like}°C)\n`;
    msg += `💧 Humidity: ${current.humidity}%\n`;
    msg += `💨 Wind: ${current.wind_speed} km/h\n`;
    msg += `☁️ Conditions: ${current.description}\n`;

    if (forecast && forecast.length > 0) {
      msg += `\n📅 *3-Day Forecast:*\n`;
      for (const day of forecast.slice(0, 3)) {
        const emoji = day.max_temp > 45 ? "🔥" : day.max_temp > 40 ? "☀️" : day.description.includes("rain") ? "🌧️" : day.description.includes("cloud") ? "⛅" : "☀️";
        msg += `${emoji} ${day.date}: ${day.min_temp}–${day.max_temp}°C, ${day.description}\n`;
      }
    }

    // Alerts
    const alerts = generateWeatherAlerts(current, forecast);
    if (alerts.length > 0) {
      msg += `\n⚠️ *Alerts:*\n`;
      for (const alert of alerts) msg += `• ${alert}\n`;
    }

    await ctx.reply(msg, { parse_mode: "Markdown", message_thread_id: threadId });
  } catch (error) {
    console.error("[Ops-v5] Weather command error:", error.message);
    await ctx.reply("❌ Error fetching weather. Please try again.", { message_thread_id: threadId });
  }
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 46: Weather Fetch & Alert Logic ════════════════
// ═══════════════════════════════════════════════════════════════

function fetchWeatherRiyadh() {
  return new Promise((resolve) => {
    const url = "https://wttr.in/Riyadh?format=j1";
    const client = https;
    const req = client.get(url, { headers: { "User-Agent": "MonthlyKeyBot/1.0" } }, (res) => {
      let data = "";
      res.on("data", chunk => { data += chunk; });
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          const current = json.current_condition?.[0];
          const weather = json.weather;
          if (!current) return resolve(null);

          const parsed = {
            current: {
              temp: parseInt(current.temp_C),
              feels_like: parseInt(current.FeelsLikeC),
              humidity: parseInt(current.humidity),
              wind_speed: parseInt(current.windspeedKmph),
              description: current.weatherDesc?.[0]?.value || "Clear",
            },
            forecast: weather ? weather.map(day => ({
              date: day.date,
              min_temp: parseInt(day.mintempC),
              max_temp: parseInt(day.maxtempC),
              description: day.hourly?.[4]?.weatherDesc?.[0]?.value || "Clear",
            })) : [],
          };
          resolve(parsed);
        } catch (e) {
          resolve(null);
        }
      });
    });
    req.on("error", () => resolve(null));
    req.setTimeout(8000, () => { req.destroy(); resolve(null); });
  });
}

function generateWeatherAlerts(current, forecast) {
  const alerts = [];
  if (current.temp > 45) alerts.push(`🔥 Extreme heat (${current.temp}°C) — Check AC units in all properties`);
  else if (current.temp > 42) alerts.push(`☀️ Very hot (${current.temp}°C) — Ensure AC is working in all units`);
  if (current.description.toLowerCase().includes("sand") || current.description.toLowerCase().includes("dust")) {
    alerts.push("🌪️ Sandstorm/dust conditions — Close windows in vacant units");
  }
  if (current.description.toLowerCase().includes("rain")) {
    alerts.push("🌧️ Rain detected — Check for leaks in properties");
  }
  if (forecast) {
    for (const day of forecast.slice(0, 2)) {
      if (day.max_temp > 45) alerts.push(`🔥 Extreme heat forecast for ${day.date} (${day.max_temp}°C)`);
      if (day.description.toLowerCase().includes("sand")) alerts.push(`🌪️ Sandstorm forecast for ${day.date}`);
    }
  }
  return alerts;
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 46: Weather Auto-Check (for scheduler) ═════════
// ═══════════════════════════════════════════════════════════════

async function checkAndPostWeatherAlerts(bot) {
  try {
    const weatherData = await fetchWeatherRiyadh();
    if (!weatherData) return;

    const { current, forecast } = weatherData;
    const alerts = generateWeatherAlerts(current, forecast);

    if (alerts.length === 0) {
      console.log("[OpsScheduler] Weather check: no alerts");
      return;
    }

    let msg = `⚠️ *Weather Alert — Riyadh*\n\n`;
    msg += `🌡️ Current: *${current.temp}°C*, ${current.description}\n\n`;
    msg += `*Action Required:*\n`;
    for (const alert of alerts) msg += `• ${alert}\n`;
    msg += `\n_Please take appropriate action for all properties._`;

    await bot.telegram.sendMessage(OPS_GROUP_ID, msg, {
      parse_mode: "Markdown",
      message_thread_id: THREAD_OPS_FOLLOWUP,
    });
    console.log(`[OpsScheduler] Weather alert posted (${alerts.length} alerts)`);
  } catch (error) {
    console.error("[OpsScheduler] Weather check error:", error.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 47: Cleaning Log ════════════════════════════════
// ═══════════════════════════════════════════════════════════════

async function handleOpsClean(ctx) {
  const chatId = getChatId(ctx);
  const threadId = getThreadId(ctx);
  const fromUser = getFromUser(ctx);
  const text = ctx.message.text;
  const args = text.split(/\s+/).slice(1);
  const subCmd = args[0]?.toLowerCase();

  const CLEAN_TYPES = { checkin: "Check-in Cleaning", checkout: "Check-out Cleaning", deep: "Deep Cleaning" };

  if (!subCmd || subCmd === "summary") {
    const summary = v5Db.getCleaningSummary(chatId);
    const pending = v5Db.getPendingCleanings(chatId);
    let msg = `🧹 *Cleaning Summary*\n\n`;
    if (pending.length > 0) {
      msg += `⏳ *Pending Cleanings (${pending.length}):*\n`;
      for (const p of pending) {
        msg += `• ${p.unit_id} — ${CLEAN_TYPES[p.cleaning_type] || p.cleaning_type} (since ${formatDate(p.created_at)})\n`;
      }
      msg += "\n";
    }
    if (summary.byUnit.length > 0) {
      msg += `🏠 *By Unit (this month):*\n`;
      for (const u of summary.byUnit.slice(0, 10)) {
        msg += `• *${u.unit_id}*: ${u.count} cleanings | Last: ${formatDate(u.last_cleaned)}\n`;
      }
      msg += "\n";
    }
    if (summary.byCleaner.length > 0) {
      msg += `👤 *By Cleaner (this month):*\n`;
      for (const c of summary.byCleaner) {
        msg += `• ${c.cleaner_name || "Unknown"}: ${c.count} cleanings\n`;
      }
    }
    if (!summary.byUnit.length && !pending.length) {
      msg += "No cleaning records yet.\n\nUsage:\n`/clean checkin unit5 @CleanerName`\n`/clean checkout unit5 @CleanerName`\n`/clean deep unit5 @CleanerName`";
    }
    return ctx.reply(msg, { parse_mode: "Markdown", message_thread_id: threadId });
  }

  if (subCmd === "pending") {
    const pending = v5Db.getPendingCleanings(chatId);
    if (!pending.length) return ctx.reply("✅ No pending cleanings!", { message_thread_id: threadId });
    let msg = `⏳ *Pending Cleanings (${pending.length})*\n\n`;
    for (const p of pending) {
      msg += `• *${p.unit_id}* — ${CLEAN_TYPES[p.cleaning_type] || p.cleaning_type}\n`;
      msg += `  Created: ${formatDate(p.created_at)}\n`;
      if (p.notes) msg += `  Notes: ${p.notes}\n`;
    }
    return ctx.reply(msg, { parse_mode: "Markdown", message_thread_id: threadId });
  }

  if (subCmd === "status") {
    const unitId = args[1];
    if (!unitId) return ctx.reply(`❌ Usage: \`/clean status unit5\``, { parse_mode: "Markdown", message_thread_id: threadId });
    const logs = v5Db.getCleaningByUnit(chatId, unitId);
    if (!logs.length) return ctx.reply(`🧹 No cleaning records for *${unitId}* yet.`, { parse_mode: "Markdown", message_thread_id: threadId });
    let msg = `🧹 *Cleaning History — ${unitId}*\n\n`;
    for (const log of logs.slice(0, 10)) {
      const statusEmoji = log.status === "completed" ? "✅" : "⏳";
      msg += `${statusEmoji} *${CLEAN_TYPES[log.cleaning_type] || log.cleaning_type}*\n`;
      msg += `  Date: ${formatDate(log.created_at)}\n`;
      if (log.cleaner_name) msg += `  Cleaner: ${log.cleaner_name}\n`;
      if (log.notes) msg += `  Notes: ${log.notes}\n`;
      msg += "\n";
    }
    return ctx.reply(msg, { parse_mode: "Markdown", message_thread_id: threadId });
  }

  // /clean checkin|checkout|deep unit5 @CleanerName notes
  if (["checkin", "checkout", "deep"].includes(subCmd)) {
    const unitId = args[1];
    if (!unitId) return ctx.reply(`❌ Usage: \`/clean ${subCmd} unit5 @CleanerName\``, { parse_mode: "Markdown", message_thread_id: threadId });
    const cleanerMatch = text.match(/@(\S+)/);
    const cleanerName = cleanerMatch ? `@${cleanerMatch[1]}` : fromUser;
    const notesRaw = text.replace(/^\/clean\s+\S+\s+\S+\s*(@\S+)?\s*/, "").trim();
    const notes = notesRaw || null;

    const logId = v5Db.addCleaningLog(chatId, unitId, subCmd, cleanerName, notes, threadId);

    // If checkout cleaning, check if there's a pending checkout cleaning and mark it done
    const pending = v5Db.getPendingCleanings(chatId).filter(p => p.unit_id === unitId.toLowerCase() && p.cleaning_type === subCmd);
    if (pending.length > 0) {
      v5Db.markCleaningComplete(pending[0].id, cleanerName);
    }

    let msg = `🧹 *${CLEAN_TYPES[subCmd]} Logged #${logId}*\n\n`;
    msg += `🏠 Unit: *${unitId}*\n`;
    msg += `👤 Cleaner: ${cleanerName}\n`;
    if (notes) msg += `📝 Notes: ${notes}\n`;
    msg += `📅 ${formatDate(new Date().toISOString())}`;
    return ctx.reply(msg, { parse_mode: "Markdown", message_thread_id: threadId });
  }

  return ctx.reply(`🧹 *Cleaning Log Commands:*\n\n\`/clean checkin unit5 @CleanerName\` — Log check-in cleaning\n\`/clean checkout unit5 @CleanerName\` — Log check-out cleaning\n\`/clean deep unit5 @CleanerName\` — Log deep cleaning\n\`/clean status unit5\` — History for a unit\n\`/clean pending\` — Units needing cleaning\n\`/clean summary\` — Overall stats`, { parse_mode: "Markdown", message_thread_id: threadId });
}

// ═══════════════════════════════════════════════════════════════
// ═══ Cleaning auto-trigger on occupancy changes ══════════════
// ═══════════════════════════════════════════════════════════════

/**
 * Called when a unit is vacated — auto-creates a pending checkout cleaning
 */
function triggerCheckoutCleaning(chatId, unitId) {
  try {
    v5Db.createPendingCleaning(chatId, unitId, "checkout", "Auto-created: unit vacated");
    console.log(`[Ops-v5] Pending checkout cleaning created for ${unitId}`);
  } catch (e) {
    console.error("[Ops-v5] triggerCheckoutCleaning error:", e.message);
  }
}

/**
 * Called before a unit is occupied — check if checkout cleaning was done
 */
function checkCleaningBeforeOccupy(chatId, unitId) {
  try {
    const lastCheckout = v5Db.getLastCleaning(chatId, unitId, "checkout");
    if (!lastCheckout) return { clean: false, message: `⚠️ No checkout cleaning recorded for *${unitId}*. Please ensure cleaning is done before new tenant moves in.` };
    const daysSince = Math.floor((Date.now() - new Date(lastCheckout.created_at.replace(" ", "T") + "Z").getTime()) / 86400000);
    if (daysSince > 7) return { clean: false, message: `⚠️ Last checkout cleaning for *${unitId}* was ${daysSince} days ago. Consider a fresh cleaning before new tenant.` };
    return { clean: true, message: `✅ Checkout cleaning done ${daysSince === 0 ? "today" : `${daysSince} day(s) ago`} by ${lastCheckout.cleaner_name || "unknown"}.` };
  } catch (e) {
    return { clean: true, message: null };
  }
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 44: Trend Analysis for Weekly Standup ══════════
// ═══════════════════════════════════════════════════════════════

async function generateTrendsSummary(chatId, openaiClient) {
  try {
    const data = v5Db.getTrendData(chatId);
    if (!data.tasksByMonth.length) return null;

    const dataSummary = JSON.stringify({
      tasksByMonth: data.tasksByMonth.slice(0, 3),
      maintenanceByMonth: data.maintenanceByMonth.slice(0, 3),
      repeatUnits: data.repeatUnits.slice(0, 5),
      avgResolutionHours: data.avgResolutionHours,
      overdueCount: data.overdueCount,
    });

    const response = await openaiClient.chat.completions.create({
      model: config.aiModel || "gpt-4.1-mini",
      messages: [{
        role: "user",
        content: `Analyze this operational data and provide 3 key trends in 3 bullet points (max 2 lines each). Be specific with numbers.\n\nData: ${dataSummary}`,
      }],
      max_tokens: 250,
      temperature: 0.4,
    });
    return response.choices[0]?.message?.content || null;
  } catch (e) {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// ═══ Initialize v5 Tables ════════════════════════════════════
// ═══════════════════════════════════════════════════════════════

function initV5() {
  try {
    v5Db.initV5Tables();
    console.log("[Ops-v5] Initialized");
  } catch (e) {
    console.error("[Ops-v5] Init error:", e.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 48: Ideas & Brainstorming ══════════════════════
// ═══════════════════════════════════════════════════════════════

async function handleOpsIdea(ctx) {
  const chatId = getChatId(ctx);
  const text = ctx.message.text.split(" ").slice(1).join(" ");
  const fromUser = getFromUser(ctx);
  const threadId = getThreadId(ctx);

  if (ctx.message.text.includes(" vote ")) {
    const id = parseInt(ctx.message.text.split(" vote ")[1]);
    const res = v5Db.voteIdea(id, ctx.from.id);
    if (res.alreadyVoted) return ctx.reply("⚠️ You already voted for this idea.");
    return ctx.reply(`✅ Upvoted idea #${id}! Total votes updated.`);
  }

  if (ctx.message.text.includes(" status ")) {
    const parts = ctx.message.text.split(" ");
    const id = parseInt(parts[2]);
    const status = parts[3];
    v5Db.setIdeaStatus(id, status);
    return ctx.reply(`✅ Idea #${id} status updated to: ${status}`);
  }

  if (!text) return ctx.reply("Usage: /idea \"Description of your idea\"");
  const id = v5Db.addIdea(chatId, text, fromUser, threadId);
  ctx.reply(`💡 *New Idea Logged* [#${id}]\n\n"${text}"\n\nSubmitted by: ${fromUser}\nTopic: 13 — Ideas & Brainstorming`, { parse_mode: "Markdown" });
}

async function handleOpsIdeas(ctx) {
  const chatId = getChatId(ctx);
  const ideas = v5Db.getIdeas(chatId);
  if (ideas.length === 0) return ctx.reply("No ideas logged yet.");
  let msg = "💡 *Monthly Key Idea Board*\n\n";
  ideas.forEach(i => {
    msg += `[#${i.id}] **${i.description}**\n👤 ${i.submitted_by} | 👍 ${i.votes} | 🏷️ ${i.status}\n\n`;
  });
  ctx.reply(msg, { parse_mode: "Markdown" });
}

async function handleOpsBrainstorm(ctx) {
  const chatId = getChatId(ctx);
  const threadId = getThreadId(ctx);
  const fromUser = getFromUser(ctx);
  const text = ctx.message.text.split(" ").slice(1).join(" ");

  if (ctx.message.text.startsWith("/brainstorm end")) {
    const session = v5Db.getActiveBrainstormSession(chatId, threadId);
    if (!session) return ctx.reply("No active brainstorming session in this topic.");
    const messages = v5Db.getBrainstormMessages(session.id);
    
    await ctx.reply("🧠 *Ending session and generating AI summary...*", { parse_mode: "Markdown" });
    
    const chatContent = messages.map(m => `${m.from_user}: ${m.message}`).join("\n");
    const openai = require("../services/ai").getOpenAIClient();
    const prompt = `Analyze this brainstorming session about "${session.topic}". Generate a structured summary with:
1. Key Themes
2. Top Ideas
3. Actionable Suggestions
4. Decisions Made (if any)

Session Content:
${chatContent}`;

    const response = await openai.chat.completions.create({
      model: config.aiModel || "gpt-4.1-mini",
      messages: [{ role: "system", content: "You are a professional business consultant." }, { role: "user", content: prompt }],
      max_tokens: 1000
    });

    const summary = response.choices[0].message.content;
    v5Db.endBrainstormSession(session.id, summary);
    return ctx.reply(`🏁 *Brainstorming Summary: ${session.topic}*\n\n${summary}`, { parse_mode: "Markdown" });
  }

  if (!text) return ctx.reply("Usage: /brainstorm start \"Topic Name\"");
  v5Db.startBrainstormSession(chatId, text, fromUser, threadId);
  ctx.reply(`🧠 *Brainstorming Session Started!* 🧠\n\nTopic: **${text}**\nStarted by: ${fromUser}\n\nAll messages in this topic will now be captured. Use /brainstorm end to finish and generate a summary.`, { parse_mode: "Markdown" });
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 49: Property Photos Approval ════════════════════
// ═══════════════════════════════════════════════════════════════

async function handleOpsPhotos(ctx) {
  const chatId = getChatId(ctx);
  const text = ctx.message.text;
  
  if (text.includes(" pending")) {
    const pending = v5Db.getPropertyPhotos(chatId, null, 'pending');
    if (pending.length === 0) return ctx.reply("No photos pending approval.");
    return ctx.reply(`📸 There are ${pending.length} photos waiting for review. Check the Property Photos topic.`);
  }

  const unitId = text.split(" ")[1];
  if (!unitId) return ctx.reply("Usage: /photos unit5");
  const photos = v5Db.getPropertyPhotos(chatId, unitId, 'approved');
  if (photos.length === 0) return ctx.reply(`No approved photos found for ${unitId}.`);
  
  await ctx.reply(`📸 *Approved Photos for ${unitId}* (${photos.length})`, { parse_mode: "Markdown" });
  for (const p of photos.slice(0, 5)) {
    await ctx.replyWithPhoto(p.file_id, { caption: `✅ Approved by ${p.reviewed_by}\n${p.caption || ""}` });
  }
}

async function handlePhotoReviewCallback(ctx) {
  const [_, action, id] = ctx.match;
  const fromUser = getFromUser(ctx);
  const photo = v5Db.getPhotoById(id);
  if (!photo) return ctx.answerCbQuery("Photo not found.");

  if (action === "approve") {
    v5Db.approvePhoto(id, fromUser);
    await ctx.editMessageCaption(`✅ **PHOTO APPROVED** for website\nUnit: ${photo.unit_id}\nReviewed by: ${fromUser}`, { parse_mode: "Markdown" });
    await ctx.answerCbQuery("Photo approved for website!");
  } else {
    v5Db.rejectPhoto(id, fromUser, "Rejected via button");
    await ctx.editMessageCaption(`❌ **PHOTO REJECTED**\nUnit: ${photo.unit_id}\nReviewed by: ${fromUser}`, { parse_mode: "Markdown" });
    await ctx.answerCbQuery("Photo rejected.");
  }
}

module.exports = {
  // Feature 40
  handleOpsMlog,
  // Feature 41
  handleOpsWorkflow,
  // Feature 42
  handleOpsTemplate,
  // Feature 44
  handleOpsTrends,
  generateTrendsSummary,
  // Feature 45
  handleReceiptScan,
  // Feature 46
  handleOpsWeather,
  checkAndPostWeatherAlerts,
  fetchWeatherRiyadh,
  generateWeatherAlerts,
  // Feature 47
  handleOpsClean,
  triggerCheckoutCleaning,
  checkCleaningBeforeOccupy,
  // Feature 48
  handleOpsIdea,
  handleOpsIdeas,
  handleOpsBrainstorm,
  // Feature 49
  handleOpsPhotos,
  handlePhotoReviewCallback,
  // Init
  initV5,
};
