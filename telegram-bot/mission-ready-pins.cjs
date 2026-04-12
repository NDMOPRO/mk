/**
 * Monthly Key Operations HQ — Mission-Ready Professional Pins
 * -----------------------------------------------------------
 * This script performs a "surgical swap":
 * 1. Deletes all bot-sent messages in the range 348-400 (the current pins and guide)
 * 2. Posts one ultra-professional, highly detailed bilingual message per topic
 * 3. Posts the mission-critical CEO daily workflow message
 * 4. Pins every message for a clean, single-pin look in each topic
 */

require('dotenv').config();
const https = require('https');
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = '-1003967447285';

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

function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

// ═══════════════════════════════════════════════════════════════
// TOPIC DEFINITIONS — MISSION READY CONTENT
// ═══════════════════════════════════════════════════════════════

const topics = [
  {
    id: null,
    label: 'General',
    text:
'🏢 <b>MONTHLY KEY | DAILY OPERATIONS HQ</b>\n' +
'<b>مفتاح الشهر | المقر التشغيلي اليومي</b>\n' +
'\n' +
'Welcome to the command center of Monthly Key. This group is our primary engine for coordination, accountability, and excellence.\n' +
'\n' +
'🎯 <b>PURPOSE</b>\n' +
'To centralize all daily operations, track real-time progress, and ensure no guest request or task is ever missed.\n' +
'\n' +
'📜 <b>OPERATIONAL RULES</b>\n' +
'1️⃣ <b>Topic Integrity:</b> Post ONLY in the relevant topic. Keep the General feed for high-level coordination.\n' +
'2️⃣ <b>Actionable Chat:</b> Every operational request must be a <code>/task</code>. If it’s not in the system, it doesn’t exist.\n' +
'3️⃣ <b>Responsiveness:</b> Tagged members (@user) must acknowledge within 60 minutes during working hours.\n' +
'4️⃣ <b>Bilingualism:</b> Professional English or Arabic is accepted. Use clear, concise language.\n' +
'\n' +
'🤖 <b>CORE GLOBAL COMMANDS</b>\n' +
'• <code>/tasks</code> — View all pending work in this topic\n' +
'• <code>/task [desc] @user #prop</code> — Create & assign task\n' +
'• <code>/done [id]</code> — Mark completion (Crucial for KPIs)\n' +
'• <code>/remind [time] [note]</code> — Set an automated follow-up\n' +
'\n' +
'━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
'\n' +
'مرحباً بكم في مركز قيادة "مفتاح الشهر". هذه المجموعة هي المحرك الأساسي للتنسيق والمساءلة والتميز.\n' +
'\n' +
'🎯 <b>الهدف</b>\n' +
'مركزية جميع العمليات اليومية، وتتبع التقدم في الوقت الفعلي، وضمان عدم تفويت أي طلب ضيف أو مهمة.\n' +
'\n' +
'📜 <b>القواعد التشغيلية</b>\n' +
'١. <b>نزاهة المواضيع:</b> انشر فقط في الموضوع ذي الصلة. اترك العام للتنسيق رفيع المستوى.\n' +
'٢. <b>المحادثة القابلة للتنفيذ:</b> كل طلب تشغيلي يجب أن يكون <code>/task</code>. إذا لم يكن في النظام، فهو غير موجود.\n' +
'٣. <b>الاستجابة:</b> يجب على الأعضاء المشار إليهم (@user) الإقرار خلال ٦٠ دقيقة أثناء ساعات العمل.\n' +
'٤. <b>الاحترافية:</b> اللغة الإنجليزية أو العربية الاحترافية مقبولة. استخدم لغة واضحة وموجزة.\n' +
'\n' +
'🤖 <b>الأوامر العالمية الأساسية</b>\n' +
'• <code>/tasks</code> — عرض جميع الأعمال المعلقة في هذا الموضوع\n' +
'• <code>/task [الوصف] @user #prop</code> — إنشاء وتعيين مهمة\n' +
'• <code>/done [رقم]</code> — تحديد الإنجاز (ضروري لمؤشرات الأداء)\n' +
'• <code>/remind [الوقت] [ملاحظة]</code> — تعيين متابعة تلقائية'
  },
  {
    id: 3,
    label: '00 — Rules & Guide',
    text:
'📋 <b>00 — RULES & SYSTEM GUIDE | القواعد ودليل النظام</b>\n' +
'\n' +
'The "Monthly Key Bible." This topic is the definitive reference for how we operate and use our AI-powered systems.\n' +
'\n' +
'📖 <b>WHAT IS HERE?</b>\n' +
'• Standard Operating Procedures (SOPs)\n' +
'• Full 49-Feature AI Bot Manual\n' +
'• Onboarding Checklists for new staff\n' +
'\n' +
'🛠 <b>SYSTEM COMMANDS</b>\n' +
'• <code>/help</code> — The master list of every bot capability\n' +
'• <code>/onboarding</code> — Start the training flow for new hires\n' +
'• <code>/roles</code> — See who is responsible for what\n' +
'• <code>/template [name]</code> — Get standard message templates\n' +
'\n' +
'💡 <b>PRACTICAL EXAMPLE</b>\n' +
'<i>"New cleaner joined? Type <code>/onboarding</code> to show them the system rules."</i>\n' +
'\n' +
'⚠️ <b>STRICT RULE:</b> No chatting here. Use this for reference only. Read the pinned guide before asking "How do I...?"\n' +
'\n' +
'━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
'\n' +
'هذا هو المرجع النهائي لكيفية عملنا واستخدام أنظمتنا المدعومة بالذكاء الاصطناعي.\n' +
'\n' +
'📖 <b>ماذا يوجد هنا؟</b>\n' +
'• إجراءات التشغيل القياسية (SOPs)\n' +
'• دليل بوت الذكاء الاصطناعي الكامل بـ ٤٩ ميزة\n' +
'• قوائم التأهيل للموظفين الجدد\n' +
'\n' +
'🛠 <b>أوامر النظام</b>\n' +
'• <code>/help</code> — القائمة الرئيسية لكل إمكانيات البوت\n' +
'• <code>/onboarding</code> — بدء مسار التدريب للموظفين الجدد\n' +
'• <code>/roles</code> — معرفة من المسؤول عن ماذا\n' +
'• <code>/template [الاسم]</code> — الحصول على قوالب الرسائل القياسية\n' +
'\n' +
'💡 <b>مثال عملي</b>\n' +
'<i>"منظف جديد انضم؟ اكتب <code>/onboarding</code> لإظهار قواعد النظام له."</i>\n' +
'\n' +
'⚠️ <b>قاعدة صارمة:</b> لا محادثات هنا. استخدم هذا للمرجع فقط. اقرأ الدليل المثبت قبل السؤال "كيف أفعل...؟"'
  },
  {
    id: 4,
    label: '01 — CEO Update',
    text:
'📊 <b>01 — CEO STRATEGY & KPI | استراتيجية المدير التنفيذي</b>\n' +
'\n' +
'The heartbeat of the company. Direct communication from leadership regarding performance, strategy, and vision.\n' +
'\n' +
'👔 <b>LEADERSHIP UPDATES</b>\n' +
'• ☀️ <b>09:00 AM:</b> Morning Briefing (Priorities & Goals)\n' +
'• 📊 <b>09:00 PM:</b> Daily Performance Report (Stats & Wins)\n' +
'• 👑 <b>Sundays:</b> Weekly CEO Strategic Message\n' +
'\n' +
'📈 <b>PERFORMANCE COMMANDS</b>\n' +
'• <code>/kpi</code> — View real-time team performance metrics\n' +
'• <code>/performance @user</code> — Audit specific staff output\n' +
'• <code>/leaderboard</code> — See the top contributors of the week\n' +
'• <code>/summary</code> — Get an AI summary of today\'s progress\n' +
'\n' +
'💡 <b>PRACTICAL EXAMPLE</b>\n' +
'<i>"Want to see how you rank? Type <code>/leaderboard</code> to see the top performers."</i>\n' +
'\n' +
'━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
'\n' +
'نبض الشركة. تواصل مباشر من القيادة فيما يتعلق بالأداء والاستراتيجية والرؤية.\n' +
'\n' +
'👔 <b>تحديثات القيادة</b>\n' +
'• ☀️ <b>٠٩:٠٠ صباحاً:</b> الإحاطة الصباحية (الأولويات والأهداف)\n' +
'• 📊 <b>٠٩:٠٠ مساءً:</b> تقرير الأداء اليومي (الإحصائيات والنجاحات)\n' +
'• 👑 <b>الأحد:</b> رسالة المدير التنفيذي الاستراتيجية الأسبوعية\n' +
'\n' +
'📈 <b>أوامر الأداء</b>\n' +
'• <code>/kpi</code> — عرض مقاييس أداء الفريق في الوقت الفعلي\n' +
'• <code>/performance @user</code> — تدقيق مخرجات موظف معين\n' +
'• <code>/leaderboard</code> — معرفة أفضل المساهمين لهذا الأسبوع\n' +
'• <code>/summary</code> — الحصول على ملخص ذكاء اصطناعي لتقدم اليوم'
  },
  {
    id: 5,
    label: '02 — Operations',
    text:
'🔧 <b>02 — OPERATIONS & WORKFLOW | العمليات وسير العمل</b>\n' +
'\n' +
'The "Engine Room." This is where the work happens. Coordination of all field and office tasks.\n' +
'\n' +
'⚙️ <b>WHAT GOES HERE?</b>\n' +
'• Daily task assignments and coordination\n' +
'• 🌤️ <b>07:00 AM:</b> Daily Weather & Field Alerts\n' +
'• Real-time updates on unit status\n' +
'\n' +
'🛠 <b>OPERATIONAL COMMANDS</b>\n' +
'• <code>/task Fix AC in #unit_10 @Saad</code> — Create assigned task\n' +
'• <code>/checklist Prepare unit for guest | Clean | Check Water</code>\n' +
'• <code>/handover @Ahmed task #42</code> — Transfer responsibility\n' +
'• <code>/workflow</code> — View active operational flows\n' +
'• <code>/availability</code> — See who is currently online/active\n' +
'\n' +
'💡 <b>PRACTICAL EXAMPLE</b>\n' +
'<i>"Need Saad to fix a lock? Type: <code>/task Fix lock in #502 @Saad</code>"</i>\n' +
'\n' +
'━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
'\n' +
'هنا يتم العمل. تنسيق جميع المهام الميدانية والمكتبية.\n' +
'\n' +
'⚙️ <b>ماذا ينشر هنا؟</b>\n' +
'• تعيينات المهام اليومية والتنسيق\n' +
'• 🌤️ <b>٠٧:٠٠ صباحاً:</b> تنبيهات الطقس والميدان اليومية\n' +
'• تحديثات فورية حول حالة الوحدات\n' +
'\n' +
'🛠 <b>الأوامر التشغيلية</b>\n' +
'• <code>/task إصلاح المكيف في #وحدة_10 @Saad</code>\n' +
'• <code>/checklist تجهيز الوحدة | تنظيف | فحص المياه</code>\n' +
'• <code>/handover @Ahmed مهمة #42</code> — نقل المسؤولية\n' +
'• <code>/workflow</code> — عرض مسارات العمل النشطة\n' +
'• <code>/availability</code> — معرفة من المتواجد حالياً'
  },
  {
    id: 6,
    label: '03 — Listings',
    text:
'🏠 <b>03 — LISTINGS & INVENTORY | العقارات والمخزون</b>\n' +
'\n' +
'Managing our physical assets. Every unit, every item, every photo.\n' +
'\n' +
'📦 <b>WHAT GOES HERE?</b>\n' +
'• Property listing updates and new inventory\n' +
'• 🧼 Cleaning logs and maintenance records\n' +
'• 📸 Property photo verification and inspections\n' +
'\n' +
'🛠 <b>ASSET COMMANDS</b>\n' +
'• <code>/property #unit_101</code> — Get full details of a property\n' +
'• <code>/clean #unit_101</code> — Log a cleaning session completion\n' +
'• <code>/mlog Replace bulb in #unit_5</code> — Log maintenance work\n' +
'• <code>/photos #unit_5</code> — View latest inspection photos\n' +
'• <code>/occupancy</code> — View current rental status across units\n' +
'\n' +
'💡 <b>PRACTICAL EXAMPLE</b>\n' +
'<i>"Just finished cleaning? Type: <code>/clean #unit_201</code> to update the system."</i>\n' +
'\n' +
'━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
'\n' +
'إدارة أصولنا المادية. كل وحدة، كل غرض، كل صورة.\n' +
'\n' +
'📦 <b>ماذا ينشر هنا؟</b>\n' +
'• تحديثات قوائم العقارات والمخزون الجديد\n' +
'• 🧼 سجلات التنظيف وسجلات الصيانة\n' +
'• 📸 التحقق من صور العقارات وعمليات التفتيش\n' +
'\n' +
'🛠 <b>أوامر الأصول</b>\n' +
'• <code>/property #وحدة_101</code> — الحصول على تفاصيل العقار\n' +
'• <code>/clean #وحدة_101</code> — تسجيل إتمام جلسة تنظيف\n' +
'• <code>/mlog تغيير المصباح في #وحدة_5</code> — تسجيل أعمال صيانة\n' +
'• <code>/photos #وحدة_5</code> — عرض أحدث صور التفتيش\n' +
'• <code>/occupancy</code> — عرض حالة الإشغال الحالية'
  },
  {
    id: 7,
    label: '04 — Bookings & Revenue',
    text:
'💰 <b>04 — BOOKINGS & REVENUE | الحجوزات والإيرادات</b>\n' +
'\n' +
'The financial pulse. Every riyal earned and every booking confirmed.\n' +
'\n' +
'💵 <b>WHAT GOES HERE?</b>\n' +
'• New booking alerts and payment confirmations\n' +
'• Revenue targets and daily totals\n' +
'• Financial trend analysis\n' +
'\n' +
'🛠 <b>REVENUE COMMANDS</b>\n' +
'• <code>/expense 150 Cleaning Supplies</code> — Log an expense\n' +
'• <code>/expenses</code> — View today\'s financial outgoings\n' +
'• <code>/monthlyreport</code> — Generate a full revenue summary\n' +
'• <code>/trends</code> — View AI-generated revenue trends\n' +
'\n' +
'💡 <b>PRACTICAL EXAMPLE</b>\n' +
'<i>"Bought lightbulbs? Type: <code>/expense 25 Lightbulbs #unit_5</code>"</i>\n' +
'\n' +
'━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
'\n' +
'النبض المالي. كل ريال مكتسب وكل حجز مؤكد.\n' +
'\n' +
'💵 <b>ماذا ينشر هنا؟</b>\n' +
'• تنبيهات الحجز الجديدة وتأكيدات الدفع\n' +
'• أهداف الإيرادات والإجماليات اليومية\n' +
'• تحليل الاتجاهات المالية\n' +
'\n' +
'🛠 <b>أوامر الإيرادات</b>\n' +
'• <code>/expense 150 أدوات تنظيف</code> — تسجيل مصروف\n' +
'• <code>/expenses</code> — عرض المصروفات المالية لليوم\n' +
'• <code>/monthlyreport</code> — إنشاء ملخص كامل للإيرادات\n' +
'• <code>/trends</code> — عرض اتجاهات الإيرادات المولدة بالذكاء الاصطناعي'
  },
  {
    id: 8,
    label: '05 — Support',
    text:
'🎧 <b>05 — CUSTOMER SUPPORT | دعم العملاء</b>\n' +
'\n' +
'Guest happiness is our #1 priority. This topic is for guest requests, complaints, and service coordination.\n' +
'\n' +
'🌟 <b>WHAT GOES HERE?</b>\n' +
'• Guest inquiries from all platforms\n' +
'• Issue resolution tracking\n' +
'• Service Level Agreement (SLA) monitoring\n' +
'\n' +
'🛠 <b>SUPPORT COMMANDS</b>\n' +
'• <code>/sla</code> — Check if any guest request is overdue\n' +
'• <code>/task Guest in #502 needs extra towels @Saad</code>\n' +
'• <code>/verify [id]</code> — Confirm a guest issue is fully resolved\n' +
'• <code>/template guest_welcome</code> — Get professional greeting\n' +
'\n' +
'💡 <b>PRACTICAL EXAMPLE</b>\n' +
'<i>"Guest complaining about Wi-Fi? Create a task and monitor <code>/sla</code>."</i>\n' +
'\n' +
'⏰ <b>TARGET:</b> Response within 15 mins. Resolution within 2 hours.\n' +
'\n' +
'━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
'\n' +
'سعادة الضيف هي أولويتنا الأولى. هذا الموضوع لطلبات الضيوف والشكاوى وتنسيق الخدمة.\n' +
'\n' +
'🌟 <b>ماذا ينشر هنا؟</b>\n' +
'• استفسارات الضيوف من جميع المنصات\n' +
'• تتبع حل المشكلات\n' +
'• مراقبة اتفاقية مستوى الخدمة (SLA)\n' +
'\n' +
'🛠 <b>أوامر الدعم</b>\n' +
'• <code>/sla</code> — التحقق مما إذا كان أي طلب ضيف متأخراً\n' +
'• <code>/task الضيف في #502 يحتاج مناشف @Saad</code>\n' +
'• <code>/verify [رقم]</code> — تأكيد حل مشكلة الضيف تماماً\n' +
'• <code>/template guest_welcome</code> — الحصول على تحية احترافية\n' +
'\n' +
'⏰ <b>الهدف:</b> الاستجابة خلال ١٥ دقيقة. الحل خلال ساعتين.'
  },
  {
    id: 9,
    label: '06 — Tech Issues',
    text:
'💻 <b>06 — TECH ISSUES | المشاكل التقنية</b>\n' +
'\n' +
'Bugs, system errors, and smart-lock failures. If it uses electricity or code, it belongs here.\n' +
'\n' +
'📡 <b>WHAT GOES HERE?</b>\n' +
'• Smart lock offline alerts\n' +
'• Website or App errors\n' +
'• Bot issues or system downtime\n' +
'\n' +
'🛠 <b>TECH COMMANDS</b>\n' +
'• <code>/task Smart lock #101 battery low @Tech</code>\n' +
'• <code>/mlog Internet down in building A</code> — Log for record\n' +
'• <code>/depends [task_id] on [other_id]</code> — Link related bugs\n' +
'\n' +
'💡 <b>PRACTICAL EXAMPLE</b>\n' +
'<i>"Lock not opening? Post here with <code>/task</code> and tag the Tech Team."</i>\n' +
'\n' +
'━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
'\n' +
'الأعطال، أخطاء النظام، وفشل الأقفال الذكية. إذا كان يعمل بالكهرباء أو الكود، فمكانه هنا.\n' +
'\n' +
'📡 <b>ماذا ينشر هنا؟</b>\n' +
'• تنبيهات توقف الأقفال الذكية\n' +
'• أخطاء الموقع أو التطبيق\n' +
'• مشاكل البوت أو توقف النظام\n' +
'\n' +
'🛠 <b>الأوامر التقنية</b>\n' +
'• <code>/task بطارية قفل #101 منخفضة @Tech</code>\n' +
'• <code>/mlog الإنترنت مقطوع في المبنى A</code>\n' +
'• <code>/depends [رقم] على [رقم_آخر]</code> — ربط الأعطال المرتبطة'
  },
  {
    id: 10,
    label: '07 — Payments',
    text:
'💳 <b>07 — PAYMENTS & FINANCE | المدفوعات والمالية</b>\n' +
'\n' +
'Official financial approvals and audit logs. This topic is for the Finance Team.\n' +
'\n' +
'🧾 <b>WHAT GOES HERE?</b>\n' +
'• Payment proof verification\n' +
'• Vendor invoice approvals\n' +
'• Refund processing requests\n' +
'\n' +
'🛠 <b>FINANCE COMMANDS</b>\n' +
'• <code>/approve [expense_id]</code> — Authorize a payment\n' +
'• <code>/reject [expense_id]</code> — Deny a payment request\n' +
'• <code>/expenses</code> — View the full daily ledger\n' +
'• <code>/audit @user</code> — Audit financial actions of a member\n' +
'\n' +
'💡 <b>PRACTICAL EXAMPLE</b>\n' +
'<i>"Finance manager: Review expenses and use <code>/approve</code> to authorize them."</i>\n' +
'\n' +
'━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
'\n' +
'الموافقات المالية الرسمية وسجلات المراجعة. هذا الموضوع مخصص للفريق المالي.\n' +
'\n' +
'🧾 <b>ماذا ينشر هنا؟</b>\n' +
'• التحقق من إثبات الدفع\n' +
'• موافقات فواتير الموردين\n' +
'• طلبات معالجة المبالغ المستردة\n' +
'\n' +
'🛠 <b>الأوامر المالية</b>\n' +
'• <code>/approve [رقم]</code> — تفويض عملية دفع\n' +
'• <code>/reject [رقم]</code> — رفض طلب دفع\n' +
'• <code>/expenses</code> — عرض السجل اليومي الكامل\n' +
'• <code>/audit @user</code> — مراجعة الإجراءات المالية للعضو'
  },
  {
    id: 11,
    label: '08 — Marketing',
    text:
'📣 <b>08 — MARKETING & CONTENT | التسويق والمحتوى</b>\n' +
'\n' +
'Growing the Monthly Key brand. Content, ads, and creativity.\n' +
'\n' +
'🎨 <b>WHAT GOES HERE?</b>\n' +
'• Social media content planning\n' +
'• New ad campaign ideas\n' +
'• Brand asset coordination\n' +
'\n' +
'🛠 <b>MARKETING COMMANDS</b>\n' +
'• <code>/idea [description]</code> — Submit a new marketing idea\n' +
'• <code>/ideas</code> — View and vote on the team\'s ideas\n' +
'• <code>/brainstorm [topic]</code> — Trigger an AI brainstorming session\n' +
'• <code>/template ad_copy</code> — Get marketing copy templates\n' +
'\n' +
'💡 <b>PRACTICAL EXAMPLE</b>\n' +
'<i>"Got a cool idea for TikTok? Type <code>/idea Post a tour of #unit_10</code>"</i>\n' +
'\n' +
'━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
'\n' +
'نمو علامة "مفتاح الشهر". المحتوى، الإعلانات، والإبداع.\n' +
'\n' +
'🎨 <b>ماذا ينشر هنا؟</b>\n' +
'• تخطيط محتوى وسائل التواصل الاجتماعي\n' +
'• أفكار الحملات الإعلانية الجديدة\n' +
'• تنسيق أصول العلامة التجارية\n' +
'\n' +
'🛠 <b>أوامر التسويق</b>\n' +
'• <code>/idea [الوصف]</code> — تقديم فكرة تسويقية جديدة\n' +
'• <code>/ideas</code> — عرض والتصويت على أفكار الفريق\n' +
'• <code>/brainstorm [الموضوع]</code> — بدء جلسة عصف ذهني ذكية\n' +
'• <code>/template ad_copy</code> — الحصول على قوالب نصوص إعلانية'
  },
  {
    id: 12,
    label: '09 — Legal',
    text:
'⚖️ <b>09 — LEGAL & COMPLIANCE | القانونية والامتثال</b>\n' +
'\n' +
'Contracts, permits, and regulations. Protecting the company and our guests.\n' +
'\n' +
'🛡 <b>WHAT GOES HERE?</b>\n' +
'• Contract reviews and signatures\n' +
'• Regulatory updates (Tourism ministry, etc.)\n' +
'• Dispute management\n' +
'\n' +
'🛠 <b>LEGAL COMMANDS</b>\n' +
'• <code>/task Review contract for #unit_50 @Legal</code>\n' +
'• <code>/remind 2026-06-01 Renew permit for building A</code>\n' +
'• <code>/audit</code> — Review sensitive compliance actions\n' +
'\n' +
'⚠️ <b>CONFIDENTIALITY:</b> Legal matters are highly sensitive. Share information only on a "need to know" basis.\n' +
'\n' +
'━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
'\n' +
'العقود، التصاريح، واللوائح. حماية الشركة وضيوفنا.\n' +
'\n' +
'🛡 <b>ماذا ينشر هنا؟</b>\n' +
'• مراجعات العقود والتوقيعات\n' +
'• التحديثات التنظيمية (وزارة السياحة، إلخ)\n' +
'• إدارة النزاعات\n' +
'\n' +
'🛠 <b>الأوامر القانونية</b>\n' +
'• <code>/task مراجعة عقد #وحدة_50 @Legal</code>\n' +
'• <code>/remind 2026-06-01 تجديد تصريح المبنى A</code>\n' +
'• <code>/audit</code> — مراجعة إجراءات الامتثال الحساسة'
  },
  {
    id: 13,
    label: '10 — Blockers',
    text:
'🚨 <b>10 — BLOCKERS & ESCALATION | العوائق والتصعيد</b>\n' +
'\n' +
'<b>EMERGENCY & CRITICAL STOPPERS ONLY.</b> If you cannot work, or a guest is in danger, post here.\n' +
'\n' +
'🔥 <b>WHEN TO USE THIS?</b>\n' +
'• <b>Critical Blocker:</b> Work has stopped completely.\n' +
'• <b>Emergency:</b> Guest safety or major property damage.\n' +
'• <b>SLA Breach:</b> A high-priority task is overdue.\n' +
'\n' +
'🛠 <b>ESCALATION COMMANDS</b>\n' +
'• <code>/escalate [task_id]</code> — Force immediate CEO attention\n' +
'• <code>/sla</code> — View all critical overdue items\n' +
'• <code>/task EMERGENCY: Water leak in #502 @Maintenance</code>\n' +
'\n' +
'💡 <b>PRACTICAL EXAMPLE</b>\n' +
'<i>"AC broken and guest is angry? <code>/task</code> here and <code>/escalate</code>."</i>\n' +
'\n' +
'⏰ <b>MANAGEMENT SLA:</b> 30 Minute response time guaranteed.\n' +
'\n' +
'━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
'\n' +
'<b>للطوارئ والعوائق الحرجة فقط.</b> إذا كنت لا تستطيع العمل، أو كان الضيف في خطر، انشر هنا.\n' +
'\n' +
'🔥 <b>متى تستخدم هذا؟</b>\n' +
'• <b>عائق حرج:</b> العمل توقف تماماً.\n' +
'• <b>طوارئ:</b> سلامة الضيف أو ضرر كبير في العقار.\n' +
'• <b>خرق اتفاقية الخدمة:</b> مهمة عالية الأولوية متأخرة.\n' +
'\n' +
'🛠 <b>أوامر التصعيد</b>\n' +
'• <code>/escalate [رقم]</code> — لفت انتباه المدير التنفيذي فوراً\n' +
'• <code>/sla</code> — عرض جميع العناصر الحرجة المتأخرة\n' +
'• <code>/task طوارئ: تسرب مياه في #502 @Maintenance</code>'
  },
  {
    id: 14,
    label: '11 — Completed',
    text:
'✅ <b>11 — COMPLETED TODAY | المنجز اليوم</b>\n' +
'\n' +
'The "Wall of Fame." Every completed task must be logged here for the daily report.\n' +
'\n' +
'🏆 <b>WHAT GOES HERE?</b>\n' +
'• Confirmation of finished tasks\n' +
'• 📊 <b>06:00 PM:</b> Final daily check-in logs\n' +
'• Shout-outs for team wins\n' +
'\n' +
'🛠 <b>COMPLETION COMMANDS</b>\n' +
'• <code>/done [id]</code> — The most important command. Use it daily.\n' +
'• <code>/tasks done</code> — View everything the team achieved today\n' +
'• <code>/performance</code> — See your daily completion score\n' +
'\n' +
'💡 <b>PRACTICAL EXAMPLE</b>\n' +
'<i>"Finished that report? Don\'t just say it, type <code>/done 123</code>"</i>\n' +
'\n' +
'━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
'\n' +
'"لوحة الشرف". كل مهمة مكتملة يجب أن تسجل هنا للتقرير اليومي.\n' +
'\n' +
'🏆 <b>ماذا ينشر هنا؟</b>\n' +
'• تأكيد المهام المنتهية\n' +
'• 📊 <b>٠٦:٠٠ مساءً:</b> سجلات الحضور والانصراف النهائية\n' +
'• الإشادة بنجاحات الفريق\n' +
'\n' +
'🛠 <b>أوامر الإنجاز</b>\n' +
'• <code>/done [رقم]</code> — الأمر الأهم. استخدمه يومياً.\n' +
'• <code>/tasks done</code> — عرض كل ما أنجزه الفريق اليوم\n' +
'• <code>/performance</code> — عرض نقاط إنجازك اليومية'
  },
  {
    id: 15,
    label: '12 — Priorities',
    text:
'📌 <b>12 — TOMORROW\'S PRIORITIES | أولويات الغد</b>\n' +
'\n' +
'Plan today to win tomorrow. Setting the stage for the next 24 hours.\n' +
'\n' +
'📅 <b>WHAT GOES HERE?</b>\n' +
'• Top 3 goals for tomorrow\n' +
'• Upcoming guest check-ins\n' +
'• Critical deadlines for the next day\n' +
'\n' +
'🛠 <b>PLANNING COMMANDS</b>\n' +
'• <code>/task Prepare #unit_5 for VIP guest @Tomorrow</code>\n' +
'• <code>/remind tomorrow 09:00 Call the maintenance team</code>\n' +
'• <code>/meeting start "Tomorrow Sync"</code> — Plan with the team\n' +
'\n' +
'💡 <b>PRACTICAL EXAMPLE</b>\n' +
'<i>"Before you leave: Type <code>/task</code> for your main goal tomorrow."</i>\n' +
'\n' +
'━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
'\n' +
'خطط اليوم لتفوز غداً. تمهيد الطريق للـ ٢٤ ساعة القادمة.\n' +
'\n' +
'📅 <b>ماذا ينشر هنا؟</b>\n' +
'• أهم ٣ أهداف للغد\n' +
'• حجوزات الضيوف القادمة\n' +
'• المواعيد النهائية الحرجة لليوم التالي\n' +
'\n' +
'🛠 <b>أوامر التخطيط</b>\n' +
'• <code>/task تجهيز #وحدة_5 لضيف VIP @Tomorrow</code>\n' +
'• <code>/remind tomorrow 09:00 الاتصال بفريق الصيانة</code>\n' +
'• <code>/meeting start "مزامنة الغد"</code> — التخطيط مع الفريق'
  },
  {
    id: 235,
    label: '15 — Admin Panel',
    text:
'🔐 <b>15 — ADMIN PANEL | لوحة الإدارة</b>\n' +
'\n' +
'System configuration and high-level oversight. RESTRICTED ACCESS.\n' +
'\n' +
'🛡 <b>ADMIN CAPABILITIES</b>\n' +
'• User role management and permissions\n' +
'• System health and scheduler monitoring\n' +
'• Database and environment configuration\n' +
'\n' +
'🛠 <b>ADMIN COMMANDS</b>\n' +
'• <code>/admin setrole @user Manager</code> — Assign authority\n' +
'• <code>/admin schedule</code> — View all automated company pings\n' +
'• <code>/admin broadcast [topic] [msg]</code> — Official announcement\n' +
'• <code>/admin logs 50</code> — Audit the last 50 system actions\n' +
'• <code>/admin stats</code> — Total company operational volume\n' +
'\n' +
'⚠️ <b>STRICT RULE:</b> Non-admins attempting commands here will be logged and reported.\n' +
'\n' +
'━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
'\n' +
'تكوين النظام والإشراف رفيع المستوى. الوصول مقيد.\n' +
'\n' +
'🛡 <b>إمكانيات المسؤول</b>\n' +
'• إدارة أدوار المستخدمين والأذونات\n' +
'• مراقبة صحة النظام والمجدول\n' +
'• تكوين قاعدة البيانات والبيئة\n' +
'\n' +
'🛠 <b>أوامر المسؤول</b>\n' +
'• <code>/admin setrole @user Manager</code> — تعيين صلاحية\n' +
'• <code>/admin schedule</code> — عرض جميع تنبيهات الشركة الآلية\n' +
'• <code>/admin broadcast [موضوع] [رسالة]</code> — إعلان رسمي\n' +
'• <code>/admin logs 50</code> — مراجعة آخر ٥٠ إجراء للنظام\n' +
'• <code>/admin stats</code> — إجمالي حجم العمليات في الشركة'
  }
];

// ═══════════════════════════════════════════════════════════════
// CEO MASTER WORKFLOW MESSAGE
// ═══════════════════════════════════════════════════════════════

const ceoWorkflowMessage =
'👑 <b>THE MONTHLY KEY DAILY PROTOCOL | البروتوكول اليومي لمفتاح الشهر</b>\n' +
'\n' +
'Team, excellence is not an act, but a habit. To ensure we dominate the market, every member must follow this daily AI-driven workflow:\n' +
'\n' +
'🌅 <b>09:00 AM — THE LAUNCH</b>\n' +
'1. Read the <b>Morning Briefing</b> in this topic.\n' +
'2. Type <code>/tasks</code> to see your assigned load.\n' +
'3. Acknowledge your priorities with a 👍 or a comment.\n' +
'\n' +
'⚡️ <b>REAL-TIME EXECUTION</b>\n' +
'• <b>No Verbal Tasks:</b> If a manager gives an order, it MUST be a <code>/task</code>.\n' +
'• <b>Instant Updates:</b> Type <code>/done [id]</code> the <i>second</i> you finish. Do not wait.\n' +
'• <b>Active Reminders:</b> Use <code>/remind</code> for every follow-up. Never rely on memory.\n' +
'\n' +
'🚨 <b>ZERO TOLERANCE FOR BLOCKERS</b>\n' +
'• If you are stuck for more than 15 minutes, post in <b>Topic 10</b>.\n' +
'• Use <code>/escalate</code> if management hasn’t responded to a critical issue.\n' +
'\n' +
'🌆 <b>06:00 PM — THE CLOSURE</b>\n' +
'1. Mark all final tasks as <code>/done</code>.\n' +
'2. Post your 3 priorities for tomorrow in <b>Topic 12</b>.\n' +
'3. Check the <b>Daily Performance Report</b> at 09:00 PM to see our wins.\n' +
'\n' +
'<i>"Our system is our strength. Use it with discipline, and we will lead the industry."</i>\n' +
'\n' +
'━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
'\n' +
'👑 <b>البروتوكول اليومي لمفتاح الشهر</b>\n' +
'\n' +
'فريقنا، التميز ليس فعلاً عابراً، بل هو عادة. لضمان سيطرتنا على السوق، يجب على كل عضو اتباع سير العمل اليومي التالي:\n' +
'\n' +
'🌅 <b>٠٩:٠٠ صباحاً — الانطلاق</b>\n' +
'١. اقرأ <b>الإحاطة الصباحية</b> في هذا الموضوع.\n' +
'٢. اكتب <code>/tasks</code> لرؤية المهام المسندة إليك.\n' +
'٣. أقر بأولوياتك باستخدام 👍 أو تعليق.\n' +
'\n' +
'⚡️ <b>التنفيذ في الوقت الفعلي</b>\n' +
'• <b>لا مهام شفهية:</b> إذا أعطى المدير أمراً، يجب أن يكون <code>/task</code>.\n' +
'• <b>تحديثات فورية:</b> اكتب <code>/done [رقم]</code> في <i>لحظة</i> الانتهاء. لا تنتظر.\n' +
'• <b>تذكيرات نشطة:</b> استخدم <code>/remind</code> لكل متابعة. لا تعتمد أبداً على الذاكرة.\n' +
'\n' +
'🚨 <b>لا تسامح مع العوائق</b>\n' +
'• إذا تعطلت لأكثر من ١٥ دقيقة، انشر في <b>الموضوع ١٠</b>.\n' +
'• استخدم <code>/escalate</code> إذا لم تستجب الإدارة لمشكلة حرجة.\n' +
'\n' +
'🌆 <b>٠٦:٠٠ مساءً — الإغلاق</b>\n' +
'١. حدد جميع المهام النهائية كـ <code>/done</code>.\n' +
'٢. انشر أهم ٣ أولويات للغد في <b>الموضوع ١٢</b>.\n' +
'٣. تحقق من <b>تقرير الأداء اليومي</b> الساعة ٠٩:٠٠ مساءً لرؤية نجاحاتنا.\n' +
'\n' +
'<i>"نظامنا هو قوتنا. استخدموه بانضباط، وسنقود هذا القطاع."</i>';

// ═══════════════════════════════════════════════════════════════
// EXECUTION LOGIC
// ═══════════════════════════════════════════════════════════════

async function main() {
  console.log('🚀 STARTING MISSION-READY SYSTEM UPGRADE...');

  // 1. DELETE PREVIOUS BOT PINS (IDs 348 to 400)
  console.log('\n🗑️ STEP 1: Deleting current bot-sent pins (348-400)...');
  let deleted = 0;
  for (let id = 348; id <= 400; id++) {
    let r = await api('deleteMessage', { chat_id: CHAT_ID, message_id: id });
    if (r.ok) {
      deleted++;
      process.stdout.write('🗑️' + id + ' ');
    } else {
      process.stdout.write('.');
    }
    if (id % 10 === 0) await sleep(1000);
  }
  console.log(`\n✅ Deleted ${deleted} bot messages.`);

  // 2. POST NEW TOPIC PINS
  console.log('\n📌 STEP 2: Posting upgraded topic pins...');
  for (let topic of topics) {
    console.log(`  Posting: ${topic.label}`);
    let params = { chat_id: CHAT_ID, text: topic.text, parse_mode: 'HTML', disable_notification: true };
    if (topic.id) params.message_thread_id = topic.id;
    
    let r = await api('sendMessage', params);
    if (r.ok) {
      let msgId = r.result.message_id;
      await api('pinChatMessage', { chat_id: CHAT_ID, message_id: msgId, disable_notification: true });
      console.log(`    ✅ Success (ID: ${msgId})`);
    } else {
      console.log(`    ❌ Failed: ${r.description}`);
    }
    await sleep(3000); // Respect rate limits
  }

  // 3. POST CEO MASTER WORKFLOW
  console.log('\n👑 STEP 3: Posting CEO Master Workflow...');
  let ceoR = await api('sendMessage', {
    chat_id: CHAT_ID,
    message_thread_id: 4,
    text: ceoWorkflowMessage,
    parse_mode: 'HTML',
    disable_notification: true
  });
  if (ceoR.ok) {
    let msgId = ceoR.result.message_id;
    await api('pinChatMessage', { chat_id: CHAT_ID, message_id: msgId, disable_notification: true });
    console.log(`  ✅ Success (ID: ${msgId})`);
  } else {
    console.log(`  ❌ Failed: ${ceoR.description}`);
  }

  console.log('\n✨ MISSION COMPLETE. SYSTEM UPGRADED.');
}

main().catch(console.error);
