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
  // These are the ONLY message IDs sent by probe scripts:
  // probe-threads.cjs sent IDs 242-254 (one per thread 3-15), text "🔍 probe N"
  // probe-threads2.cjs sent and immediately deleted its own messages
  // post-admin-welcome.cjs sent message 238 (welcome to thread 235) — DO NOT delete
  // TEST messages sent earlier: 240 (thread 3 test), 241 (thread 235 test)
  // These were sent as "TEST — thread N" text
  const probeIds = [240, 241, 242, 243, 244, 245, 246, 247, 248, 249, 250, 251, 252, 253, 254];

  console.log('Deleting ' + probeIds.length + ' probe/test messages...');
  for (const msgId of probeIds) {
    const r = await apiCall('deleteMessage', { chat_id: CHAT_ID, message_id: msgId });
    if (r.ok) {
      console.log('  Deleted msg_id=' + msgId);
    } else {
      console.log('  Could not delete msg_id=' + msgId + ': ' + r.description + ' (may already be gone)');
    }
    await sleep(100);
  }
  console.log('Done. Only probe/test messages were targeted.');
}

main().catch(console.error);
