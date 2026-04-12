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

async function main() {
  // Only probe 3-50 and 230-240 (we know 235 exists for Admin Panel)
  const toProbe = [];
  for (let i = 3; i <= 50; i++) toProbe.push(i);
  for (let i = 230; i <= 240; i++) toProbe.push(i);
  
  const found = [];
  
  for (const tid of toProbe) {
    const r = await apiCall('sendMessage', {
      chat_id: CHAT_ID,
      message_thread_id: tid,
      text: 'probe'
    });
    if (r.ok) {
      found.push({ tid, msgId: r.result.message_id });
      process.stdout.write('EXISTS:' + tid + ' ');
      // Delete immediately
      await apiCall('deleteMessage', { chat_id: CHAT_ID, message_id: r.result.message_id });
    }
    await sleep(80);
  }
  
  console.log('\n\nFound threads: ' + found.map(function(f) { return f.tid; }).join(', '));
}

main().catch(console.error);
