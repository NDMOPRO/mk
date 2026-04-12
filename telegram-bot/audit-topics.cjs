require('dotenv').config();
const https = require('https');
const BOT_TOKEN = process.env.BOT_TOKEN;
const GROUP_ID = '-1002548192498';
const BOT_ID = 8069547028; // from getMe

// All known thread IDs
const THREADS = {
  'General': null,
  '00 - Rules & Guide': 3,
  '01 - CEO Update': 4,
  '02 - Operations': 5,
  '03 - Listings': 6,
  '04 - Bookings & Revenue': 7,
  '05 - Support': 8,
  '06 - Tech Issues': 9,
  '07 - Payments': 10,
  '08 - Marketing': 11,
  '09 - Legal': 12,
  '10 - Blockers': 13,
  '11 - Completed': 14,
  '12 - Priorities': 15,
  '15 - Admin Panel': 235,
};

function api(method, params) {
  return new Promise((resolve) => {
    const body = JSON.stringify(params);
    const req = https.request({
      hostname: 'api.telegram.org',
      path: '/bot' + BOT_TOKEN + '/' + method,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve({ raw: d }); } });
    });
    req.on('error', e => resolve({ error: e.message }));
    req.write(body);
    req.end();
  });
}

async function main() {
  // Get recent updates to find bot messages
  // We can't list messages in a topic, but we know the message IDs we sent
  // Let's check what message IDs we sent in previous scripts
  
  // The pin-all-topics.cjs posted messages 313-341 (odd numbers)
  // The post-bilingual-pins.cjs posted messages in a later range
  // The post-ceo-message.cjs posted a CEO message
  // probe messages were 240-254
  // test messages were 345, 347
  
  // Let's try to check a range of message IDs to find bot messages
  console.log('=== Checking bot messages in range 255-400 ===');
  console.log('(Trying to forward each to find which exist and what thread they are in)\n');
  
  const botMessages = [];
  
  for (let msgId = 255; msgId <= 400; msgId++) {
    // Try to get message info by forwarding to ourselves (will fail for non-bot messages)
    // Actually, let's just try to delete and see which succeed — NO, too dangerous
    // Instead, let's try copyMessage to ourselves
    const result = await api('copyMessage', {
      chat_id: GROUP_ID,
      from_chat_id: GROUP_ID,
      message_id: msgId,
      disable_notification: true
    });
    
    if (result.ok) {
      // Message exists and was copied — now delete the copy
      const copyId = result.result.message_id;
      await api('deleteMessage', { chat_id: GROUP_ID, message_id: copyId });
      botMessages.push(msgId);
      process.stdout.write('✓' + msgId + ' ');
    } else {
      // Message doesn't exist or can't be copied
      process.stdout.write('.');
    }
    
    // Rate limit
    if (msgId % 20 === 0) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  
  console.log('\n\n=== Bot-accessible messages found: ===');
  console.log(botMessages.join(', '));
  console.log('Total:', botMessages.length);
}

main().catch(console.error);
