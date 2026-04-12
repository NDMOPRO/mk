/**
 * Creates the "15 — Admin Panel | لوحة الإدارة 🔐" topic in the ops group,
 * posts a bilingual pinned welcome message, and prints the new thread ID
 * so it can be added to the bot config.
 */
require("dotenv").config({ path: "./telegram-bot/.env" });

const BOT_TOKEN = process.env.BOT_TOKEN;
const OPS_GROUP_ID = -1003967447285;

async function apiCall(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram API error [${method}]: ${JSON.stringify(data)}`);
  return data.result;
}

async function main() {
  console.log("Creating Admin Panel topic...");

  // 1. Create the topic
  const topic = await apiCall("createForumTopic", {
    chat_id: OPS_GROUP_ID,
    name: "15 — Admin Panel | لوحة الإدارة 🔐",
    icon_color: 0x6FB9F0, // light blue
  });

  const threadId = topic.message_thread_id;
  console.log(`✅ Topic created! Thread ID: ${threadId}`);

  // 2. Post the bilingual welcome/description message
  const welcomeText = `🔐 *Admin Panel | لوحة الإدارة*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🇬🇧 *RESTRICTED AREA — Administrators Only*

This topic is the central control panel for the MonthlyKey bot and operations system. Only the root administrator has access.

*Available commands:*
• \`/admin config\` — View & set bot configuration
• \`/admin logs [n]\` — View last N system log entries
• \`/admin audit [user]\` — View audit trail
• \`/admin roles\` — View all team role assignments
• \`/admin setrole @user Role\` — Set a team member's role
• \`/admin schedule\` — View all scheduled jobs & next run times
• \`/admin schedule pause [job]\` — Pause a scheduled job
• \`/admin schedule resume [job]\` — Resume a scheduled job
• \`/admin broadcast [topic] [msg]\` — Send a message to a topic
• \`/admin test [command]\` — Test any bot command safely
• \`/admin stats\` — View bot usage statistics
• \`/admin db\` — View database table sizes
• \`/admin env\` — View non-sensitive environment variables
• \`/admin restart\` — Gracefully restart the bot process

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🇸🇦 *منطقة مقيدة — للمسؤولين فقط*

هذا الموضوع هو لوحة التحكم المركزية لبوت MonthlyKey ونظام العمليات. يُسمح بالوصول للمسؤول الجذر فقط.

*الأوامر المتاحة:*
• \`/admin config\` — عرض وتعديل إعدادات البوت
• \`/admin logs [n]\` — عرض آخر N سجلات النظام
• \`/admin audit [user]\` — عرض سجل التدقيق
• \`/admin roles\` — عرض جميع أدوار الفريق
• \`/admin setrole @user Role\` — تعيين دور لعضو الفريق
• \`/admin schedule\` — عرض جميع المهام المجدولة وأوقات التشغيل
• \`/admin schedule pause [job]\` — إيقاف مهمة مجدولة مؤقتاً
• \`/admin schedule resume [job]\` — استئناف مهمة مجدولة
• \`/admin broadcast [topic] [msg]\` — إرسال رسالة إلى موضوع
• \`/admin test [command]\` — اختبار أي أمر بأمان
• \`/admin stats\` — عرض إحصائيات استخدام البوت
• \`/admin db\` — عرض أحجام جداول قاعدة البيانات
• \`/admin env\` — عرض متغيرات البيئة غير الحساسة
• \`/admin restart\` — إعادة تشغيل البوت بأمان

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ All actions in this topic are logged.
⚠️ جميع الإجراءات في هذا الموضوع مسجلة.`;

  const msg = await apiCall("sendMessage", {
    chat_id: OPS_GROUP_ID,
    message_thread_id: threadId,
    text: welcomeText,
    parse_mode: "Markdown",
  });

  console.log(`✅ Welcome message sent! Message ID: ${msg.message_id}`);

  // 3. Pin the welcome message
  try {
    await apiCall("pinChatMessage", {
      chat_id: OPS_GROUP_ID,
      message_id: msg.message_id,
      disable_notification: true,
    });
    console.log("✅ Message pinned!");
  } catch (e) {
    console.warn("⚠️  Could not pin message (bot may need pin permission):", e.message);
  }

  console.log(`\n📋 Add this to ops.js THREAD_IDS:\n  ADMIN_PANEL: ${threadId}`);
  console.log(`\nDone! Topic thread ID = ${threadId}`);
}

main().catch(e => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
