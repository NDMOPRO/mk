/**
 * Rename All Forum Topics — Bilingual Format with Emojis
 * -------------------------------------------------------
 * Uses editForumTopic to rename every topic to the correct
 * "Number — English | Arabic Emoji" format.
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
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, function(res) {
      var d = '';
      res.on('data', function(c) { d += c; });
      res.on('end', function() {
        try { resolve(JSON.parse(d)); } catch(e) { resolve({ raw: d }); }
      });
    });
    req.on('error', function(e) { resolve({ error: e.message }); });
    req.write(body);
    req.end();
  });
}

function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

// All known topics with correct bilingual names
const topics = [
  { id: 3,   name: '00 — Rules & Guide | القواعد والدليل 📋' },
  { id: 4,   name: '01 — CEO Update | تحديث المدير التنفيذي 👑' },
  { id: 5,   name: '02 — Operations | المتابعة التشغيلية 🔧' },
  { id: 6,   name: '03 — Listings | العقارات والمخزون 🏠' },
  { id: 7,   name: '04 — Bookings & Revenue | الحجوزات والإيرادات 💰' },
  { id: 8,   name: '05 — Customer Support | دعم العملاء 🎧' },
  { id: 9,   name: '06 — Tech Issues | المشاكل التقنية 💻' },
  { id: 10,  name: '07 — Payments & Finance | المدفوعات والمالية 🏦' },
  { id: 11,  name: '08 — Marketing | التسويق والمحتوى 📣' },
  { id: 12,  name: '09 — Legal & Compliance | القانونية والامتثال ⚖️' },
  { id: 13,  name: '10 — Blockers & Escalation | العوائق والتصعيد 🚨' },
  { id: 14,  name: '11 — Completed Today | المنجز اليوم ✅' },
  { id: 15,  name: '12 — Priorities | أولويات الغد 📌' },
  { id: 235, name: '15 — Admin Panel | لوحة الإدارة 🔐' },
];

// Potential unknown threads to probe
const unknownThreads = [16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 30, 50, 100, 150, 200, 220, 230, 240];

async function main() {
  console.log('🔤 RENAMING ALL FORUM TOPICS...\n');

  let success = 0;
  let failed = 0;
  const results = [];

  for (const topic of topics) {
    process.stdout.write(`  Thread ${topic.id}: `);

    let r = await api('editForumTopic', {
      chat_id: CHAT_ID,
      message_thread_id: topic.id,
      name: topic.name
    });

    if (r.ok) {
      console.log(`✅ "${topic.name}"`);
      success++;
      results.push({ id: topic.id, name: topic.name, status: 'success' });
    } else if (r.description && r.description.includes('Too Many Requests')) {
      const wait = parseInt((r.description.match(/retry after (\d+)/) || [0, 10])[1]) + 2;
      console.log(`⏳ Rate limited, waiting ${wait}s...`);
      await sleep(wait * 1000);
      // Retry
      r = await api('editForumTopic', {
        chat_id: CHAT_ID,
        message_thread_id: topic.id,
        name: topic.name
      });
      if (r.ok) {
        console.log(`  ✅ Retry OK: "${topic.name}"`);
        success++;
        results.push({ id: topic.id, name: topic.name, status: 'success' });
      } else {
        console.log(`  ❌ Retry failed: ${r.description}`);
        failed++;
        results.push({ id: topic.id, name: topic.name, status: 'failed', error: r.description });
      }
    } else {
      console.log(`❌ ${r.description || JSON.stringify(r)}`);
      failed++;
      results.push({ id: topic.id, name: topic.name, status: 'failed', error: r.description });
    }

    await sleep(1500); // Respect rate limits between edits
  }

  // Probe for unknown threads (Ideas, Photos)
  console.log('\n🔍 PROBING FOR UNKNOWN THREADS (Ideas, Photos)...\n');
  for (const threadId of unknownThreads) {
    // Try to get info by attempting editForumTopic with same name (no-op if name unchanged)
    // Actually, try a copyMessage probe first to see if thread exists
    const probe = await api('copyMessage', {
      chat_id: CHAT_ID,
      from_chat_id: CHAT_ID,
      message_id: 1,
      message_thread_id: threadId,
      disable_notification: true
    });
    // If it says "thread not found" vs other errors, we can detect existence
    const desc = probe.description || '';
    if (!desc.includes('thread not found') && !desc.includes('message to copy not found') && probe.ok !== false) {
      console.log(`  Thread ${threadId}: EXISTS — probe result: ${JSON.stringify(probe).substring(0, 80)}`);
    } else if (desc.includes('thread not found')) {
      // Thread doesn't exist
    } else {
      // Thread might exist but message doesn't
      // Try editForumTopic to check
      const edit = await api('editForumTopic', {
        chat_id: CHAT_ID,
        message_thread_id: threadId,
        name: `Thread ${threadId} — Test`
      });
      if (edit.ok) {
        console.log(`  ✅ Thread ${threadId} EXISTS and was renamed!`);
        results.push({ id: threadId, name: `Thread ${threadId}`, status: 'found_unknown' });
      } else if (!edit.description?.includes('thread not found')) {
        console.log(`  Thread ${threadId}: ${edit.description}`);
      }
    }
    await sleep(500);
  }

  console.log(`\n═══════════════════════════════════════`);
  console.log(`✅ Successfully renamed: ${success}/${topics.length}`);
  console.log(`❌ Failed: ${failed}/${topics.length}`);
  console.log(`═══════════════════════════════════════\n`);

  if (failed > 0) {
    console.log('Failed topics:');
    results.filter(r => r.status === 'failed').forEach(r => {
      console.log(`  Thread ${r.id}: ${r.error}`);
    });
  }
}

main().catch(console.error);
