/**
 * Final 49-Feature Guide Post
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

const guideText = 
'📘 <b>MONTHLY KEY | MASTER FEATURE GUIDE (49 FEATURES)</b>\n' +
'<b>مفتاح الشهر | دليل الميزات الشامل (٤٩ ميزة)</b>\n' +
'\n' +
'This system is divided into 4 operational phases. Use this as your master reference.\n' +
'\n' +
'<b>PHASE 1: CORE OPERATIONS</b>\n' +
'• <b>Tasking:</b> <code>/task</code>, <code>/tasks</code>, <code>/done</code>, <code>/checklist</code>\n' +
'• <b>Finance:</b> <code>/expense</code>, <code>/expenses</code>, <code>/approve</code>, <code>/reject</code>\n' +
'• <b>Tracking:</b> <code>/remind</code>, <code>/summary</code>, <code>/audit</code>\n' +
'\n' +
'<b>PHASE 2: TEAM PERFORMANCE</b>\n' +
'• <b>Metrics:</b> <code>/kpi</code>, <code>/performance</code>, <code>/leaderboard</code>\n' +
'• <b>Status:</b> <code>/away</code>, <code>/back</code>, <code>/availability</code>, <code>/leave</code>\n' +
'• <b>Structure:</b> <code>/roles</code>, <code>/setrole</code>, <code>/team</code>, <code>/onboarding</code>\n' +
'\n' +
'<b>PHASE 3: AUTOMATION & SLA</b>\n' +
'• <b>Escalation:</b> <code>/escalate</code>, <code>/sla</code>, <code>/depends</code>, <code>/handover</code>\n' +
'• <b>Reports:</b> <code>/monthlyreport</code>, <code>/gsync</code>, <code>/stats</code>\n' +
'• <b>Communication:</b> <code>/poll</code>, <code>/pin</code>, <code>/broadcast</code>\n' +
'\n' +
'<b>PHASE 4: ADVANCED ASSET MGMT</b>\n' +
'• <b>Maintenance:</b> <code>/mlog</code>, <code>/clean</code>, <code>/photos</code>, <code>/property</code>\n' +
'• <b>Innovation:</b> <code>/idea</code>, <code>/ideas</code>, <code>/brainstorm</code>\n' +
'• <b>Coordination:</b> <code>/meeting start/end/note</code>, <code>/template</code>\n' +
'• <b>Insights:</b> <code>/trends</code>, <code>/weather</code>, <code>/occupancy</code>\n' +
'\n' +
'━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
'\n' +
'تم تقسيم هذا النظام إلى ٤ مراحل تشغيلية. استخدم هذا كمرجع أساسي لك.\n' +
'\n' +
'<b>المرحلة ١: العمليات الأساسية</b>\n' +
'• <b>المهام:</b> <code>/task</code>, <code>/tasks</code>, <code>/done</code>, <code>/checklist</code>\n' +
'• <b>المالية:</b> <code>/expense</code>, <code>/expenses</code>, <code>/approve</code>, <code>/reject</code>\n' +
'• <b>التتبع:</b> <code>/remind</code>, <code>/summary</code>, <code>/audit</code>\n' +
'\n' +
'<b>المرحلة ٢: أداء الفريق</b>\n' +
'• <b>المقاييس:</b> <code>/kpi</code>, <code>/performance</code>, <code>/leaderboard</code>\n' +
'• <b>الحالة:</b> <code>/away</code>, <code>/back</code>, <code>/availability</code>, <code>/leave</code>\n' +
'• <b>الهيكل:</b> <code>/roles</code>, <code>/setrole</code>, <code>/team</code>, <code>/onboarding</code>\n' +
'\n' +
'<b>المرحلة ٣: الأتمتة واتفاقية الخدمة</b>\n' +
'• <b>التصعيد:</b> <code>/escalate</code>, <code>/sla</code>, <code>/depends</code>, <code>/handover</code>\n' +
'• <b>التقارير:</b> <code>/monthlyreport</code>, <code>/gsync</code>, <code>/stats</code>\n' +
'• <b>التواصل:</b> <code>/poll</code>, <code>/pin</code>, <code>/broadcast</code>\n' +
'\n' +
'<b>المرحلة ٤: إدارة الأصول المتقدمة</b>\n' +
'• <b>الصيانة:</b> <code>/mlog</code>, <code>/clean</code>, <code>/photos</code>, <code>/property</code>\n' +
'• <b>الابتكار:</b> <code>/idea</code>, <code>/ideas</code>, <code>/brainstorm</code>\n' +
'• <b>التنسيق:</b> <code>/meeting</code>, <code>/template</code>\n' +
'• <b>الرؤى:</b> <code>/trends</code>, <code>/weather</code>, <code>/occupancy</code>';

async function main() {
  console.log('--- Posting Final 49-Feature Guide ---');
  let r = await api('sendMessage', {
    chat_id: CHAT_ID,
    message_thread_id: 3,
    text: guideText,
    parse_mode: 'HTML',
    disable_notification: true
  });
  if (r.ok) {
    let msgId = r.result.message_id;
    await api('pinChatMessage', { chat_id: CHAT_ID, message_id: msgId, disable_notification: true });
    console.log(`✅ Success (ID: ${msgId})`);
  } else {
    console.log(`❌ Failed: ${r.description}`);
  }
}

main().catch(console.error);
