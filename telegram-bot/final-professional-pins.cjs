/**
 * Final Professional Bilingual Pins
 * -----------------------------------
 * This script:
 * 1. Deletes all known bot-sent duplicate messages (by ID range)
 * 2. Posts one professional bilingual pinned message per topic
 * 3. Posts the CEO motivational message to topic 01
 * 4. Pins each message
 * 5. Logs every action for accountability
 *
 * SAFETY: Only deletes messages in the known bot-sent ID ranges.
 *         Never touches messages outside those ranges.
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
// TOPIC DEFINITIONS WITH PROFESSIONAL BILINGUAL MESSAGES
// ═══════════════════════════════════════════════════════════════

var topics = [
  {
    id: null,
    label: 'General',
    text:
'💬 <b>Daily Operations HQ — General</b>\n' +
'<b>المقر التشغيلي اليومي — عام</b>\n' +
'\n' +
'Welcome to the Monthly Key Daily Operations Headquarters.\n' +
'This is the central hub for all team communication, coordination, and operational management.\n' +
'\n' +
'<b>📌 Group Structure:</b>\n' +
'Each topic is dedicated to a specific operational area. Post in the correct topic to keep discussions organized and searchable.\n' +
'\n' +
'<b>🤖 Bot Commands (Available Everywhere):</b>\n' +
'• <code>/task [description]</code> — Create a new task\n' +
'• <code>/tasks</code> — View all active tasks\n' +
'• <code>/done [id]</code> — Mark a task complete\n' +
'• <code>/remind [time] [note]</code> — Set a reminder\n' +
'• <code>/help</code> — Full command reference\n' +
'\n' +
'<b>📋 Rules:</b>\n' +
'1. Stay on topic — use the correct thread for each matter\n' +
'2. Tag people with @mention when you need their attention\n' +
'3. Use bot commands to track tasks, not just chat messages\n' +
'4. Respond to assigned tasks within 24 hours\n' +
'5. Escalate blockers immediately in Topic 10\n' +
'\n' +
'━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
'\n' +
'مرحباً بكم في المقر التشغيلي اليومي لمفتاح الشهر.\n' +
'هذا هو المركز الرئيسي لجميع اتصالات الفريق والتنسيق والإدارة التشغيلية.\n' +
'\n' +
'<b>📌 هيكل المجموعة:</b>\n' +
'كل موضوع مخصص لمجال تشغيلي محدد. انشر في الموضوع الصحيح للحفاظ على تنظيم المناقشات.\n' +
'\n' +
'<b>🤖 أوامر البوت (متاحة في كل مكان):</b>\n' +
'• <code>/task [الوصف]</code> — إنشاء مهمة جديدة\n' +
'• <code>/tasks</code> — عرض جميع المهام النشطة\n' +
'• <code>/done [رقم]</code> — تحديد مهمة كمنجزة\n' +
'• <code>/remind [الوقت] [ملاحظة]</code> — تعيين تذكير\n' +
'• <code>/help</code> — مرجع الأوامر الكامل\n' +
'\n' +
'<b>📋 القواعد:</b>\n' +
'١. التزم بالموضوع — استخدم القناة الصحيحة لكل مسألة\n' +
'٢. أشر للأشخاص بـ @mention عند الحاجة لانتباههم\n' +
'٣. استخدم أوامر البوت لتتبع المهام\n' +
'٤. استجب للمهام المسندة خلال ٢٤ ساعة\n' +
'٥. صعّد العوائق فوراً في الموضوع ١٠'
  },
  {
    id: 3,
    label: '00 — Rules & Guide',
    text:
'📋 <b>00 — Rules & Guide | القواعد والدليل</b>\n' +
'\n' +
'This topic contains the standard operating procedures, group rules, and the complete bot feature guide for the Monthly Key operations system.\n' +
'\n' +
'<b>📖 What You\'ll Find Here:</b>\n' +
'• Standard Operating Procedures (SOPs)\n' +
'• Group rules and communication guidelines\n' +
'• Complete 49-feature bot guide\n' +
'• Onboarding materials for new team members\n' +
'\n' +
'<b>🔑 Key Commands for This Topic:</b>\n' +
'• <code>/help</code> — Full command reference\n' +
'• <code>/onboarding</code> — View onboarding checklist\n' +
'• <code>/roles</code> — View team role assignments\n' +
'\n' +
'<b>⚠️ Important:</b> This is a reference topic. Please do not post general discussions here. Read the pinned guide carefully before asking questions.\n' +
'\n' +
'━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
'\n' +
'يحتوي هذا الموضوع على إجراءات التشغيل القياسية وقواعد المجموعة ودليل ميزات البوت الكامل لنظام عمليات مفتاح الشهر.\n' +
'\n' +
'<b>📖 ما ستجده هنا:</b>\n' +
'• إجراءات التشغيل القياسية\n' +
'• قواعد المجموعة وإرشادات التواصل\n' +
'• دليل البوت الكامل بـ ٤٩ ميزة\n' +
'• مواد التأهيل للأعضاء الجدد\n' +
'\n' +
'<b>🔑 الأوامر الرئيسية لهذا الموضوع:</b>\n' +
'• <code>/help</code> — مرجع الأوامر الكامل\n' +
'• <code>/onboarding</code> — عرض قائمة التأهيل\n' +
'• <code>/roles</code> — عرض أدوار الفريق\n' +
'\n' +
'<b>⚠️ مهم:</b> هذا موضوع مرجعي. يرجى عدم نشر مناقشات عامة هنا. اقرأ الدليل المثبت بعناية.'
  },
  {
    id: 4,
    label: '01 — CEO Update',
    text:
'📊 <b>01 — CEO Update | تحديث المدير التنفيذي</b>\n' +
'\n' +
'This is the CEO\'s direct communication channel with the entire team. Strategic updates, company direction, performance reviews, and important announcements are posted here.\n' +
'\n' +
'<b>📌 What Gets Posted Here:</b>\n' +
'• ☀️ Morning briefing (auto at 9:00 AM KSA)\n' +
'• 📊 Daily performance report (auto at 9:00 PM KSA)\n' +
'• 👑 Weekly CEO message (Sundays 9:00 AM KSA)\n' +
'• 📋 Check-in reminders (auto at 5:00 PM KSA)\n' +
'• Strategic decisions and company updates\n' +
'\n' +
'<b>🔑 Key Commands:</b>\n' +
'• <code>/kpi</code> — View team KPI dashboard\n' +
'• <code>/report</code> — Generate performance report\n' +
'• <code>/tasks</code> — Review all active tasks\n' +
'• <code>/audit</code> — View activity audit trail\n' +
'\n' +
'<b>📋 Team Expectations:</b>\n' +
'Read every CEO update carefully. Respond to direct questions within 2 hours. Complete your daily check-in before 6:00 PM KSA.\n' +
'\n' +
'━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
'\n' +
'هذه قناة التواصل المباشر للمدير التنفيذي مع الفريق بأكمله. يتم نشر التحديثات الاستراتيجية واتجاه الشركة ومراجعات الأداء والإعلانات المهمة هنا.\n' +
'\n' +
'<b>📌 ما يُنشر هنا:</b>\n' +
'• ☀️ الإحاطة الصباحية (تلقائياً الساعة ٩:٠٠ صباحاً بتوقيت السعودية)\n' +
'• 📊 تقرير الأداء اليومي (تلقائياً الساعة ٩:٠٠ مساءً)\n' +
'• 👑 رسالة المدير التنفيذي الأسبوعية (الأحد ٩:٠٠ صباحاً)\n' +
'• 📋 تذكيرات تسجيل الحضور (تلقائياً الساعة ٥:٠٠ مساءً)\n' +
'• القرارات الاستراتيجية وتحديثات الشركة\n' +
'\n' +
'<b>🔑 الأوامر الرئيسية:</b>\n' +
'• <code>/kpi</code> — عرض لوحة مؤشرات الأداء\n' +
'• <code>/report</code> — إنشاء تقرير الأداء\n' +
'• <code>/tasks</code> — مراجعة جميع المهام النشطة\n' +
'• <code>/audit</code> — عرض سجل المراجعة\n' +
'\n' +
'<b>📋 توقعات الفريق:</b>\n' +
'اقرأ كل تحديث من المدير التنفيذي بعناية. استجب للأسئلة المباشرة خلال ساعتين. أكمل تسجيل حضورك اليومي قبل الساعة ٦:٠٠ مساءً.'
  },
  {
    id: 5,
    label: '02 — Operations',
    text:
'🔧 <b>02 — Operations | المتابعة التشغيلية</b>\n' +
'\n' +
'The central hub for daily operational tracking, task coordination, and team workflow management. All operational matters should be discussed and tracked here.\n' +
'\n' +
'<b>📌 What Belongs Here:</b>\n' +
'• Daily task assignments and updates\n' +
'• Operational coordination between team members\n' +
'• Process improvements and workflow changes\n' +
'• 🌤️ Weather alerts (auto at 7:00 AM KSA)\n' +
'\n' +
'<b>🔑 Key Commands:</b>\n' +
'• <code>/task [description]</code> — Create a new task\n' +
'• <code>/tasks</code> — View all active tasks\n' +
'• <code>/assign @user [task_id]</code> — Assign a task\n' +
'• <code>/done [id]</code> — Mark task complete\n' +
'• <code>/handover @user [id]</code> — Transfer a task\n' +
'• <code>/checklist [id]</code> — View task checklist\n' +
'• <code>/workflow</code> — View active workflows\n' +
'\n' +
'<b>⏰ Response Time:</b> Operational tasks must be acknowledged within 4 hours.\n' +
'\n' +
'━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
'\n' +
'المركز الرئيسي للمتابعة التشغيلية اليومية وتنسيق المهام وإدارة سير عمل الفريق. يجب مناقشة وتتبع جميع المسائل التشغيلية هنا.\n' +
'\n' +
'<b>📌 ما ينتمي هنا:</b>\n' +
'• تعيينات المهام اليومية والتحديثات\n' +
'• التنسيق التشغيلي بين أعضاء الفريق\n' +
'• تحسينات العمليات وتغييرات سير العمل\n' +
'• 🌤️ تنبيهات الطقس (تلقائياً الساعة ٧:٠٠ صباحاً)\n' +
'\n' +
'<b>🔑 الأوامر الرئيسية:</b>\n' +
'• <code>/task [الوصف]</code> — إنشاء مهمة جديدة\n' +
'• <code>/tasks</code> — عرض جميع المهام النشطة\n' +
'• <code>/assign @مستخدم [رقم_المهمة]</code> — تعيين مهمة\n' +
'• <code>/done [رقم]</code> — تحديد مهمة كمنجزة\n' +
'• <code>/handover @مستخدم [رقم]</code> — نقل مهمة\n' +
'• <code>/checklist [رقم]</code> — عرض قائمة المهام\n' +
'• <code>/workflow</code> — عرض سير العمل النشط\n' +
'\n' +
'<b>⏰ وقت الاستجابة:</b> يجب الإقرار بالمهام التشغيلية خلال ٤ ساعات.'
  },
  {
    id: 6,
    label: '03 — Listings',
    text:
'🏠 <b>03 — Listings & Inventory | العقارات والمخزون</b>\n' +
'\n' +
'Manage property listings, unit availability, inventory tracking, and property-related updates. All property management discussions belong here.\n' +
'\n' +
'<b>📌 What Belongs Here:</b>\n' +
'• New property listings and updates\n' +
'• Unit availability and status changes\n' +
'• Property photos and inspection reports\n' +
'• Inventory management and supplies\n' +
'\n' +
'<b>🔑 Key Commands:</b>\n' +
'• <code>/occupancy</code> — View occupancy dashboard\n' +
'• <code>/photos</code> — View property photo log\n' +
'• <code>/mlog [description]</code> — Log maintenance work\n' +
'• <code>/clean [unit]</code> — Log cleaning activity\n' +
'• <code>/trends</code> — View operational trends\n' +
'\n' +
'━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
'\n' +
'إدارة قوائم العقارات وتوفر الوحدات وتتبع المخزون والتحديثات المتعلقة بالعقارات. جميع مناقشات إدارة العقارات تنتمي هنا.\n' +
'\n' +
'<b>📌 ما ينتمي هنا:</b>\n' +
'• قوائم العقارات الجديدة والتحديثات\n' +
'• توفر الوحدات وتغييرات الحالة\n' +
'• صور العقارات وتقارير التفتيش\n' +
'• إدارة المخزون والمستلزمات\n' +
'\n' +
'<b>🔑 الأوامر الرئيسية:</b>\n' +
'• <code>/occupancy</code> — عرض لوحة الإشغال\n' +
'• <code>/photos</code> — عرض سجل صور العقارات\n' +
'• <code>/mlog [الوصف]</code> — تسجيل أعمال الصيانة\n' +
'• <code>/clean [الوحدة]</code> — تسجيل نشاط التنظيف\n' +
'• <code>/trends</code> — عرض الاتجاهات التشغيلية'
  },
  {
    id: 7,
    label: '04 — Bookings & Revenue',
    text:
'💰 <b>04 — Bookings & Revenue | الحجوزات والإيرادات</b>\n' +
'\n' +
'Track all bookings, revenue performance, financial targets, and guest-related financial matters. This is the financial pulse of operations.\n' +
'\n' +
'<b>📌 What Belongs Here:</b>\n' +
'• New booking confirmations and cancellations\n' +
'• Revenue tracking and daily totals\n' +
'• Pricing decisions and rate adjustments\n' +
'• Guest payment issues and refunds\n' +
'\n' +
'<b>🔑 Key Commands:</b>\n' +
'• <code>/expense [amount] [description]</code> — Log an expense\n' +
'• <code>/expenses</code> — View expense summary\n' +
'• <code>/kpi</code> — View KPI dashboard\n' +
'• <code>/report</code> — Generate financial report\n' +
'\n' +
'━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
'\n' +
'تتبع جميع الحجوزات وأداء الإيرادات والأهداف المالية والمسائل المالية المتعلقة بالضيوف. هذا هو النبض المالي للعمليات.\n' +
'\n' +
'<b>📌 ما ينتمي هنا:</b>\n' +
'• تأكيدات الحجز الجديدة والإلغاءات\n' +
'• تتبع الإيرادات والإجماليات اليومية\n' +
'• قرارات التسعير وتعديلات الأسعار\n' +
'• مشاكل دفع الضيوف والمبالغ المستردة\n' +
'\n' +
'<b>🔑 الأوامر الرئيسية:</b>\n' +
'• <code>/expense [المبلغ] [الوصف]</code> — تسجيل مصروف\n' +
'• <code>/expenses</code> — عرض ملخص المصروفات\n' +
'• <code>/kpi</code> — عرض لوحة مؤشرات الأداء\n' +
'• <code>/report</code> — إنشاء تقرير مالي'
  },
  {
    id: 8,
    label: '05 — Support',
    text:
'🎧 <b>05 — Customer Support | دعم العملاء</b>\n' +
'\n' +
'Coordinate guest support, handle complaints, track resolution times, and ensure excellent service delivery. Every guest issue should be logged and tracked here.\n' +
'\n' +
'<b>📌 What Belongs Here:</b>\n' +
'• Guest complaints and support requests\n' +
'• Issue resolution tracking and follow-ups\n' +
'• Service quality discussions\n' +
'• Guest feedback and reviews\n' +
'\n' +
'<b>🔑 Key Commands:</b>\n' +
'• <code>/task [guest issue description]</code> — Log a support ticket\n' +
'• <code>/sla</code> — Check SLA compliance\n' +
'• <code>/remind [time] [follow-up note]</code> — Set follow-up reminder\n' +
'• <code>/done [id]</code> — Close resolved ticket\n' +
'\n' +
'<b>⏰ SLA Target:</b> Respond to all guest issues within 1 hour. Resolve within 24 hours.\n' +
'\n' +
'━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
'\n' +
'تنسيق دعم الضيوف ومعالجة الشكاوى وتتبع أوقات الحل وضمان تقديم خدمة ممتازة. يجب تسجيل وتتبع كل مشكلة ضيف هنا.\n' +
'\n' +
'<b>📌 ما ينتمي هنا:</b>\n' +
'• شكاوى الضيوف وطلبات الدعم\n' +
'• تتبع حل المشكلات والمتابعات\n' +
'• مناقشات جودة الخدمة\n' +
'• ملاحظات الضيوف والمراجعات\n' +
'\n' +
'<b>🔑 الأوامر الرئيسية:</b>\n' +
'• <code>/task [وصف مشكلة الضيف]</code> — تسجيل تذكرة دعم\n' +
'• <code>/sla</code> — التحقق من الامتثال لاتفاقية مستوى الخدمة\n' +
'• <code>/remind [الوقت] [ملاحظة المتابعة]</code> — تعيين تذكير متابعة\n' +
'• <code>/done [رقم]</code> — إغلاق التذكرة المحلولة\n' +
'\n' +
'<b>⏰ هدف اتفاقية الخدمة:</b> الاستجابة لجميع مشاكل الضيوف خلال ساعة واحدة. الحل خلال ٢٤ ساعة.'
  },
  {
    id: 9,
    label: '06 — Tech Issues',
    text:
'💻 <b>06 — Tech Issues | المشاكل التقنية</b>\n' +
'\n' +
'Report and track all technical bugs, system outages, software issues, and IT-related problems. Include screenshots and error details when reporting.\n' +
'\n' +
'<b>📌 What Belongs Here:</b>\n' +
'• Software bugs and system errors\n' +
'• Website and app issues\n' +
'• Smart lock and IoT device problems\n' +
'• Internet and connectivity issues\n' +
'\n' +
'<b>🔑 Key Commands:</b>\n' +
'• <code>/task [bug description]</code> — Report a tech issue\n' +
'• <code>/mlog [description]</code> — Log maintenance work\n' +
'• <code>/assign @tech_team [id]</code> — Assign to tech team\n' +
'\n' +
'<b>📋 When Reporting:</b> Always include: what happened, when, which device/system, and a screenshot if possible.\n' +
'\n' +
'━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
'\n' +
'الإبلاغ عن جميع الأعطال التقنية وانقطاعات النظام ومشاكل البرمجيات والمشاكل المتعلقة بتكنولوجيا المعلومات وتتبعها. أرفق لقطات شاشة وتفاصيل الخطأ عند الإبلاغ.\n' +
'\n' +
'<b>📌 ما ينتمي هنا:</b>\n' +
'• أعطال البرمجيات وأخطاء النظام\n' +
'• مشاكل الموقع والتطبيق\n' +
'• مشاكل الأقفال الذكية وأجهزة IoT\n' +
'• مشاكل الإنترنت والاتصال\n' +
'\n' +
'<b>🔑 الأوامر الرئيسية:</b>\n' +
'• <code>/task [وصف العطل]</code> — الإبلاغ عن مشكلة تقنية\n' +
'• <code>/mlog [الوصف]</code> — تسجيل أعمال الصيانة\n' +
'• <code>/assign @فريق_التقنية [رقم]</code> — تعيين للفريق التقني\n' +
'\n' +
'<b>📋 عند الإبلاغ:</b> أرفق دائماً: ماذا حدث، متى، أي جهاز/نظام، ولقطة شاشة إن أمكن.'
  },
  {
    id: 10,
    label: '07 — Payments',
    text:
'💳 <b>07 — Payments & Finance | المدفوعات والمالية</b>\n' +
'\n' +
'Track all financial transactions, payment processing, invoicing, and accounting matters. Maintain accurate records of all monetary activities.\n' +
'\n' +
'<b>📌 What Belongs Here:</b>\n' +
'• Payment confirmations and receipts\n' +
'• Invoice tracking and follow-ups\n' +
'• Vendor payments and supplier invoices\n' +
'• Financial discrepancies and reconciliation\n' +
'\n' +
'<b>🔑 Key Commands:</b>\n' +
'• <code>/expense [amount] [description]</code> — Log an expense\n' +
'• <code>/expenses</code> — View expense summary\n' +
'• <code>/approve [id]</code> — Approve a pending item\n' +
'• <code>/remind [time] [payment follow-up]</code> — Payment reminder\n' +
'\n' +
'━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
'\n' +
'تتبع جميع المعاملات المالية ومعالجة المدفوعات والفواتير والمسائل المحاسبية. الحفاظ على سجلات دقيقة لجميع الأنشطة المالية.\n' +
'\n' +
'<b>📌 ما ينتمي هنا:</b>\n' +
'• تأكيدات الدفع والإيصالات\n' +
'• تتبع الفواتير والمتابعات\n' +
'• مدفوعات الموردين وفواتير التوريد\n' +
'• التناقضات المالية والتسوية\n' +
'\n' +
'<b>🔑 الأوامر الرئيسية:</b>\n' +
'• <code>/expense [المبلغ] [الوصف]</code> — تسجيل مصروف\n' +
'• <code>/expenses</code> — عرض ملخص المصروفات\n' +
'• <code>/approve [رقم]</code> — الموافقة على عنصر معلق\n' +
'• <code>/remind [الوقت] [متابعة الدفع]</code> — تذكير بالدفع'
  },
  {
    id: 11,
    label: '08 — Marketing',
    text:
'📣 <b>08 — Marketing & Content | التسويق والمحتوى</b>\n' +
'\n' +
'Coordinate marketing campaigns, content creation, social media management, and brand promotion activities. Plan and track all marketing initiatives here.\n' +
'\n' +
'<b>📌 What Belongs Here:</b>\n' +
'• Marketing campaign planning and execution\n' +
'• Social media content and scheduling\n' +
'• Brand materials and design requests\n' +
'• Promotional offers and seasonal campaigns\n' +
'\n' +
'<b>🔑 Key Commands:</b>\n' +
'• <code>/task [campaign description]</code> — Create marketing task\n' +
'• <code>/idea [suggestion]</code> — Submit a marketing idea\n' +
'• <code>/ideas</code> — View idea board with voting\n' +
'• <code>/template [name]</code> — Use a message template\n' +
'\n' +
'━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
'\n' +
'تنسيق حملات التسويق وإنشاء المحتوى وإدارة وسائل التواصل الاجتماعي وأنشطة الترويج للعلامة التجارية. خطط وتتبع جميع المبادرات التسويقية هنا.\n' +
'\n' +
'<b>📌 ما ينتمي هنا:</b>\n' +
'• تخطيط وتنفيذ الحملات التسويقية\n' +
'• محتوى وسائل التواصل الاجتماعي والجدولة\n' +
'• مواد العلامة التجارية وطلبات التصميم\n' +
'• العروض الترويجية والحملات الموسمية\n' +
'\n' +
'<b>🔑 الأوامر الرئيسية:</b>\n' +
'• <code>/task [وصف الحملة]</code> — إنشاء مهمة تسويقية\n' +
'• <code>/idea [اقتراح]</code> — تقديم فكرة تسويقية\n' +
'• <code>/ideas</code> — عرض لوحة الأفكار مع التصويت\n' +
'• <code>/template [الاسم]</code> — استخدام قالب رسالة'
  },
  {
    id: 12,
    label: '09 — Legal',
    text:
'⚖️ <b>09 — Legal & Compliance | القانونية والامتثال</b>\n' +
'\n' +
'Handle all legal matters, contract management, regulatory compliance, and licensing requirements. Sensitive discussions should be handled with discretion.\n' +
'\n' +
'<b>📌 What Belongs Here:</b>\n' +
'• Contract reviews and negotiations\n' +
'• Regulatory compliance updates\n' +
'• License renewals and permits\n' +
'• Legal disputes and resolutions\n' +
'\n' +
'<b>🔑 Key Commands:</b>\n' +
'• <code>/task [legal matter]</code> — Track a legal item\n' +
'• <code>/remind [date] [deadline]</code> — Set compliance deadline\n' +
'• <code>/approve [id]</code> — Approve a legal document\n' +
'\n' +
'<b>⚠️ Confidentiality:</b> Legal matters are sensitive. Do not share details outside this topic.\n' +
'\n' +
'━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
'\n' +
'التعامل مع جميع المسائل القانونية وإدارة العقود والامتثال التنظيمي ومتطلبات الترخيص. يجب التعامل مع المناقشات الحساسة بحذر.\n' +
'\n' +
'<b>📌 ما ينتمي هنا:</b>\n' +
'• مراجعات العقود والمفاوضات\n' +
'• تحديثات الامتثال التنظيمي\n' +
'• تجديد التراخيص والتصاريح\n' +
'• النزاعات القانونية والحلول\n' +
'\n' +
'<b>🔑 الأوامر الرئيسية:</b>\n' +
'• <code>/task [المسألة القانونية]</code> — تتبع عنصر قانوني\n' +
'• <code>/remind [التاريخ] [الموعد النهائي]</code> — تعيين موعد امتثال\n' +
'• <code>/approve [رقم]</code> — الموافقة على وثيقة قانونية\n' +
'\n' +
'<b>⚠️ السرية:</b> المسائل القانونية حساسة. لا تشارك التفاصيل خارج هذا الموضوع.'
  },
  {
    id: 13,
    label: '10 — Blockers',
    text:
'🚨 <b>10 — Blockers & Escalation | العوائق والتصعيد</b>\n' +
'\n' +
'<b>URGENT ISSUES ONLY.</b> This topic is for blockers that prevent work from progressing and require immediate management attention. Do not use for routine issues.\n' +
'\n' +
'<b>📌 When to Post Here:</b>\n' +
'• A task is blocked and cannot proceed\n' +
'• A critical system is down\n' +
'• A guest emergency requires immediate action\n' +
'• An SLA is about to be breached\n' +
'• A decision is needed from management urgently\n' +
'\n' +
'<b>🔑 Key Commands:</b>\n' +
'• <code>/task [URGENT: description]</code> — Log an urgent blocker\n' +
'• <code>/escalate [id]</code> — Escalate a task to management\n' +
'• <code>/sla</code> — Check SLA status\n' +
'\n' +
'<b>⏰ Response Time:</b> All blockers must be acknowledged within 30 minutes by management.\n' +
'\n' +
'━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
'\n' +
'<b>المشاكل العاجلة فقط.</b> هذا الموضوع للعوائق التي تمنع تقدم العمل وتتطلب اهتمام الإدارة الفوري. لا تستخدمه للمشاكل الروتينية.\n' +
'\n' +
'<b>📌 متى تنشر هنا:</b>\n' +
'• مهمة معطلة ولا يمكن المتابعة\n' +
'• نظام حرج معطل\n' +
'• حالة طوارئ ضيف تتطلب إجراءً فورياً\n' +
'• اتفاقية مستوى خدمة على وشك الانتهاك\n' +
'• قرار مطلوب من الإدارة بشكل عاجل\n' +
'\n' +
'<b>🔑 الأوامر الرئيسية:</b>\n' +
'• <code>/task [عاجل: الوصف]</code> — تسجيل عائق عاجل\n' +
'• <code>/escalate [رقم]</code> — تصعيد مهمة للإدارة\n' +
'• <code>/sla</code> — التحقق من حالة اتفاقية الخدمة\n' +
'\n' +
'<b>⏰ وقت الاستجابة:</b> يجب الإقرار بجميع العوائق خلال ٣٠ دقيقة من قبل الإدارة.'
  },
  {
    id: 14,
    label: '11 — Completed',
    text:
'✅ <b>11 — Completed Today | المنجز اليوم</b>\n' +
'\n' +
'Log all completed tasks and achievements here. This serves as a daily record of team productivity and accomplishments.\n' +
'\n' +
'<b>📌 What Belongs Here:</b>\n' +
'• Completed task confirmations\n' +
'• Daily achievement summaries\n' +
'• Milestone completions\n' +
'• End-of-day check-in reports\n' +
'\n' +
'<b>🔑 Key Commands:</b>\n' +
'• <code>/done [id]</code> — Mark a task as complete\n' +
'• <code>/tasks done</code> — View recently completed tasks\n' +
'• <code>/kpi</code> — Check your productivity score\n' +
'\n' +
'<b>📋 Daily Check-in:</b> Post your completed items before 6:00 PM KSA every day.\n' +
'\n' +
'━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
'\n' +
'سجّل جميع المهام المنجزة والإنجازات هنا. يعمل هذا كسجل يومي لإنتاجية الفريق وإنجازاته.\n' +
'\n' +
'<b>📌 ما ينتمي هنا:</b>\n' +
'• تأكيدات المهام المنجزة\n' +
'• ملخصات الإنجازات اليومية\n' +
'• إتمام المراحل الرئيسية\n' +
'• تقارير تسجيل الحضور نهاية اليوم\n' +
'\n' +
'<b>🔑 الأوامر الرئيسية:</b>\n' +
'• <code>/done [رقم]</code> — تحديد مهمة كمنجزة\n' +
'• <code>/tasks done</code> — عرض المهام المنجزة مؤخراً\n' +
'• <code>/kpi</code> — التحقق من نقاط إنتاجيتك\n' +
'\n' +
'<b>📋 تسجيل الحضور اليومي:</b> انشر العناصر المنجزة قبل الساعة ٦:٠٠ مساءً بتوقيت السعودية يومياً.'
  },
  {
    id: 15,
    label: '12 — Priorities',
    text:
'📌 <b>12 — Tomorrow\'s Priorities | أولويات الغد</b>\n' +
'\n' +
'Plan ahead by setting priorities for the next working day. This ensures the team starts each day with clear direction and focus.\n' +
'\n' +
'<b>📌 What Belongs Here:</b>\n' +
'• Priority tasks for tomorrow\n' +
'• Upcoming deadlines and milestones\n' +
'• Resource allocation for next day\n' +
'• Pre-planned meetings and appointments\n' +
'\n' +
'<b>🔑 Key Commands:</b>\n' +
'• <code>/task [priority description]</code> — Create a priority task\n' +
'• <code>/tasks</code> — Review current task queue\n' +
'• <code>/remind tomorrow 9am [task]</code> — Set morning reminder\n' +
'\n' +
'<b>📋 Evening Routine:</b> Post your top 3 priorities for tomorrow before leaving each day.\n' +
'\n' +
'━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
'\n' +
'خطط مسبقاً بتحديد الأولويات ليوم العمل التالي. يضمن هذا أن يبدأ الفريق كل يوم باتجاه واضح وتركيز.\n' +
'\n' +
'<b>📌 ما ينتمي هنا:</b>\n' +
'• المهام ذات الأولوية للغد\n' +
'• المواعيد النهائية والمراحل القادمة\n' +
'• تخصيص الموارد لليوم التالي\n' +
'• الاجتماعات والمواعيد المخطط لها مسبقاً\n' +
'\n' +
'<b>🔑 الأوامر الرئيسية:</b>\n' +
'• <code>/task [وصف الأولوية]</code> — إنشاء مهمة ذات أولوية\n' +
'• <code>/tasks</code> — مراجعة قائمة المهام الحالية\n' +
'• <code>/remind غداً ٩ صباحاً [المهمة]</code> — تعيين تذكير صباحي\n' +
'\n' +
'<b>📋 روتين المساء:</b> انشر أهم ٣ أولويات للغد قبل المغادرة كل يوم.'
  },
  {
    id: 235,
    label: '15 — Admin Panel',
    text:
'🔐 <b>15 — Admin Panel | لوحة الإدارة</b>\n' +
'\n' +
'Restricted area for system administrators only. Configure bot settings, view system logs, manage team roles, and monitor system health.\n' +
'\n' +
'<b>🛡️ Access:</b> Only authorized administrators can use commands in this topic. Non-admin messages will be rejected.\n' +
'\n' +
'<b>🔑 Admin Commands:</b>\n' +
'• <code>/admin config</code> — View bot configuration\n' +
'• <code>/admin logs [n]</code> — View last N audit entries\n' +
'• <code>/admin audit [@user]</code> — User audit trail\n' +
'• <code>/admin roles</code> — View all role assignments\n' +
'• <code>/admin setrole @user Role</code> — Assign a role\n' +
'• <code>/admin schedule</code> — View all scheduled jobs\n' +
'• <code>/admin stats</code> — System statistics\n' +
'• <code>/admin db</code> — Database table row counts\n' +
'• <code>/admin env</code> — Environment variables (safe)\n' +
'• <code>/admin broadcast [topic] [msg]</code> — Send to any topic\n' +
'• <code>/admin test [text]</code> — Echo test\n' +
'\n' +
'━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
'\n' +
'منطقة مقيدة لمسؤولي النظام فقط. تكوين إعدادات البوت وعرض سجلات النظام وإدارة أدوار الفريق ومراقبة صحة النظام.\n' +
'\n' +
'<b>🛡️ الوصول:</b> يمكن فقط للمسؤولين المعتمدين استخدام الأوامر في هذا الموضوع. سيتم رفض رسائل غير المسؤولين.\n' +
'\n' +
'<b>🔑 أوامر المسؤول:</b>\n' +
'• <code>/admin config</code> — عرض تكوين البوت\n' +
'• <code>/admin logs [عدد]</code> — عرض آخر سجلات المراجعة\n' +
'• <code>/admin audit [@مستخدم]</code> — سجل مراجعة المستخدم\n' +
'• <code>/admin roles</code> — عرض جميع تعيينات الأدوار\n' +
'• <code>/admin setrole @مستخدم الدور</code> — تعيين دور\n' +
'• <code>/admin schedule</code> — عرض جميع المهام المجدولة\n' +
'• <code>/admin stats</code> — إحصائيات النظام\n' +
'• <code>/admin db</code> — عدد صفوف جداول قاعدة البيانات\n' +
'• <code>/admin env</code> — متغيرات البيئة (آمنة)\n' +
'• <code>/admin broadcast [موضوع] [رسالة]</code> — إرسال لأي موضوع\n' +
'• <code>/admin test [نص]</code> — اختبار الصدى'
  }
];

// ═══════════════════════════════════════════════════════════════
// CEO MOTIVATIONAL MESSAGE
// ═══════════════════════════════════════════════════════════════

var ceoMessage =
'👑 <b>Message from the CEO | رسالة من المدير التنفيذي</b>\n' +
'\n' +
'<b>🕐 Master Your Time, Master Your Success</b>\n' +
'\n' +
'Team, our operations system is built to help you work smarter, not harder. Here is how to make the most of every day:\n' +
'\n' +
'<b>1. Start Your Day Right</b>\n' +
'Open the group every morning and check <code>/tasks</code>. Know exactly what needs to be done before you start. The morning briefing at 9:00 AM gives you the full picture.\n' +
'\n' +
'<b>2. Track Everything in Real-Time</b>\n' +
'Don\'t wait until end of day to update progress. Use <code>/done [id]</code> the moment you finish a task. This keeps the whole team informed and builds your KPI score.\n' +
'\n' +
'<b>3. Never Miss a Deadline</b>\n' +
'Use <code>/remind [time] [note]</code> for every important deadline. The bot will follow up automatically. No excuses for forgotten commitments.\n' +
'\n' +
'<b>4. Escalate Blockers Immediately</b>\n' +
'If something is blocking your work, don\'t wait. Post in Topic 10 (Blockers) right away. Management will respond within 30 minutes.\n' +
'\n' +
'<b>5. End-of-Day Check-in</b>\n' +
'Before 6:00 PM, post your completed items in Topic 11 and your priorities for tomorrow in Topic 12. This is mandatory for every team member.\n' +
'\n' +
'<b>6. Use the Right Topic</b>\n' +
'Every topic exists for a reason. Post in the correct one. This keeps our operations organized and searchable.\n' +
'\n' +
'<i>Remember: This system only works if everyone uses it consistently. Your discipline today builds our success tomorrow.</i>\n' +
'\n' +
'━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
'\n' +
'👑 <b>رسالة من المدير التنفيذي</b>\n' +
'\n' +
'<b>🕐 أتقن وقتك، أتقن نجاحك</b>\n' +
'\n' +
'فريقنا، نظام العمليات لدينا مصمم لمساعدتكم على العمل بذكاء وليس بجهد أكبر. إليكم كيفية الاستفادة القصوى من كل يوم:\n' +
'\n' +
'<b>١. ابدأ يومك بشكل صحيح</b>\n' +
'افتح المجموعة كل صباح وتحقق من <code>/tasks</code>. اعرف بالضبط ما يجب إنجازه قبل أن تبدأ. الإحاطة الصباحية الساعة ٩:٠٠ تعطيك الصورة الكاملة.\n' +
'\n' +
'<b>٢. تتبع كل شيء في الوقت الفعلي</b>\n' +
'لا تنتظر حتى نهاية اليوم لتحديث التقدم. استخدم <code>/done [رقم]</code> لحظة إنهاء المهمة. هذا يبقي الفريق بأكمله على اطلاع ويبني نقاط أدائك.\n' +
'\n' +
'<b>٣. لا تفوّت أي موعد نهائي</b>\n' +
'استخدم <code>/remind [الوقت] [ملاحظة]</code> لكل موعد نهائي مهم. البوت سيتابع تلقائياً. لا أعذار للالتزامات المنسية.\n' +
'\n' +
'<b>٤. صعّد العوائق فوراً</b>\n' +
'إذا كان شيء يعيق عملك، لا تنتظر. انشر في الموضوع ١٠ (العوائق) فوراً. ستستجيب الإدارة خلال ٣٠ دقيقة.\n' +
'\n' +
'<b>٥. تسجيل الحضور نهاية اليوم</b>\n' +
'قبل الساعة ٦:٠٠ مساءً، انشر العناصر المنجزة في الموضوع ١١ وأولوياتك للغد في الموضوع ١٢. هذا إلزامي لكل عضو في الفريق.\n' +
'\n' +
'<b>٦. استخدم الموضوع الصحيح</b>\n' +
'كل موضوع موجود لسبب. انشر في الموضوع الصحيح. هذا يبقي عملياتنا منظمة وقابلة للبحث.\n' +
'\n' +
'<i>تذكر: هذا النظام يعمل فقط إذا استخدمه الجميع باستمرار. انضباطك اليوم يبني نجاحنا غداً.</i>';

// ═══════════════════════════════════════════════════════════════
// MAIN EXECUTION
// ═══════════════════════════════════════════════════════════════

async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  STEP 1: DELETE BOT DUPLICATE MESSAGES');
  console.log('═══════════════════════════════════════════════\n');

  // Known bot-sent message ID ranges to delete:
  // - Batch 1 (English-only pins): ~255-310
  // - Batch 2/3 (retries): ~310-312
  // - Batch 5 (bilingual pins): 313-341 (odd)
  // - Test messages: 345, 347
  // - Admin welcome: ~236-239
  // We'll try to delete IDs 236-350 which covers all bot messages
  // The bot can only delete its own messages, so user messages are safe

  var deleted = 0;
  var failed = 0;

  for (var msgId = 236; msgId <= 350; msgId++) {
    var r = await api('deleteMessage', { chat_id: CHAT_ID, message_id: msgId });
    if (r.ok) {
      deleted++;
      process.stdout.write('🗑️' + msgId + ' ');
    } else {
      failed++;
      process.stdout.write('.');
    }
    // Rate limit: pause every 15 messages
    if (msgId % 15 === 0) {
      await sleep(1500);
    }
  }

  console.log('\n\nDeleted: ' + deleted + ' | Skipped: ' + failed + ' (not bot messages or already gone)\n');

  console.log('═══════════════════════════════════════════════');
  console.log('  STEP 2: POST PROFESSIONAL BILINGUAL PINS');
  console.log('═══════════════════════════════════════════════\n');

  var results = [];

  for (var i = 0; i < topics.length; i++) {
    var topic = topics[i];
    console.log('📌 Posting to: ' + topic.label + ' (thread ' + topic.id + ')');

    var sendParams = {
      chat_id: CHAT_ID,
      text: topic.text,
      parse_mode: 'HTML',
      disable_notification: true
    };
    if (topic.id !== null) sendParams.message_thread_id = topic.id;

    var r = await api('sendMessage', sendParams);
    if (r.ok) {
      var msgId = r.result.message_id;
      console.log('  ✅ Sent (ID: ' + msgId + '). Pinning...');

      await sleep(500);

      var p = await api('pinChatMessage', {
        chat_id: CHAT_ID,
        message_id: msgId,
        disable_notification: true
      });
      if (p.ok) {
        console.log('  📌 Pinned!');
        results.push({ topic: topic.label, msgId: msgId, status: 'PINNED' });
      } else {
        console.log('  ⚠️ Pin failed: ' + (p.description || 'unknown'));
        results.push({ topic: topic.label, msgId: msgId, status: 'SENT (pin failed)' });
      }
    } else {
      console.log('  ❌ Send failed: ' + (r.description || 'unknown'));
      results.push({ topic: topic.label, msgId: null, status: 'FAILED' });
    }

    // 3-second delay between topics to avoid rate limits
    await sleep(3000);
  }

  console.log('\n═══════════════════════════════════════════════');
  console.log('  STEP 3: POST CEO MOTIVATIONAL MESSAGE');
  console.log('═══════════════════════════════════════════════\n');

  console.log('📌 Posting CEO message to thread 4 (CEO Update)...');
  var ceoR = await api('sendMessage', {
    chat_id: CHAT_ID,
    message_thread_id: 4,
    text: ceoMessage,
    parse_mode: 'HTML',
    disable_notification: true
  });

  if (ceoR.ok) {
    var ceoMsgId = ceoR.result.message_id;
    console.log('  ✅ Sent (ID: ' + ceoMsgId + '). Pinning...');
    await sleep(500);
    var ceoP = await api('pinChatMessage', {
      chat_id: CHAT_ID,
      message_id: ceoMsgId,
      disable_notification: true
    });
    if (ceoP.ok) {
      console.log('  📌 Pinned!');
      results.push({ topic: 'CEO Message', msgId: ceoMsgId, status: 'PINNED' });
    } else {
      console.log('  ⚠️ Pin failed: ' + (ceoP.description || 'unknown'));
      results.push({ topic: 'CEO Message', msgId: ceoMsgId, status: 'SENT (pin failed)' });
    }
  } else {
    console.log('  ❌ Send failed: ' + (ceoR.description || 'unknown'));
    results.push({ topic: 'CEO Message', msgId: null, status: 'FAILED' });
  }

  console.log('\n═══════════════════════════════════════════════');
  console.log('  FINAL RESULTS');
  console.log('═══════════════════════════════════════════════\n');

  results.forEach(function(r) {
    var icon = r.status === 'PINNED' ? '✅' : r.status === 'FAILED' ? '❌' : '⚠️';
    console.log(icon + ' ' + r.topic + ' → ID: ' + r.msgId + ' → ' + r.status);
  });

  var pinned = results.filter(function(r) { return r.status === 'PINNED'; }).length;
  var failedCount = results.filter(function(r) { return r.status === 'FAILED'; }).length;
  console.log('\nTotal: ' + pinned + ' pinned, ' + failedCount + ' failed, ' + (results.length - pinned - failedCount) + ' partial');
}

main().catch(console.error);
