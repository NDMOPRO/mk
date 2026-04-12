/**
 * Final Retry for Failed Topics (Legal, Blockers, Completed)
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

const retryTopics = [
  {
    id: 12,
    label: '09 — Legal',
    text:
'⚖️ <b>09 — LEGAL & COMPLIANCE | القانونية والامتثال</b>\n' +
'\n' +
'Contracts, permits, and regulations. Protecting the company and our guests.\n' +
'\n' +
'🛡 <b>WHAT GOES HERE?</b>\n' +
'• Contract reviews and signatures\n' +
'• Regulatory updates (Tourism ministry, etc.)\n' +
'• Dispute management\n' +
'\n' +
'🛠 <b>LEGAL COMMANDS</b>\n' +
'• <code>/task Review contract for #unit_50 @Legal</code>\n' +
'• <code>/remind 2026-06-01 Renew permit for building A</code>\n' +
'• <code>/audit</code> — Review sensitive compliance actions\n' +
'\n' +
'⚠️ <b>CONFIDENTIALITY:</b> Legal matters are highly sensitive. Share information only on a "need to know" basis.\n' +
'\n' +
'━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
'\n' +
'العقود، التصاريح، واللوائح. حماية الشركة وضيوفنا.\n' +
'\n' +
'🛡 <b>ماذا ينشر هنا؟</b>\n' +
'• مراجعات العقود والتوقيعات\n' +
'• التحديثات التنظيمية (وزارة السياحة، إلخ)\n' +
'• إدارة النزاعات\n' +
'\n' +
'🛠 <b>الأوامر القانونية</b>\n' +
'• <code>/task مراجعة عقد #وحدة_50 @Legal</code>\n' +
'• <code>/remind 2026-06-01 تجديد تصريح المبنى A</code>\n' +
'• <code>/audit</code> — مراجعة إجراءات الامتثال الحساسة'
  },
  {
    id: 13,
    label: '10 — Blockers',
    text:
'🚨 <b>10 — BLOCKERS & ESCALATION | العوائق والتصعيد</b>\n' +
'\n' +
'<b>EMERGENCY & CRITICAL STOPPERS ONLY.</b> If you cannot work, or a guest is in danger, post here.\n' +
'\n' +
'🔥 <b>WHEN TO USE THIS?</b>\n' +
'• <b>Critical Blocker:</b> Work has stopped completely.\n' +
'• <b>Emergency:</b> Guest safety or major property damage.\n' +
'• <b>SLA Breach:</b> A high-priority task is overdue.\n' +
'\n' +
'🛠 <b>ESCALATION COMMANDS</b>\n' +
'• <code>/escalate [task_id]</code> — Force immediate CEO attention\n' +
'• <code>/sla</code> — View all critical overdue items\n' +
'• <code>/task EMERGENCY: Water leak in #502 @Maintenance</code>\n' +
'\n' +
'💡 <b>PRACTICAL EXAMPLE</b>\n' +
'<i>"AC broken and guest is angry? <code>/task</code> here and <code>/escalate</code>."</i>\n' +
'\n' +
'⏰ <b>MANAGEMENT SLA:</b> 30 Minute response time guaranteed.\n' +
'\n' +
'━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
'\n' +
'<b>للطوارئ والعوائق الحرجة فقط.</b> إذا كنت لا تستطيع العمل، أو كان الضيف في خطر، انشر هنا.\n' +
'\n' +
'🔥 <b>متى تستخدم هذا؟</b>\n' +
'• <b>عائق حرج:</b> العمل توقف تماماً.\n' +
'• <b>طوارئ:</b> سلامة الضيف أو ضرر كبير في العقار.\n' +
'• <b>خرق اتفاقية الخدمة:</b> مهمة عالية الأولوية متأخرة.\n' +
'\n' +
'🛠 <b>أوامر التصعيد</b>\n' +
'• <code>/escalate [رقم]</code> — لفت انتباه المدير التنفيذي فوراً\n' +
'• <code>/sla</code> — عرض جميع العناصر الحرجة المتأخرة\n' +
'• <code>/task طوارئ: تسرب مياه في #502 @Maintenance</code>'
  },
  {
    id: 14,
    label: '11 — Completed',
    text:
'✅ <b>11 — COMPLETED TODAY | المنجز اليوم</b>\n' +
'\n' +
'The "Wall of Fame." Every completed task must be logged here for the daily report.\n' +
'\n' +
'🏆 <b>WHAT GOES HERE?</b>\n' +
'• Confirmation of finished tasks\n' +
'• 📊 <b>06:00 PM:</b> Final daily check-in logs\n' +
'• Shout-outs for team wins\n' +
'\n' +
'🛠 <b>COMPLETION COMMANDS</b>\n' +
'• <code>/done [id]</code> — The most important command. Use it daily.\n' +
'• <code>/tasks done</code> — View everything the team achieved today\n' +
'• <code>/performance</code> — See your daily completion score\n' +
'\n' +
'💡 <b>PRACTICAL EXAMPLE</b>\n' +
'<i>"Finished that report? Don\'t just say it, type <code>/done 123</code>"</i>\n' +
'\n' +
'━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
'\n' +
'"لوحة الشرف". كل مهمة مكتملة يجب أن تسجل هنا للتقرير اليومي.\n' +
'\n' +
'🏆 <b>ماذا ينشر هنا؟</b>\n' +
'• تأكيد المهام المنتهية\n' +
'• 📊 <b>٠٦:٠٠ مساءً:</b> سجلات الحضور والانصراف النهائية\n' +
'• الإشادة بنجاحات الفريق\n' +
'\n' +
'🛠 <b>أوامر الإنجاز</b>\n' +
'• <code>/done [رقم]</code> — الأمر الأهم. استخدمه يومياً.\n' +
'• <code>/tasks done</code> — عرض كل ما أنجزه الفريق اليوم\n' +
'• <code>/performance</code> — عرض نقاط إنجازك اليومية'
  }
];

async function main() {
  console.log('--- Retrying Failed Topics (09, 10, 11) ---');
  for (let topic of retryTopics) {
    console.log(`  Retrying: ${topic.label}`);
    let r = await api('sendMessage', {
      chat_id: CHAT_ID,
      message_thread_id: topic.id,
      text: topic.text,
      parse_mode: 'HTML',
      disable_notification: true
    });
    if (r.ok) {
      let msgId = r.result.message_id;
      await api('pinChatMessage', { chat_id: CHAT_ID, message_id: msgId, disable_notification: true });
      console.log(`    ✅ Success (ID: ${msgId})`);
    } else {
      console.log(`    ❌ Failed: ${r.description}`);
    }
    await sleep(5000); // More aggressive delay to beat rate limits
  }
}

main().catch(console.error);
