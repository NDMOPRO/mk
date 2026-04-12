require('dotenv').config();
const https = require('https');
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = -1003967447285;

function apiCall(method, params) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(params);
    const options = {
      hostname: 'api.telegram.org',
      path: '/bot' + BOT_TOKEN + '/' + method,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const TOPICS = [
  { id: null, name: "General | عام 💬", desc: "Main group for general announcements and discussion.\nالمجموعة الرئيسية للإعلانات العامة والمناقشات." },
  { id: 3, name: "00 — Rules & Guide | القواعد والدليل 📋", desc: "Read our standard operating procedures and group rules here.\nاقرأ إجراءات التشغيل القياسية وقواعد المجموعة هنا." },
  { id: 4, name: "01 — CEO Update | تحديث المدير التنفيذي 📊", desc: "Direct updates and strategic guidance from the CEO.\nتحديثات مباشرة وتوجيهات استراتيجية من المدير التنفيذي." },
  { id: 5, name: "02 — Operations | المتابعة التشغيلية 🔧", desc: "Daily operational tracking and coordination.\nالمتابعة التشغيلية اليومية والتنسيق." },
  { id: 6, name: "03 — Listings | العقارات والمخزون 🏠", desc: "Management of property listings and inventory.\nإدارة قوائم العقارات والمخزون." },
  { id: 7, name: "04 — Bookings & Revenue | الحجوزات والإيرادات 💰", desc: "Tracking bookings, revenue, and financial performance.\nتتبع الحجوزات والإيرادات والأداء المالي." },
  { id: 8, name: "05 — Support | دعم العملاء 🎧", desc: "Customer support coordination and issue resolution.\nتنسيق دعم العملاء وحل المشكلات." },
  { id: 9, name: "06 — Tech Issues | المشاكل التقنية 💻", desc: "Reporting and tracking technical bugs and system issues.\nالإبلاغ عن الأعطال التقنية ومشاكل النظام وتتبعها." },
  { id: 10, name: "07 — Payments | المدفوعات والمالية 💳", desc: "Financial transactions, payments, and accounting.\nالمعاملات المالية والمدفوعات والمحاسبة." },
  { id: 11, name: "08 — Marketing | التسويق والمحتوى 📣", desc: "Marketing campaigns and content creation coordination.\nحملات التسويق وتنسيق إنشاء المحتوى." },
  { id: 12, name: "09 — Legal | القانونية والامتثال ⚖️", desc: "Legal matters, contracts, and compliance.\nالمسائل القانونية والعقود والامتثال." },
  { id: 13, name: "10 — Blockers | العوائق والتصعيد 🚨", desc: "Urgent blockers and issues requiring immediate escalation.\nالعوائق العاجلة والمشاكل التي تتطلب تصعيداً فورياً." },
  { id: 14, name: "11 — Completed | المنجز اليوم ✅", desc: "Logging daily completed tasks and achievements.\nتسجيل المهام المنجزة يومياً والإنجازات." },
  { id: 15, name: "12 — Priorities | أولويات الغد 📌", desc: "Setting and tracking priorities for the next day.\nتحديد وتتبع الأولويات لليوم التالي." },
  { id: 235, name: "15 — Admin Panel | لوحة الإدارة 🔐", desc: "Restricted area for administrators to manage the bot and system.\nمنطقة مخصصة للمسؤولين لإدارة البوت والنظام." }
];

async function main() {
  for (const topic of TOPICS) {
    console.log(`Posting to: ${topic.name}...`);
    const text = `📌 *${topic.name}*\n\n${topic.desc}`;
    const r = await apiCall('sendMessage', {
      chat_id: CHAT_ID,
      message_thread_id: topic.id,
      text: text,
      parse_mode: 'Markdown'
    });

    if (r.ok) {
      console.log(`  Message sent (ID: ${r.result.message_id}). Pinning...`);
      const p = await apiCall('pinChatMessage', {
        chat_id: CHAT_ID,
        message_id: r.result.message_id
      });
      if (p.ok) console.log('  Pinned!');
      else console.warn(`  Pin failed: ${p.description}`);
    } else {
      console.error(`  Failed: ${r.description}`);
    }
    await sleep(200);
  }
  console.log('All topic descriptions posted and pinned.');
}

main().catch(console.error);
