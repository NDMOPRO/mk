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

async function main() {
  const r = await apiCall('getUpdates', { limit: 100, offset: -100 });
  if (!r.ok) { console.log('Error:', JSON.stringify(r)); return; }
  
  // Collect unique thread IDs from the ops group
  const threads = new Map();
  for (const u of r.result) {
    const msg = u.message || u.edited_message;
    if (!msg) continue;
    if (msg.chat && msg.chat.id !== CHAT_ID) continue;
    const tid = msg.message_thread_id;
    if (tid && !threads.has(tid)) {
      const text = (msg.text || msg.caption || '').substring(0, 60);
      threads.set(tid, text);
    }
  }
  const sorted = Array.from(threads.entries()).sort((a, b) => a[0] - b[0]);
  console.log('Found ' + sorted.length + ' unique thread IDs:');
  for (const entry of sorted) {
    console.log('  Thread ' + entry[0] + ': ' + entry[1]);
  }
}

main().catch(console.error);
