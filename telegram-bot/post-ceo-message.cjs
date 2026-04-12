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

const CEO_MESSAGE = `🚀 *CEO Update: Time Management & System Usage*

Team, 

As we scale, our efficiency depends entirely on how well we use our tools. Every task, every update, and every blocker must be logged in the system. 

*Time is our most valuable asset.* By using the Daily Operations HQ properly, we ensure that nothing falls through the cracks and everyone stays aligned.

1. **Log everything:** Use the appropriate topics for all updates.
2. **Be proactive:** Don't wait to be asked; update your progress.
3. **Respect the system:** It is designed to help you succeed.

Let's make today our most productive day yet!

━━━━━━━━━━━━━━

🚀 *تحديث المدير التنفيذي: إدارة الوقت واستخدام النظام*

فريقنا العزيز،

مع توسعنا، تعتمد كفاءتنا بالكامل على مدى حسن استخدامنا لأدواتنا. يجب تسجيل كل مهمة، وكل تحديث، وكل عائق في النظام.

*الوقت هو أثمن أصولنا.* من خلال استخدام "مقر العمليات اليومية" بشكل صحيح، نضمن عدم ضياع أي شيء وبقاء الجميع على خط واحد.

1. **سجل كل شيء:** استخدم المواضيع المناسبة لجميع التحديثات.
2. **كن مبادراً:** لا تنتظر أن تُسأل؛ قم بتحديث تقدمك.
3. **احترم النظام:** لقد تم تصميمه لمساعدتك على النجاح.

لنحول اليوم إلى أكثر أيامنا إنتاجية!`;

async function main() {
  console.log('Posting CEO message to thread 4...');
  const r = await apiCall('sendMessage', {
    chat_id: CHAT_ID,
    message_thread_id: 4,
    text: CEO_MESSAGE,
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
}

main().catch(console.error);
