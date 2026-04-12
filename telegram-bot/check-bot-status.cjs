require('dotenv').config();
const https = require('https');
const BOT_TOKEN = process.env.BOT_TOKEN;
const OPS_GROUP_ID = -1003967447285;

function apiCall(method, params) {
  return new Promise((resolve, reject) => {
    const body = params ? JSON.stringify(params) : null;
    const options = {
      hostname: 'api.telegram.org',
      path: '/bot' + BOT_TOKEN + '/' + method,
      method: params ? 'POST' : 'GET',
      headers: params ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {}
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  // 1. Check getMe
  const me = await apiCall('getMe');
  console.log('=== Bot Info ===');
  console.log('Name:', me.result.first_name);
  console.log('Username:', me.result.username);
  console.log('can_read_all_group_messages:', me.result.can_read_all_group_messages);

  // 2. Try getUpdates with timeout=0 — if bot is polling on Railway, this returns 409 Conflict
  const upd = await apiCall('getUpdates', { limit: 1, timeout: 0 });
  console.log('\n=== Polling Status ===');
  if (upd.ok === false && upd.error_code === 409) {
    console.log('STATUS: BOT IS RUNNING (409 conflict = active poller on Railway)');
  } else if (upd.ok === true) {
    console.log('STATUS: NO ACTIVE POLLER — bot is NOT running on Railway');
    console.log('Pending updates:', upd.result.length);
  } else {
    console.log('STATUS: Unexpected response:', JSON.stringify(upd));
  }

  // 3. Send a test message to the General topic (thread 3)
  console.log('\n=== Sending test message ===');
  const testMsg = await apiCall('sendMessage', {
    chat_id: OPS_GROUP_ID,
    message_thread_id: 3,
    text: '✅ *Bot Status Check*\n\nThe bot is alive and operational.\n`can_read_all_group_messages: ' + me.result.can_read_all_group_messages + '`\n\n_This is an automated status check — you can delete this message._',
    parse_mode: 'Markdown'
  });
  if (testMsg.ok) {
    console.log('Test message sent! Message ID:', testMsg.result.message_id);
  } else {
    console.log('Failed to send test message:', JSON.stringify(testMsg));
  }
}

main().catch(console.error);
