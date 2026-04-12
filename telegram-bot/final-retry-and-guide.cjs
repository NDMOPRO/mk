/**
 * Final Retry for Topic 09 and 49-Feature Guide
 */

require('dotenv').config();
const https = require('https');
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = '-1003967447285';

function api(method, params) {
  return new Promise(function(resolve) {
    var body = JSON.stringify(params);
    var req = https.request({
      hostname: 'api.telegram.org',
      path: '/bot' + BOT_TOKEN + '/' + method,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, function(res) {
      var d = '';
      res.on('data', function(c) { d += c; });
      res.on('end', function() { try { resolve(JSON.parse(d)); } catch(e) { resolve({ raw: d }); } });
    });
    req.on('error', function(e) { resolve({ error: e.message }); });
    req.write(body);
    req.end();
  });
}

function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

const legalText = 
'⚖️ <b>09 — Legal & Compliance | القانونية والامتثال</b>\n' +
'\n' +
'Handle all legal matters, contract management, regulatory compliance, and licensing requirements. Sensitive discussions should be handled with discretion.\n' +
'\n' +
'<b>📌 What Belongs Here:</b>\n' +
'• Contract reviews and negotiations\n' +
'• Regulatory compliance updates\n' +
'• License renewals and permits\n' +
'• Legal disputes and resolutions\n' +
'\n' +
'<b>🔑 Key Commands:</b>\n' +
'• <code>/task [legal matter]</code> — Track a legal item\n' +
'• <code>/remind [date] [deadline]</code> — Set compliance deadline\n' +
'• <code>/approve [id]</code> — Approve a legal document\n' +
'\n' +
'<b>⚠️ Confidentiality:</b> Legal matters are sensitive. Do not share details outside this topic.\n' +
'\n' +
'━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
'\n' +
'التعامل مع جميع المسائل القانونية وإدارة العقود والامتثال التنظيمي ومتطلبات الترخيص. يجب التعامل مع المناقشات الحساسة بحذر.\n' +
'\n' +
'<b>📌 ما ينتمي هنا:</b>\n' +
'• مراجعات العقود والمفاوضات\n' +
'• تحديثات الامتثال التنظيمي\n' +
'• تجديد التراخيص والتصاريح\n' +
'• النزاعات القانونية والحلول\n' +
'\n' +
'<b>🔑 الأوامر الرئيسية:</b>\n' +
'• <code>/task [المسألة القانونية]</code> — تتبع عنصر قانوني\n' +
'• <code>/remind [التاريخ] [الموعد النهائي]</code> — تعيين موعد امتثال\n' +
'• <code>/approve [رقم]</code> — الموافقة على وثيقة قانونية\n' +
'\n' +
'<b>⚠️ السرية:</b> المسائل القانونية حساسة. لا تشارك التفاصيل خارج هذا الموضوع.';

const guideText = 
'📘 <b>Monthly Key Operations HQ — 49 Feature Guide</b>\n' +
'<b>دليل المقر التشغيلي لمفتاح الشهر — ٤٩ ميزة</b>\n' +
'\n' +
'This bot is a comprehensive operations management system divided into 4 phases. Below is a summary of all capabilities:\n' +
'\n' +
'<b>Phase 1: Foundation (Core Ops)</b>\n' +
'• Task management (<code>/task</code>, <code>/tasks</code>, <code>/done</code>)\n' +
'• Reminders (<code>/remind</code>)\n' +
'• Expense tracking (<code>/expense</code>, <code>/expenses</code>)\n' +
'• Admin controls (<code>/admin</code>)\n' +
'\n' +
'<b>Phase 2: Team Performance</b>\n' +
'• KPI tracking (<code>/kpi</code>)\n' +
'• Performance reports (<code>/report</code>)\n' +
'• Team availability (<code>/away</code>, <code>/back</code>)\n' +
'• Role management (<code>/roles</code>, <code>/setrole</code>)\n' +
'\n' +
'<b>Phase 3: Operations Automation</b>\n' +
'• Checklists (<code>/checklist</code>)\n' +
'• Handovers (<code>/handover</code>)\n' +
'• SLA monitoring (<code>/sla</code>)\n' +
'• Escalations (<code>/escalate</code>)\n' +
'\n' +
'<b>Phase 4: Advanced Systems</b>\n' +
'• Maintenance logs (<code>/mlog</code>)\n' +
'• Cleaning logs (<code>/clean</code>)\n' +
'• Idea board with voting (<code>/idea</code>, <code>/ideas</code>)\n' +
'• Meeting management (<code>/meeting start/end/note</code>)\n' +
'• Message templates (<code>/template</code>)\n' +
'• Property photo logs (<code>/photos</code>)\n' +
'\n' +
'<b>Automated Briefings:</b>\n' +
'• ☀️ Morning Briefing: 9:00 AM KSA\n' +
'• 📊 Daily Report: 9:00 PM KSA\n' +
'• 🌤️ Weather Alerts: 7:00 AM KSA\n' +
'• 📋 Check-in Reminders: 5:00 PM KSA\n' +
'\n' +
'━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
'\n' +
'هذا البوت هو نظام إدارة عمليات شامل مقسم إلى ٤ مراحل. فيما يلي ملخص لجميع الإمكانيات:\n' +
'\n' +
'<b>المرحلة ١: الأساس (العمليات الأساسية)</b>\n' +
'• إدارة المهام (<code>/task</code>, <code>/tasks</code>, <code>/done</code>)\n' +
'• التذكيرات (<code>/remind</code>)\n' +
'• تتبع المصروفات (<code>/expense</code>, <code>/expenses</code>)\n' +
'• ضوابط المسؤول (<code>/admin</code>)\n' +
'\n' +
'<b>المرحلة ٢: أداء الفريق</b>\n' +
'• تتبع مؤشرات الأداء (<code>/kpi</code>)\n' +
'• تقارير الأداء (<code>/report</code>)\n' +
'• توفر الفريق (<code>/away</code>, <code>/back</code>)\n' +
'• إدارة الأدوار (<code>/roles</code>, <code>/setrole</code>)\n' +
'\n' +
'<b>المرحلة ٣: أتمتة العمليات</b>\n' +
'• قوائم المهام (<code>/checklist</code>)\n' +
'• تسليم المهام (<code>/handover</code>)\n' +
'• مراقبة اتفاقية الخدمة (<code>/sla</code>)\n' +
'• التصعيد (<code>/escalate</code>)\n' +
'\n' +
'<b>المرحلة ٤: الأنظمة المتقدمة</b>\n' +
'• سجلات الصيانة (<code>/mlog</code>)\n' +
'• سجلات التنظيف (<code>/clean</code>)\n' +
'• لوحة الأفكار مع التصويت (<code>/idea</code>, <code>/ideas</code>)\n' +
'• إدارة الاجتماعات (<code>/meeting</code>)\n' +
'• قوالب الرسائل (<code>/template</code>)\n' +
'• سجلات صور العقارات (<code>/photos</code>)\n' +
'\n' +
'<b>الإحاطات الآلية:</b>\n' +
'• ☀️ الإحاطة الصباحية: ٩:٠٠ صباحاً\n' +
'• 📊 التقرير اليومي: ٩:٠٠ مساءً\n' +
'• 🌤️ تنبيهات الطقس: ٧:٠٠ صباحاً\n' +
'• 📋 تذكيرات الحضور: ٥:٠٠ مساءً';

async function main() {
  console.log('--- Retrying Topic 09 (Legal) ---');
  const r9 = await api('sendMessage', {
    chat_id: CHAT_ID,
    message_thread_id: 12,
    text: legalText,
    parse_mode: 'HTML'
  });
  if (r9.ok) {
    console.log('✅ Topic 09 Sent (ID: ' + r9.result.message_id + '). Pinning...');
    await api('pinChatMessage', { chat_id: CHAT_ID, message_id: r9.result.message_id });
  } else {
    console.log('❌ Topic 09 Failed: ' + JSON.stringify(r9));
  }

  await sleep(2000);

  console.log('--- Posting 49-Feature Guide to Topic 00 ---');
  const r0 = await api('sendMessage', {
    chat_id: CHAT_ID,
    message_thread_id: 3,
    text: guideText,
    parse_mode: 'HTML'
  });
  if (r0.ok) {
    console.log('✅ Guide Sent (ID: ' + r0.result.message_id + '). Pinning...');
    await api('pinChatMessage', { chat_id: CHAT_ID, message_id: r0.result.message_id });
  } else {
    console.log('❌ Guide Failed: ' + JSON.stringify(r0));
  }
}

main().catch(console.error);
