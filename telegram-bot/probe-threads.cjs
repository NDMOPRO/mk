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
  // Known thread IDs from code: 3-15, 235
  // Also probe 16-50 and 100-240 to find v5 topics (Ideas, Photos, Brainstorm, etc.)
  const toProbe = [];
  for (let i = 3; i <= 50; i++) toProbe.push(i);
  for (let i = 100; i <= 240; i += 5) toProbe.push(i);
  toProbe.push(235);
  
  const found = [];
  const msgIds = []; // track test messages to delete later
  
  for (const tid of toProbe) {
    const r = await apiCall('sendMessage', {
      chat_id: CHAT_ID,
      message_thread_id: tid,
      text: '🔍 probe ' + tid
    });
    if (r.ok) {
      found.push({ tid, msgId: r.result.message_id });
      console.log('EXISTS: Thread ' + tid + ' (msg_id=' + r.result.message_id + ')');
    }
    await sleep(50); // avoid rate limit
  }
  
  console.log('\nFound threads: ' + found.map(f => f.tid).join(', '));
  
  // Delete all probe messages
  console.log('\nCleaning up probe messages...');
  for (const f of found) {
    const d = await apiCall('deleteMessage', { chat_id: CHAT_ID, message_id: f.msgId });
    if (d.ok) process.stdout.write('.');
    await sleep(50);
  }
  console.log('\nDone.');
}

main().catch(console.error);
