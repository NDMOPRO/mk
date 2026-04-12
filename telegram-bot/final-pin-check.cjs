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
  { id: 12, name: "09 — Legal | القانونية والامتثال ⚖️", desc: "Legal matters, contracts, and compliance.\nالمسائل القانونية والعقود والامتثال." },
  { id: 13, name: "10 — Blockers | العوائق والتصعيد 🚨", desc: "Urgent blockers and issues requiring immediate escalation.\nالعوائق العاجلة والمشاكل التي تتطلب تصعيداً فورياً." },
  { id: 14, name: "11 — Completed | المنجز اليوم ✅", desc: "Logging daily completed tasks and achievements.\nتسجيل المهام المنجزة يومياً والإنجازات." },
  { id: 15, name: "12 — Priorities | أولويات الغد 📌", desc: "Setting and tracking priorities for the next day.\nتحديد وتتبع الأولويات لليوم التالي." },
  { id: 235, name: "15 — Admin Panel | لوحة الإدارة 🔐", desc: "Restricted area for administrators to manage the bot and system.\nمنطقة مخصصة للمسؤولين لإدارة البوت والنظام." }
];

async function main() {
  for (const topic of TOPICS) {
    console.log(`Final check/post for: ${topic.name}...`);
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
    await sleep(2000);
  }
}

main().catch(console.error);
