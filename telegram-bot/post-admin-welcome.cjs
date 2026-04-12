require("dotenv").config();
const BOT_TOKEN = process.env.BOT_TOKEN;
const OPS_GROUP_ID = -1003967447285;
const ADMIN_THREAD = 235;

async function api(method, body) {
  const r = await fetch("https://api.telegram.org/bot" + BOT_TOKEN + "/" + method, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const d = await r.json();
  if (!d.ok) throw new Error(method + ": " + JSON.stringify(d));
  return d.result;
}

const welcomeText = [
  "🔐 *Admin Panel | لوحة الإدارة*",
  "",
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
  "🇬🇧 *RESTRICTED AREA — Administrators Only*",
  "",
  "This topic is the central control panel for the MonthlyKey bot and operations system.",
  "Only the root administrator has access. All actions here are logged.",
  "",
  "*Available commands:*",
  "• `/admin config` — View bot configuration",
  "• `/admin logs [n]` — View last N system log entries",
  "• `/admin audit [user]` — View audit trail",
  "• `/admin roles` — View all team role assignments",
  "• `/admin setrole @user Role` — Set a team member role",
  "• `/admin schedule` — View all scheduled jobs & next run times",
  "• `/admin broadcast [topic] [msg]` — Send message to a topic",
  "• `/admin test [command]` — Test any bot command safely",
  "• `/admin stats` — View bot usage statistics",
  "• `/admin db` — View database table sizes",
  "• `/admin env` — View non-sensitive environment variables",
  "",
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
  "🇸🇦 *منطقة مقيدة — للمسؤولين فقط*",
  "",
  "هذا الموضوع هو لوحة التحكم المركزية لبوت MonthlyKey ونظام العمليات.",
  "يُسمح بالوصول للمسؤول الجذر فقط. جميع الإجراءات مسجلة.",
  "",
  "*الأوامر المتاحة:*",
  "• `/admin config` — عرض إعدادات البوت",
  "• `/admin logs [n]` — عرض آخر N سجلات النظام",
  "• `/admin audit [user]` — عرض سجل التدقيق",
  "• `/admin roles` — عرض جميع أدوار الفريق",
  "• `/admin setrole @user Role` — تعيين دور لعضو الفريق",
  "• `/admin schedule` — عرض المهام المجدولة وأوقات التشغيل",
  "• `/admin broadcast [topic] [msg]` — إرسال رسالة لموضوع",
  "• `/admin test [command]` — اختبار أي أمر بأمان",
  "• `/admin stats` — إحصائيات استخدام البوت",
  "• `/admin db` — أحجام جداول قاعدة البيانات",
  "• `/admin env` — متغيرات البيئة غير الحساسة",
  "",
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
  "⚠️ Thread ID: 235 | Bot: @monthlykey\\_bot",
].join("\n");

async function main() {
  console.log("Posting welcome message to thread 235...");
  const msg = await api("sendMessage", {
    chat_id: OPS_GROUP_ID,
    message_thread_id: ADMIN_THREAD,
    text: welcomeText,
    parse_mode: "Markdown",
  });
  console.log("Message sent! ID:", msg.message_id);

  try {
    await api("pinChatMessage", {
      chat_id: OPS_GROUP_ID,
      message_id: msg.message_id,
      disable_notification: true,
    });
    console.log("Message pinned!");
  } catch (e) {
    console.warn("Pin failed (may need pin permission):", e.message);
  }

  console.log("\nDone! Admin Panel topic is live at thread ID 235.");
}

main().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
