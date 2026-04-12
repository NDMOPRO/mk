/**
 * Find Mushtaq's Messages in Daily Operations HQ
 * -----------------------------------------------
 * Uses getUpdates to pull the most recent messages from the bot's update queue.
 * Also tries forwardMessages approach to scan recent chat history.
 */

require('dotenv').config();
const https = require('https');
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = -1003967447285;

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

function apiGet(method, params) {
  return new Promise(function(resolve) {
    var qs = Object.entries(params).map(([k,v]) => k + '=' + encodeURIComponent(v)).join('&');
    var req = https.request({
      hostname: 'api.telegram.org',
      path: '/bot' + BOT_TOKEN + '/' + method + '?' + qs,
      method: 'GET'
    }, function(res) {
      var d = '';
      res.on('data', function(c) { d += c; });
      res.on('end', function() { try { resolve(JSON.parse(d)); } catch(e) { resolve({ raw: d }); } });
    });
    req.on('error', function(e) { resolve({ error: e.message }); });
    req.end();
  });
}

async function main() {
  console.log('=== FETCHING RECENT UPDATES FROM BOT ===\n');

  // Get all pending updates with a high limit
  const updates = await apiGet('getUpdates', { limit: 100, allowed_updates: 'message,channel_post' });

  if (!updates.ok) {
    console.log('getUpdates failed:', JSON.stringify(updates));
    return;
  }

  console.log(`Total updates received: ${updates.result.length}\n`);

  // Filter for messages from the ops group
  const groupMessages = updates.result
    .filter(u => u.message && u.message.chat && u.message.chat.id === CHAT_ID)
    .map(u => u.message);

  console.log(`Messages from Daily Operations HQ: ${groupMessages.length}\n`);

  // Find Mushtaq's messages (case-insensitive search on first_name, last_name, username)
  const mushtaqMessages = groupMessages.filter(m => {
    const from = m.from || {};
    const fn = (from.first_name || '').toLowerCase();
    const ln = (from.last_name || '').toLowerCase();
    const un = (from.username || '').toLowerCase();
    return fn.includes('mushtaq') || ln.includes('mushtaq') || un.includes('mushtaq');
  });

  console.log(`=== MUSHTAQ'S MESSAGES FOUND: ${mushtaqMessages.length} ===\n`);

  if (mushtaqMessages.length === 0) {
    console.log('No messages from Mushtaq in recent updates.');
    console.log('\nAll senders in recent updates:');
    const senders = [...new Set(groupMessages.map(m => {
      const f = m.from || {};
      return `${f.first_name || ''} ${f.last_name || ''} (@${f.username || 'no_username'}) ID:${f.id}`;
    }))];
    senders.forEach(s => console.log('  -', s));
  } else {
    mushtaqMessages.forEach((m, i) => {
      const from = m.from || {};
      console.log(`--- Message ${i+1} ---`);
      console.log(`  From: ${from.first_name} ${from.last_name || ''} (@${from.username || 'N/A'}) ID:${from.id}`);
      console.log(`  Thread: ${m.message_thread_id || 'General'}`);
      console.log(`  Message ID: ${m.message_id}`);
      console.log(`  Date: ${new Date(m.date * 1000).toISOString()}`);
      console.log(`  Text: ${m.text || m.caption || '[media/sticker]'}`);
      console.log();
    });
  }

  // Also show ALL recent messages with their senders for full context
  console.log('\n=== ALL RECENT GROUP MESSAGES (last 20) ===\n');
  const recent = groupMessages.slice(-20);
  recent.forEach(m => {
    const from = m.from || {};
    const name = `${from.first_name || ''} ${from.last_name || ''}`.trim();
    const text = (m.text || m.caption || '[media]').substring(0, 80);
    console.log(`[Thread:${m.message_thread_id || 'Gen'}] [ID:${m.message_id}] ${name}: ${text}`);
  });
}

main().catch(console.error);
