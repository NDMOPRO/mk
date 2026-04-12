/**
 * REBUILD ALL — Complete group message rebuild from scratch
 * Posts ONE message per topic, pins it silently, verifies before moving on.
 * No bulk operations. No deletions. Quality over speed.
 */

const { Telegraf } = require("telegraf");

const TOKEN = "8729034252:AAFzfZIDrquCNjoI1lrZKVCh6x9iH9hZL84";
const CHAT_ID = -1003967447285;
const bot = new Telegraf(TOKEN);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function post(threadId, text) {
  const res = await bot.telegram.sendMessage(CHAT_ID, text, {
    parse_mode: "HTML",
    message_thread_id: threadId,
    disable_notification: true,
    disable_web_page_preview: true,
  });
  return res.message_id;
}

async function pin(msgId, threadId) {
  await bot.telegram.pinChatMessage(CHAT_ID, msgId, {
    disable_notification: true,
    message_thread_id: threadId,
  });
}

async function postAndPin(threadId, text, label) {
  console.log(`\n📌 Posting: ${label} (thread ${threadId})...`);
  const msgId = await post(threadId, text);
  console.log(`   ✅ Posted (ID: ${msgId})`);
  await sleep(1500);
  await pin(msgId, threadId);
  console.log(`   📌 Pinned`);
  await sleep(2000);
  return msgId;
}

// ============================================================
// MESSAGES
// ============================================================

const messages = [

// ── TOPIC 00 — Rules & Guide (thread 3) ──────────────────────
{
  thread: 3,
  label: "00 — Rules & Guide",
  text: `📋 <b>00 — RULES &amp; GUIDE | القواعد والدليل</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<b>🎯 Purpose | الهدف</b>
This is the official reference hub for the Monthly Key Daily Operations System. Every team member must read and follow these rules before using any topic.

<b>📐 Group Rules | قواعد المجموعة</b>
1️⃣ Post ONLY in the correct topic — wrong-topic messages will be moved
2️⃣ Use bot commands for all tasks, reminders, and reports
3️⃣ No personal conversations — this is a professional operations channel
4️⃣ Always tag the responsible person using @username
5️⃣ Update task status immediately when progress is made
6️⃣ Escalate blockers within 2 hours — do not sit on problems
7️⃣ End-of-day check-in is mandatory for all team members

<b>🤖 Quick Command Reference | مرجع الأوامر السريع</b>
<code>/task [description] @person</code> — Create a new task
<code>/tasks</code> — View all active tasks
<code>/done [task_id]</code> — Mark a task complete
<code>/remind [time] [message]</code> — Set a reminder
<code>/checklist</code> — View today's checklist
<code>/summary</code> — Get a daily summary
<code>/kpi</code> — View team KPI report
<code>/roles</code> — View all team roles

<b>⚠️ Zero Tolerance | لا تسامح</b>
• Missed deadlines without prior escalation
• Incomplete updates or ghost behavior
• Bypassing the system for informal communication

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>📋 القواعد والدليل — المرجع الرسمي</b>

<b>🎯 الهدف</b>
هذا هو المرجع الرسمي لنظام العمليات اليومية لمفتاح الشهر. يجب على كل عضو في الفريق قراءة هذه القواعد واتباعها قبل استخدام أي موضوع.

<b>📐 قواعد المجموعة</b>
1️⃣ النشر فقط في الموضوع الصحيح — الرسائل في المكان الخطأ ستُنقل
2️⃣ استخدام أوامر البوت لجميع المهام والتذكيرات والتقارير
3️⃣ لا محادثات شخصية — هذه قناة عمليات احترافية
4️⃣ دائمًا ضع علامة على الشخص المسؤول باستخدام @username
5️⃣ تحديث حالة المهمة فورًا عند إحراز تقدم
6️⃣ تصعيد العوائق خلال ساعتين — لا تتأخر في الإبلاغ
7️⃣ تسجيل الدخول في نهاية اليوم إلزامي لجميع أعضاء الفريق

<b>⚠️ لا تسامح مع</b>
• المواعيد النهائية الفائتة دون تصعيد مسبق
• التحديثات غير المكتملة أو التغيب عن الرد
• تجاوز النظام للتواصل غير الرسمي`
},

// ── TOPIC 01 — CEO Update (thread 4) ─────────────────────────
{
  thread: 4,
  label: "01 — CEO Update",
  text: `👑 <b>01 — CEO UPDATE | تحديث المدير التنفيذي</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<b>🎯 Purpose | الهدف</b>
This topic is the direct communication channel from the CEO to the entire operations team. All strategic directives, performance reviews, and company announcements are posted here.

<b>📌 What Belongs Here | ما يُنشر هنا</b>
• CEO announcements and strategic updates
• Weekly and monthly performance reviews
• Company-wide directives and policy changes
• Motivational messages and team recognition
• Critical escalations requiring CEO attention

<b>🚫 What Does NOT Belong Here | ما لا يُنشر هنا</b>
• Day-to-day operational updates (use Topic 02)
• Individual task updates (use the relevant topic)
• Personal messages or casual conversation

<b>🤖 Relevant Commands | الأوامر ذات الصلة</b>
<code>/kpi</code> — Full team KPI dashboard
<code>/performance @person</code> — Individual performance report
<code>/leaderboard</code> — Team performance ranking
<code>/monthlyreport</code> — Generate monthly operations report
<code>/summary</code> — Daily operations summary

<b>⏰ CEO Check-in Schedule | جدول تسجيل المدير التنفيذي</b>
🌅 Morning: Daily priorities and focus areas
🌆 Evening: End-of-day review and next-day prep

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>👑 تحديث المدير التنفيذي</b>

<b>🎯 الهدف</b>
هذا الموضوع هو قناة التواصل المباشر من المدير التنفيذي إلى فريق العمليات بأكمله. يُنشر هنا جميع التوجيهات الاستراتيجية ومراجعات الأداء وإعلانات الشركة.

<b>📌 ما يُنشر هنا</b>
• إعلانات المدير التنفيذي والتحديثات الاستراتيجية
• مراجعات الأداء الأسبوعية والشهرية
• التوجيهات والتغييرات في السياسات على مستوى الشركة
• رسائل تحفيزية وتقدير الفريق
• التصعيدات الحرجة التي تتطلب انتباه المدير التنفيذي`
},

// ── TOPIC 02 — Operations (thread 5) ─────────────────────────
{
  thread: 5,
  label: "02 — Operations",
  text: `🔧 <b>02 — OPERATIONS &amp; WORKFLOW | العمليات وسير العمل</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<b>🎯 Purpose | الهدف</b>
The engine room of Monthly Key. All day-to-day operational tasks, workflow updates, maintenance coordination, and team assignments are managed here.

<b>📌 What Belongs Here | ما يُنشر هنا</b>
• Daily operational task assignments and updates
• Maintenance requests and follow-ups
• Workflow coordination between departments
• Property readiness and handover updates
• Staff scheduling and shift coordination

<b>🤖 Key Commands | الأوامر الرئيسية</b>
<code>/task Fix AC in unit 5 @Saad</code> — Assign a maintenance task
<code>/task Prepare unit 12 for check-in @Ali</code> — Assign readiness task
<code>/tasks</code> — View all active operational tasks
<code>/done 42</code> — Mark task #42 as complete
<code>/checklist</code> — View today's operational checklist
<code>/remind 14:00 Follow up on unit 7 AC</code> — Set a reminder
<code>/recurring daily Check all units at 8am</code> — Set recurring task
<code>/handover @Ali Unit 5 keys and checklist</code> — Log a handover
<code>/workflow</code> — View current workflow status
<code>/sla</code> — Check SLA compliance status

<b>📊 Daily Routine | الروتين اليومي</b>
🌅 08:00 — Morning briefing and task assignment
🕐 13:00 — Midday progress check
🌆 18:00 — End-of-day update and handover log

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>🔧 العمليات وسير العمل</b>

<b>🎯 الهدف</b>
غرفة المحركات في مفتاح الشهر. تُدار هنا جميع المهام التشغيلية اليومية وتحديثات سير العمل وتنسيق الصيانة والتعيينات.

<b>📌 ما يُنشر هنا</b>
• تعيينات المهام التشغيلية اليومية وتحديثاتها
• طلبات الصيانة ومتابعتها
• تنسيق سير العمل بين الأقسام
• تحديثات جاهزية الوحدات وتسليمها
• جدولة الموظفين وتنسيق المناوبات`
},

// ── TOPIC 03 — Listings (thread 6) ───────────────────────────
{
  thread: 6,
  label: "03 — Listings & Inventory",
  text: `🏠 <b>03 — LISTINGS &amp; INVENTORY | العقارات والمخزون</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<b>🎯 Purpose | الهدف</b>
The master record of all Monthly Key properties. All listing updates, inventory changes, unit status, and property documentation are managed here.

<b>📌 What Belongs Here | ما يُنشر هنا</b>
• New property listings and updates
• Unit availability status changes
• Inventory additions and removals
• Property photos and documentation
• Pricing updates and seasonal adjustments

<b>🤖 Key Commands | الأوامر الرئيسية</b>
<code>/property list</code> — View all active listings
<code>/property add [name] [location] [price]</code> — Add new listing
<code>/property update [id] [field] [value]</code> — Update listing details
<code>/property status [id] available</code> — Mark unit as available
<code>/property status [id] occupied</code> — Mark unit as occupied
<code>/occupancy</code> — View current occupancy report
<code>/photos [unit_id]</code> — Submit property photos for approval
<code>/task Update listing photos for Villa 3 @Marketing</code> — Assign listing task

<b>📊 Inventory Standards | معايير المخزون</b>
• All units must have updated photos every 30 days
• Pricing must be reviewed every 2 weeks
• Availability status must be updated within 1 hour of change
• All new listings require CEO approval before going live

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>🏠 العقارات والمخزون</b>

<b>🎯 الهدف</b>
السجل الرئيسي لجميع عقارات مفتاح الشهر. تُدار هنا جميع تحديثات القوائم وتغييرات المخزون وحالة الوحدات وتوثيق العقارات.

<b>📌 ما يُنشر هنا</b>
• قوائم العقارات الجديدة وتحديثاتها
• تغييرات حالة توفر الوحدات
• إضافات المخزون وإزالاته
• صور العقارات والتوثيق
• تحديثات الأسعار والتعديلات الموسمية`
},

// ── TOPIC 04 — Bookings & Revenue (thread 7) ─────────────────
{
  thread: 7,
  label: "04 — Bookings & Revenue",
  text: `💰 <b>04 — BOOKINGS &amp; REVENUE | الحجوزات والإيرادات</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<b>🎯 Purpose | الهدف</b>
The financial heartbeat of Monthly Key. All bookings, revenue tracking, payment confirmations, and financial performance metrics are recorded here.

<b>📌 What Belongs Here | ما يُنشر هنا</b>
• New booking confirmations and details
• Check-in and check-out records
• Revenue reports and financial summaries
• Booking modifications and cancellations
• Occupancy rate tracking

<b>🤖 Key Commands | الأوامر الرئيسية</b>
<code>/book [unit] [guest] [dates]</code> — Log a new booking
<code>/mybookings</code> — View active bookings
<code>/occupancy</code> — Current occupancy and revenue report
<code>/monthlyreport</code> — Full monthly revenue breakdown
<code>/expense [amount] [category] [description]</code> — Log an expense
<code>/expenses</code> — View expense report
<code>/kpi</code> — Revenue KPIs and targets
<code>/trends</code> — Booking trends and forecasts

<b>📊 Revenue Targets | أهداف الإيرادات</b>
• Daily revenue updates by 20:00 KSA
• Weekly revenue summary every Sunday
• Monthly financial close by the 3rd of each month
• All discounts above 10% require CEO approval

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>💰 الحجوزات والإيرادات</b>

<b>🎯 الهدف</b>
النبضة المالية لمفتاح الشهر. يُسجَّل هنا جميع الحجوزات وتتبع الإيرادات وتأكيدات الدفع ومقاييس الأداء المالي.

<b>📌 ما يُنشر هنا</b>
• تأكيدات الحجوزات الجديدة وتفاصيلها
• سجلات تسجيل الوصول والمغادرة
• تقارير الإيرادات والملخصات المالية
• تعديلات الحجوزات وإلغاؤها
• تتبع معدل الإشغال`
},

// ── TOPIC 05 — Customer Support (thread 8) ───────────────────
{
  thread: 8,
  label: "05 — Customer Support",
  text: `🎧 <b>05 — CUSTOMER SUPPORT | دعم العملاء</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<b>🎯 Purpose | الهدف</b>
Guest happiness is our top priority. All customer complaints, requests, feedback, and support tickets are tracked and resolved here. Every guest issue must be acknowledged within 30 minutes and resolved within 4 hours.

<b>📌 What Belongs Here | ما يُنشر هنا</b>
• Guest complaints and resolution tracking
• Service requests from current guests
• Positive feedback and reviews
• Escalated issues requiring management attention
• Follow-up confirmations after issue resolution

<b>🤖 Key Commands | الأوامر الرئيسية</b>
<code>/task Guest complaint: No hot water in Unit 8 @Saad #urgent</code> — Log urgent complaint
<code>/task Follow up with guest in Unit 3 about WiFi @Ali</code> — Log follow-up task
<code>/remind 30min Check resolution status for Unit 8 complaint</code> — Set follow-up reminder
<code>/done 55</code> — Mark complaint as resolved
<code>/summary</code> — Daily support summary
<code>/sla</code> — Check response time SLA compliance

<b>⏱️ Response SLA | معيار وقت الاستجابة</b>
🔴 Urgent (safety/security): 15 minutes
🟡 High (comfort/amenities): 30 minutes
🟢 Normal (requests/feedback): 2 hours

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>🎧 دعم العملاء</b>

<b>🎯 الهدف</b>
سعادة الضيوف هي أولويتنا القصوى. يُتتبع هنا جميع شكاوى العملاء وطلباتهم وملاحظاتهم وتذاكر الدعم ويتم حلها. يجب الإقرار بكل مشكلة ضيف خلال 30 دقيقة وحلها خلال 4 ساعات.

<b>📌 ما يُنشر هنا</b>
• شكاوى الضيوف وتتبع الحل
• طلبات الخدمة من الضيوف الحاليين
• التعليقات والمراجعات الإيجابية
• المشكلات المصعّدة التي تتطلب انتباه الإدارة
• تأكيدات المتابعة بعد حل المشكلة`
},

// ── TOPIC 06 — Tech Issues (thread 9) ────────────────────────
{
  thread: 9,
  label: "06 — Tech Issues",
  text: `💻 <b>06 — TECH ISSUES | المشاكل التقنية</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<b>🎯 Purpose | الهدف</b>
All technology-related issues, system bugs, software problems, and IT requests are tracked here. No tech problem should go unresolved for more than 24 hours.

<b>📌 What Belongs Here | ما يُنشر هنا</b>
• System bugs and software errors
• Internet and connectivity issues
• Smart home device malfunctions
• Bot command errors or unexpected behavior
• IT infrastructure requests
• App and platform technical issues

<b>🤖 Key Commands | الأوامر الرئيسية</b>
<code>/task WiFi router in Unit 12 not working @IT</code> — Log tech issue
<code>/task Smart lock on Unit 5 door not responding @Maintenance</code> — Log device issue
<code>/task Bot not responding to /checklist command @Admin</code> — Log bot issue
<code>/remind 2h Check if Unit 12 WiFi is restored</code> — Set resolution reminder
<code>/verify</code> — Run system health check
<code>/audit</code> — View system audit log
<code>/tasks</code> — View all open tech tickets

<b>🔧 Tech Escalation Path | مسار تصعيد التقنية</b>
Level 1: Team member reports issue here
Level 2: Tech lead assigned within 1 hour
Level 3: External vendor contacted within 4 hours
Level 4: CEO notified if unresolved after 24 hours

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>💻 المشاكل التقنية</b>

<b>🎯 الهدف</b>
يُتتبع هنا جميع المشكلات المتعلقة بالتكنولوجيا وأخطاء النظام ومشكلات البرامج وطلبات تقنية المعلومات. لا ينبغي أن تبقى أي مشكلة تقنية دون حل لأكثر من 24 ساعة.

<b>📌 ما يُنشر هنا</b>
• أخطاء النظام ومشكلات البرامج
• مشكلات الإنترنت والاتصال
• أعطال أجهزة المنزل الذكي
• أخطاء أوامر البوت أو السلوك غير المتوقع
• طلبات البنية التحتية لتقنية المعلومات`
},

// ── TOPIC 07 — Payments & Finance (thread 10) ────────────────
{
  thread: 10,
  label: "07 — Payments & Finance",
  text: `🏦 <b>07 — PAYMENTS &amp; FINANCE | المدفوعات والمالية</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<b>🎯 Purpose | الهدف</b>
The official financial ledger for Monthly Key operations. All payment confirmations, expense approvals, vendor invoices, and financial reconciliations are recorded here.

<b>📌 What Belongs Here | ما يُنشر هنا</b>
• Payment confirmations (received and sent)
• Expense approvals and reimbursements
• Vendor and supplier invoices
• Salary and payroll updates
• Financial discrepancies and investigations
• Budget tracking and alerts

<b>🤖 Key Commands | الأوامر الرئيسية</b>
<code>/expense 450 maintenance AC repair in Unit 5</code> — Log an expense
<code>/expense 1200 vendor Cleaning company invoice #INV-2026-04</code> — Log vendor expense
<code>/expenses</code> — View all logged expenses
<code>/approve 23</code> — Approve expense request #23
<code>/reject 24 Exceeds budget limit</code> — Reject with reason
<code>/monthlyreport</code> — Full financial monthly report
<code>/kpi</code> — Financial KPIs and budget vs. actual

<b>🔒 Financial Rules | القواعد المالية</b>
• All expenses above SAR 500 require manager approval
• All expenses above SAR 2,000 require CEO approval
• Receipts must be attached for all expenses above SAR 100
• Payroll is processed on the 28th of each month

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>🏦 المدفوعات والمالية</b>

<b>🎯 الهدف</b>
دفتر الأستاذ المالي الرسمي لعمليات مفتاح الشهر. يُسجَّل هنا جميع تأكيدات الدفع وموافقات النفقات وفواتير البائعين والتسويات المالية.

<b>📌 ما يُنشر هنا</b>
• تأكيدات الدفع (المستلمة والمرسلة)
• موافقات النفقات والتعويضات
• فواتير البائعين والموردين
• تحديثات الرواتب وكشوف المرتبات
• التناقضات المالية والتحقيقات`
},

// ── TOPIC 08 — Marketing (thread 11) ─────────────────────────
{
  thread: 11,
  label: "08 — Marketing & Content",
  text: `📣 <b>08 — MARKETING &amp; CONTENT | التسويق والمحتوى</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<b>🎯 Purpose | الهدف</b>
Growing the Monthly Key brand. All marketing campaigns, content creation, social media coordination, lead generation, and promotional activities are managed here.

<b>📌 What Belongs Here | ما يُنشر هنا</b>
• Marketing campaign plans and updates
• Social media content and scheduling
• Lead generation activities and results
• Photography and videography requests
• Promotional offers and pricing strategies
• Brand partnerships and collaborations

<b>🤖 Key Commands | الأوامر الرئيسية</b>
<code>/task Create Instagram post for Villa 3 @Marketing</code> — Assign content task
<code>/task Follow up with 5 leads from Airbnb @Sales</code> — Assign lead task
<code>/task Update property photos for Unit 8 @Photographer</code> — Assign photo task
<code>/photos [unit_id]</code> — Submit photos for review and approval
<code>/ideas</code> — View submitted marketing ideas
<code>/idea Launch Ramadan special offer 20% off</code> — Submit a marketing idea
<code>/brainstorm Marketing ideas for Q2</code> — Start a brainstorming session
<code>/trends</code> — View booking and market trends
<code>/poll "Best promotional channel?" "Instagram" "TikTok" "WhatsApp"</code> — Create team poll

<b>📊 Marketing KPIs | مؤشرات التسويق</b>
• Weekly content calendar due every Sunday
• Monthly lead report due on the 1st
• All promotional offers require CEO approval
• Photo updates for all units every 30 days

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>📣 التسويق والمحتوى</b>

<b>🎯 الهدف</b>
تنمية علامة مفتاح الشهر التجارية. تُدار هنا جميع حملات التسويق وإنشاء المحتوى وتنسيق وسائل التواصل الاجتماعي وتوليد العملاء المحتملين والأنشطة الترويجية.

<b>📌 ما يُنشر هنا</b>
• خطط الحملات التسويقية وتحديثاتها
• محتوى وسائل التواصل الاجتماعي وجدولته
• أنشطة توليد العملاء المحتملين ونتائجها
• طلبات التصوير الفوتوغرافي والفيديو`
},

// ── TOPIC 09 — Legal & Compliance (thread 12) ────────────────
{
  thread: 12,
  label: "09 — Legal & Compliance",
  text: `⚖️ <b>09 — LEGAL &amp; COMPLIANCE | القانونية والامتثال</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<b>🎯 Purpose | الهدف</b>
Protecting Monthly Key legally and operationally. All contracts, regulatory compliance, licensing, legal disputes, and documentation requirements are tracked here.

<b>📌 What Belongs Here | ما يُنشر هنا</b>
• Contract reviews and approvals
• Regulatory compliance updates
• License renewals and government filings
• Legal disputes and case tracking
• Insurance documentation
• Tenant/guest agreement issues

<b>🤖 Key Commands | الأوامر الرئيسية</b>
<code>/task Renew Airbnb operating license by April 30 @Legal</code> — Log compliance task
<code>/task Review new lease agreement for Villa 5 @Legal</code> — Assign legal review
<code>/task Submit monthly municipality report @Admin</code> — Log regulatory task
<code>/remind 7d License renewal deadline approaching</code> — Set compliance reminder
<code>/verify</code> — Run compliance verification check
<code>/audit</code> — View full compliance audit log
<code>/approve 31</code> — Approve a legal document

<b>📋 Compliance Calendar | تقويم الامتثال</b>
• Municipality reports: Monthly by the 5th
• License renewals: 30 days before expiry
• Insurance reviews: Quarterly
• Contract audits: Every 6 months

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>⚖️ القانونية والامتثال</b>

<b>🎯 الهدف</b>
حماية مفتاح الشهر قانونيًا وتشغيليًا. يُتتبع هنا جميع العقود والامتثال التنظيمي والترخيص والنزاعات القانونية ومتطلبات التوثيق.

<b>📌 ما يُنشر هنا</b>
• مراجعات العقود وموافقاتها
• تحديثات الامتثال التنظيمي
• تجديدات التراخيص والإيداعات الحكومية
• النزاعات القانونية وتتبع القضايا
• توثيق التأمين`
},

// ── TOPIC 10 — Blockers & Escalation (thread 13) ─────────────
{
  thread: 13,
  label: "10 — Blockers & Escalation",
  text: `🚨 <b>10 — BLOCKERS &amp; ESCALATION | العوائق والتصعيد</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<b>🎯 Purpose | الهدف</b>
EMERGENCY CHANNEL. If something is blocking your work, preventing a task from being completed, or requires immediate management intervention — post it HERE immediately. Speed is everything in this topic.

<b>📌 What Belongs Here | ما يُنشر هنا</b>
• Blockers preventing task completion
• Urgent issues requiring immediate management decision
• Vendor or supplier failures
• Safety and security incidents
• System outages affecting operations
• Situations where a team member is stuck and needs help

<b>🤖 Key Commands | الأوامر الرئيسية</b>
<code>/task URGENT: Water leak in Unit 3 — guest affected @Maintenance @Manager</code>
<code>/task BLOCKER: Supplier hasn't delivered cleaning supplies @Procurement</code>
<code>/remind 1h Follow up on Unit 3 water leak resolution</code>
<code>/summary</code> — Get current blocker summary
<code>/sla</code> — Check SLA breach status

<b>⏱️ Escalation Rules | قواعد التصعيد</b>
🔴 <b>CRITICAL</b> (safety/guest impact): Escalate immediately — tag @CEO
🟡 <b>HIGH</b> (operational blocker): Escalate within 1 hour
🟢 <b>MEDIUM</b> (delay risk): Escalate within 2 hours
• ALL blockers must be acknowledged within 15 minutes
• Resolution plan must be posted within 30 minutes of escalation

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>🚨 العوائق والتصعيد</b>

<b>🎯 الهدف</b>
قناة الطوارئ. إذا كان هناك شيء يعيق عملك أو يمنع إتمام مهمة أو يتطلب تدخلًا فوريًا من الإدارة — انشر هنا فورًا. السرعة هي كل شيء في هذا الموضوع.

<b>📌 ما يُنشر هنا</b>
• العوائق التي تمنع إتمام المهام
• المشكلات العاجلة التي تتطلب قرارًا فوريًا من الإدارة
• إخفاقات البائعين أو الموردين
• حوادث السلامة والأمن
• انقطاع الخدمات التي تؤثر على العمليات`
},

// ── TOPIC 11 — Completed Today (thread 14) ───────────────────
{
  thread: 14,
  label: "11 — Completed Today",
  text: `✅ <b>11 — COMPLETED TODAY | المنجز اليوم</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<b>🎯 Purpose | الهدف</b>
The Wall of Achievement. Every completed task, resolved issue, and closed ticket gets logged here. This is the team's daily record of wins — it feeds directly into KPI reports and performance reviews.

<b>📌 What Belongs Here | ما يُنشر هنا</b>
• Completed task confirmations (use /done command)
• Resolved customer complaints
• Closed maintenance tickets
• Finished projects and milestones
• End-of-day accomplishment summaries

<b>🤖 Key Commands | الأوامر الرئيسية</b>
<code>/done 42</code> — Mark task #42 as complete (auto-logs here)
<code>/done 42 Fixed AC compressor and refilled gas</code> — Mark done with notes
<code>/summary</code> — View today's completion summary
<code>/kpi</code> — See how completions affect your KPI score
<code>/leaderboard</code> — See who completed the most tasks today
<code>/checklist</code> — View remaining tasks for today

<b>📊 Completion Standards | معايير الإنجاز</b>
• Every /done must include a brief completion note
• Photo evidence required for maintenance completions
• Guest-related completions must include guest satisfaction confirmation
• End-of-day: All team members must log their daily summary by 20:00 KSA

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>✅ المنجز اليوم</b>

<b>🎯 الهدف</b>
جدار الإنجازات. كل مهمة مكتملة ومشكلة محلولة وتذكرة مغلقة تُسجَّل هنا. هذا هو سجل الفريق اليومي للإنجازات — يُغذي مباشرة تقارير مؤشرات الأداء ومراجعات الأداء.

<b>📌 ما يُنشر هنا</b>
• تأكيدات المهام المكتملة (استخدم أمر /done)
• شكاوى العملاء المحلولة
• تذاكر الصيانة المغلقة
• المشاريع والمعالم المنتهية
• ملخصات إنجازات نهاية اليوم`
},

// ── TOPIC 12 — Priorities (thread 15) ────────────────────────
{
  thread: 15,
  label: "12 — Tomorrow's Priorities",
  text: `📌 <b>12 — TOMORROW'S PRIORITIES | أولويات الغد</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<b>🎯 Purpose | الهدف</b>
Plan today to win tomorrow. Every evening, team leaders and managers post their top priorities for the next day. This ensures the team wakes up with a clear mission and no time is wasted on planning in the morning.

<b>📌 What Belongs Here | ما يُنشر هنا</b>
• Tomorrow's top 3-5 priorities per department
• Scheduled meetings and appointments
• Deadlines falling due tomorrow
• Resources or approvals needed in advance
• Pre-assigned tasks for the morning shift

<b>🤖 Key Commands | الأوامر الرئيسية</b>
<code>/task Tomorrow: Follow up with Mobily internet company @Mushtaq</code>
<code>/task Tomorrow: Prepare Unit 7 for new guest check-in @Ali</code>
<code>/remind 08:00 Morning briefing — check priorities</code>
<code>/meeting Tomorrow 10:00 Weekly ops review @AllTeam</code>
<code>/checklist</code> — View tomorrow's pre-set checklist
<code>/tasks</code> — View all upcoming tasks

<b>⏰ Priority Posting Schedule | جدول نشر الأولويات</b>
• Post tomorrow's priorities by 20:00 KSA tonight
• Morning review of priorities at 08:00 KSA
• All priorities must have an assigned owner (@person)
• Unassigned priorities will be auto-escalated to manager

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>📌 أولويات الغد</b>

<b>🎯 الهدف</b>
خطط اليوم لتفوز بالغد. كل مساء، يُنشر قادة الفريق والمديرون أهم أولوياتهم لليوم التالي. هذا يضمن استيقاظ الفريق بمهمة واضحة وعدم إضاعة الوقت في التخطيط صباحًا.

<b>📌 ما يُنشر هنا</b>
• أهم 3-5 أولويات لكل قسم ليوم الغد
• الاجتماعات والمواعيد المجدولة
• المواعيد النهائية الحالة غدًا
• الموارد أو الموافقات المطلوبة مسبقًا`
},

// ── TOPIC 15 — Admin Panel (thread 235) ──────────────────────
{
  thread: 235,
  label: "15 — Admin Panel",
  text: `🔐 <b>15 — ADMIN PANEL | لوحة الإدارة</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<b>🎯 Purpose | الهدف</b>
System configuration and administration. This topic is restricted to system administrators and the CEO only. All bot configuration, role management, system health monitoring, and administrative actions are performed here.

<b>🔒 Access Level | مستوى الوصول</b>
⚠️ RESTRICTED — Administrators and CEO only
Unauthorized use of admin commands will be logged and reviewed.

<b>🤖 Admin Commands | أوامر الإدارة</b>
<code>/setrole @Mushtaq operational_manager</code> — Assign a role
<code>/roles</code> — View all team roles and permissions
<code>/audit</code> — View full system audit log
<code>/team</code> — View all registered team members
<code>/clean</code> — Clean up old bot messages
<code>/onboarding @NewMember</code> — Start onboarding for new member
<code>/verify</code> — Run system health verification
<code>/gsync</code> — Sync data to Google Sheets
<code>/mlog</code> — View maintenance log
<code>/workflow</code> — Configure workflow automation
<code>/template</code> — Manage message templates
<code>/broadcast [message]</code> — Send message to all team members
<code>/stats</code> — View system usage statistics

<b>📊 Admin Responsibilities | مسؤوليات الإدارة</b>
• Weekly system health check every Monday
• Role review and updates monthly
• Data backup verification weekly
• New member onboarding within 24 hours of joining

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>🔐 لوحة الإدارة</b>

<b>🎯 الهدف</b>
تكوين النظام والإدارة. هذا الموضوع مقيد لمسؤولي النظام والمدير التنفيذي فقط. يتم هنا تكوين البوت وإدارة الأدوار ومراقبة صحة النظام وجميع الإجراءات الإدارية.

<b>🔒 مستوى الوصول</b>
⚠️ مقيد — المسؤولون والمدير التنفيذي فقط
سيتم تسجيل الاستخدام غير المصرح به لأوامر الإدارة ومراجعته.`
},

];

// ── CEO DAILY PROTOCOL (thread 4) ────────────────────────────
const ceoProtocol = {
  thread: 4,
  label: "CEO Daily Protocol",
  text: `👑 <b>THE MONTHLY KEY DAILY PROTOCOL | البروتوكول اليومي لمفتاح الشهر</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<i>A message from the CEO to every member of the Monthly Key team.</i>

Excellence is not an accident — it is a daily discipline. This system was built so that every one of us operates at the highest level, every single day. Follow this protocol without exception.

<b>🌅 MORNING LAUNCH (08:00 KSA)</b>
1️⃣ Open this group and review today's priorities in Topic 12
2️⃣ Run <code>/checklist</code> — know your tasks before you start
3️⃣ Run <code>/tasks</code> — see everything assigned to you
4️⃣ Acknowledge your tasks — reply or update status immediately
5️⃣ If anything is unclear, ask NOW — not at 5pm

<b>⚡ REAL-TIME EXECUTION (All Day)</b>
6️⃣ Update task progress as it happens — not at the end of the day
7️⃣ Use <code>/done [task_id]</code> the moment a task is complete
8️⃣ If you hit a blocker, post in Topic 10 IMMEDIATELY — do not wait
9️⃣ Use <code>/remind</code> for every deadline — never rely on memory
🔟 Tag the right person for every task — accountability is non-negotiable

<b>🌆 EVENING CLOSE (19:00–20:00 KSA)</b>
1️⃣1️⃣ Post your end-of-day update in the relevant topic
1️⃣2️⃣ Log tomorrow's top priorities in Topic 12
1️⃣3️⃣ Run <code>/summary</code> — review what was accomplished
1️⃣4️⃣ Escalate anything unresolved before you log off
1️⃣5️⃣ Never leave a task open without a status update

<b>📊 WEEKLY ACCOUNTABILITY</b>
• Every Sunday: Review your <code>/kpi</code> score
• Every Sunday: Check the <code>/leaderboard</code>
• Monthly: Full performance review with the CEO

<i>This system is your partner. Use it fully and it will make you exceptional. Ignore it and you will fall behind. The choice is yours — but the standard is mine.</i>

— <b>CEO, Monthly Key</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>👑 البروتوكول اليومي لمفتاح الشهر</b>

<i>رسالة من المدير التنفيذي إلى كل عضو في فريق مفتاح الشهر.</i>

التميز ليس صدفة — إنه انضباط يومي. بُني هذا النظام لكي يعمل كل واحد منا على أعلى مستوى، كل يوم. اتبع هذا البروتوكول دون استثناء.

<b>🌅 الإطلاق الصباحي (08:00 بتوقيت السعودية)</b>
1️⃣ افتح هذه المجموعة وراجع أولويات اليوم في الموضوع 12
2️⃣ شغّل <code>/checklist</code> — اعرف مهامك قبل أن تبدأ
3️⃣ شغّل <code>/tasks</code> — اطلع على كل ما هو مسند إليك
4️⃣ أقرّ بمهامك — رد أو حدّث الحالة فورًا
5️⃣ إذا كان أي شيء غير واضح، اسأل الآن — ليس في الساعة الخامسة مساءً

<b>⚡ التنفيذ الفوري (طوال اليوم)</b>
6️⃣ حدّث تقدم المهام فور حدوثه — ليس في نهاية اليوم
7️⃣ استخدم <code>/done [task_id]</code> في اللحظة التي تكتمل فيها المهمة
8️⃣ إذا واجهت عائقًا، انشر في الموضوع 10 فورًا — لا تنتظر
9️⃣ استخدم <code>/remind</code> لكل موعد نهائي — لا تعتمد على الذاكرة
🔟 ضع علامة على الشخص المناسب لكل مهمة — المساءلة غير قابلة للتفاوض

<b>🌆 الإغلاق المسائي (19:00–20:00 بتوقيت السعودية)</b>
1️⃣1️⃣ انشر تحديث نهاية اليوم في الموضوع المعني
1️⃣2️⃣ سجّل أهم أولويات الغد في الموضوع 12
1️⃣3️⃣ شغّل <code>/summary</code> — راجع ما تم إنجازه
1️⃣4️⃣ صعّد أي شيء غير محلول قبل تسجيل الخروج
1️⃣5️⃣ لا تترك مهمة مفتوحة دون تحديث للحالة

<i>هذا النظام هو شريكك. استخدمه بالكامل وسيجعلك استثنائيًا. تجاهله وستتأخر. الاختيار لك — لكن المعيار لي.</i>

— <b>المدير التنفيذي، مفتاح الشهر</b>`
};

// ── CEO TASK ASSIGNMENT — Marketing (thread 11) ───────────────
const ceoTask = {
  thread: 11,
  label: "CEO Task Assignment — Riyadh DB",
  text: `📋 <b>CEO TASK ASSIGNMENT | تكليف من المدير التنفيذي</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<b>Task Ref:</b> <code>MKT-2026-001</code>
<b>Assigned To:</b> Mushtaq Ibn Muhammad — Operational Manager
<b>Assigned By:</b> CEO, Monthly Key
<b>Date Assigned:</b> April 12, 2026
<b>Deadline:</b> 🗓️ <b>April 19, 2026</b>
<b>Priority:</b> 🔴 HIGH

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<b>📌 Task: Build Riyadh Company Database for Direct Marketing</b>

Mushtaq, I need you to compile a complete, verified database of companies in Riyadh for our future direct marketing campaigns. This will be a strategic asset for Monthly Key.

<b>📊 Required Data Fields (per company):</b>
1. Company Name
2. Industry / Category
3. Contact Person (if available)
4. Phone Number
5. WhatsApp Number (if available)
6. Email Address
7. Website
8. Office Location in Riyadh
9. Source of Information

<b>📂 Approved Sources:</b>
✅ Al Qasim Real Estate source
✅ Public business directories and trusted online sources
✅ Approved business contacts we already have access to

<b>⚠️ Important Rules:</b>
🚫 Do NOT use private or unverified personal contacts
🚫 Do NOT add fake, missing, or guessed data
🚫 Every entry must be verified before inclusion
✅ Organize the database in a spreadsheet format
✅ Submit progress update every 2 days

<b>📤 Deliverable:</b>
A clean, organized spreadsheet with all company data — submitted to the CEO by April 19, 2026.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<b>📋 تكليف من المدير التنفيذي</b>

<b>رقم المهمة:</b> <code>MKT-2026-001</code>
<b>مُكلَّف إلى:</b> مشتاق ابن محمد — مدير العمليات
<b>مُكلَّف من:</b> المدير التنفيذي، مفتاح الشهر
<b>تاريخ التكليف:</b> 12 أبريل 2026
<b>الموعد النهائي:</b> 🗓️ <b>19 أبريل 2026</b>
<b>الأولوية:</b> 🔴 عالية

<b>📌 المهمة: بناء قاعدة بيانات شركات الرياض للتسويق المباشر</b>

مشتاق، أحتاج منك تجميع قاعدة بيانات كاملة وموثقة للشركات في الرياض لحملاتنا التسويقية المباشرة المستقبلية. ستكون هذه أصلًا استراتيجيًا لمفتاح الشهر.

<b>📊 حقول البيانات المطلوبة (لكل شركة):</b>
1. اسم الشركة
2. القطاع / الفئة
3. شخص الاتصال (إن توفر)
4. رقم الهاتف
5. رقم واتساب (إن توفر)
6. البريد الإلكتروني
7. الموقع الإلكتروني
8. موقع المكتب في الرياض
9. مصدر المعلومات

<b>📂 المصادر المعتمدة:</b>
✅ مصدر العقارات القاسمي
✅ الدلائل التجارية العامة والمصادر الإلكترونية الموثوقة
✅ جهات الاتصال التجارية المعتمدة التي لدينا إمكانية الوصول إليها

<b>⚠️ قواعد مهمة:</b>
🚫 لا تستخدم جهات اتصال شخصية خاصة أو غير موثقة
🚫 لا تضف بيانات مزيفة أو ناقصة أو مخمنة
✅ نظّم قاعدة البيانات بتنسيق جدول بيانات
✅ قدّم تحديث تقدم كل يومين`
};

// ── MUSHTAQ FIELD REPORT — Blockers (thread 13) ───────────────
const mushtaqBlockers = {
  thread: 13,
  label: "Mushtaq Field Report — Blockers",
  text: `📋 <b>FIELD REPORT RECEIVED | تم استلام التقرير الميداني</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<b>Submitted by:</b> Mushtaq Ibn Muhammad — Operational Manager
<b>Date:</b> April 11, 2026 | 4:40 PM
<b>Logged by:</b> Monthly Key Operations Bot

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<b>🔧 Issue #1 — AC Maintenance</b>
<b>Status:</b> ✅ <b>RESOLVED</b>

<b>Report from Operational Manager:</b>
AC units were not functioning in several areas. Mushtaq personally conducted an inspection and requested the maintenance team. Upon their visit and equipment check, the following faults were identified and repaired:
• Kitchen compressor was not working → <b>Replaced</b>
• Gas levels were insufficient in several AC units → <b>Refilled</b>
• Internal components required cleaning → <b>Cleaned</b>

All AC units are now fully operational. Issue resolved by Mushtaq and the maintenance team.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<b>🌐 Issue #2 — Internet / Uniform Building Access Setup</b>
<b>Status:</b> 🟡 <b>IN PROGRESS</b>

<b>Report from Operational Manager:</b>
Mushtaq has been following up with multiple internet companies regarding the setup of uniform access infrastructure in the building. Several companies visited and inspected the site last week but have not yet delivered a proposal or returned despite follow-up. Two companies are scheduled to visit tomorrow for further assessment.

<b>Next Action (Assigned to Mushtaq):</b>
Follow up with both companies after tomorrow's visit and report outcome.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<b>📋 تقرير ميداني من مدير العمليات</b>

<b>مُقدَّم من:</b> مشتاق ابن محمد — مدير العمليات
<b>التاريخ:</b> 11 أبريل 2026 | 4:40 مساءً

<b>🔧 المشكلة #1 — صيانة التكييف</b>
<b>الحالة:</b> ✅ <b>تم الحل</b>

أجرى مشتاق فحصًا شخصيًا وطلب فريق الصيانة. تم اكتشاف الأعطال التالية وإصلاحها:
• ضاغط المطبخ لا يعمل → <b>تم الاستبدال</b>
• مستويات الغاز غير كافية في بعض وحدات التكييف → <b>تم الإعادة</b>
• المكونات الداخلية تحتاج تنظيفًا → <b>تم التنظيف</b>

جميع وحدات التكييف تعمل الآن بشكل كامل.

<b>🌐 المشكلة #2 — إعداد الإنترنت / الوصول الموحد للمبنى</b>
<b>الحالة:</b> 🟡 <b>قيد التنفيذ</b>

يتابع مشتاق مع عدة شركات إنترنت بشأن إعداد بنية الوصول الموحد في المبنى. زارت عدة شركات الموقع الأسبوع الماضي لكنها لم تقدم عرضًا بعد. شركتان مقررتان للزيارة غدًا.`
};

// ── MUSHTAQ PRIORITIES REPORT — Priorities (thread 15) ────────
const mushtaqPriorities = {
  thread: 15,
  label: "Mushtaq Priorities — Tomorrow",
  text: `📌 <b>MANAGER PRIORITIES LOGGED | تسجيل أولويات مدير العمليات</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<b>Submitted by:</b> Mushtaq Ibn Muhammad — Operational Manager
<b>Date:</b> April 11, 2026 | 5:57 PM – 6:39 PM
<b>Logged by:</b> Monthly Key Operations Bot

These priorities were reported by the Operational Manager for action. All items are assigned to Mushtaq for execution and follow-up.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<b>Priority #1 — Meeting with Mobily Internet Company</b>
<b>Status:</b> 🔵 <b>SCHEDULED</b>
<b>Assigned to:</b> Mushtaq Ibn Muhammad
<b>Context:</b> Follow-up meeting as part of the building internet / uniform access setup initiative. Mobily is one of the companies being evaluated for the project.
<b>Action:</b> Attend meeting, collect proposal, report outcome in Topic 10 (Blockers).

<b>Priority #2 — Retrieve 3 TVs from Company</b>
<b>Status:</b> 🟡 <b>PENDING</b>
<b>Assigned to:</b> Mushtaq Ibn Muhammad
<b>Action:</b> Coordinate collection and confirm delivery to the correct units.

<b>Priority #3 — Staff Training</b>
<b>Status:</b> 🟡 <b>TO BE SCHEDULED</b>
<b>Assigned to:</b> Mushtaq Ibn Muhammad
<b>Action:</b> Define training topic, schedule date/time, and notify all relevant staff members.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<b>📌 أولويات مدير العمليات المسجلة</b>

<b>مُقدَّمة من:</b> مشتاق ابن محمد — مدير العمليات
<b>التاريخ:</b> 11 أبريل 2026

جميع الأولويات التالية أُبلغ عنها من قِبل مدير العمليات وهي مُسنَدة إليه للتنفيذ والمتابعة.

<b>الأولوية #1 — اجتماع مع شركة موبايلي للإنترنت</b>
<b>الحالة:</b> 🔵 <b>مجدول</b>
<b>مُسنَد إلى:</b> مشتاق ابن محمد
<b>الإجراء:</b> حضور الاجتماع وجمع العرض والإبلاغ عن النتيجة في الموضوع 10.

<b>الأولوية #2 — استلام 3 تلفزيونات من الشركة</b>
<b>الحالة:</b> 🟡 <b>معلق</b>
<b>مُسنَد إلى:</b> مشتاق ابن محمد
<b>الإجراء:</b> تنسيق الاستلام وتأكيد التسليم للوحدات الصحيحة.

<b>الأولوية #3 — تدريب الموظفين</b>
<b>الحالة:</b> 🟡 <b>في انتظار الجدولة</b>
<b>مُسنَد إلى:</b> مشتاق ابن محمد
<b>الإجراء:</b> تحديد موضوع التدريب وجدولة التاريخ والوقت وإخطار جميع الموظفين المعنيين.`
};

// ── 49-FEATURE GUIDE (thread 3) ───────────────────────────────
const featureGuide = {
  thread: 3,
  label: "49-Feature Master Guide",
  text: `📘 <b>MONTHLY KEY | MASTER FEATURE GUIDE (49 FEATURES)</b>
<b>مفتاح الشهر | دليل الميزات الشامل (49 ميزة)</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<b>PHASE 1 — TASK MANAGEMENT | إدارة المهام</b>

1️⃣ <code>/task [desc] @person</code> — Create &amp; assign a task | إنشاء وتعيين مهمة
2️⃣ <code>/tasks</code> — View all active tasks | عرض جميع المهام النشطة
3️⃣ <code>/done [id]</code> — Mark task complete | وضع علامة اكتمال على المهمة
4️⃣ <code>/checklist</code> — Daily checklist | قائمة المهام اليومية
5️⃣ <code>/remind [time] [msg]</code> — Set a reminder | ضبط تذكير
6️⃣ <code>/summary</code> — Daily summary report | تقرير الملخص اليومي
7️⃣ <code>/recurring [freq] [task]</code> — Recurring tasks | المهام المتكررة
8️⃣ <code>/depends [id] on [id]</code> — Task dependencies | تبعيات المهام
9️⃣ <code>/move [id] [topic]</code> — Move task to topic | نقل مهمة إلى موضوع
🔟 <code>/sla</code> — SLA compliance check | فحص الامتثال لمعايير الخدمة
1️⃣1️⃣ <code>/workflow</code> — View workflow status | عرض حالة سير العمل
1️⃣2️⃣ <code>/template</code> — Use message templates | استخدام قوالب الرسائل

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<b>PHASE 2 — REPORTING &amp; ANALYTICS | التقارير والتحليلات</b>

1️⃣3️⃣ <code>/kpi</code> — Full KPI dashboard | لوحة مؤشرات الأداء الكاملة
1️⃣4️⃣ <code>/performance @person</code> — Individual performance | الأداء الفردي
1️⃣5️⃣ <code>/leaderboard</code> — Team ranking | تصنيف الفريق
1️⃣6️⃣ <code>/monthlyreport</code> — Monthly operations report | تقرير العمليات الشهري
1️⃣7️⃣ <code>/occupancy</code> — Occupancy report | تقرير الإشغال
1️⃣8️⃣ <code>/trends</code> — Booking trends | اتجاهات الحجز
1️⃣9️⃣ <code>/audit</code> — System audit log | سجل تدقيق النظام
2️⃣0️⃣ <code>/mlog</code> — Maintenance log | سجل الصيانة
2️⃣1️⃣ <code>/gsync</code> — Sync to Google Sheets | مزامنة مع جداول بيانات Google
2️⃣2️⃣ <code>/stats</code> — System usage stats | إحصائيات استخدام النظام

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<b>PHASE 3 — TEAM &amp; OPERATIONS | الفريق والعمليات</b>

2️⃣3️⃣ <code>/setrole @person role</code> — Assign team role | تعيين دور في الفريق
2️⃣4️⃣ <code>/roles</code> — View all roles | عرض جميع الأدوار
2️⃣5️⃣ <code>/team</code> — View team members | عرض أعضاء الفريق
2️⃣6️⃣ <code>/onboarding @person</code> — Start onboarding | بدء الإعداد
2️⃣7️⃣ <code>/handover @person [details]</code> — Log a handover | تسجيل تسليم
2️⃣8️⃣ <code>/away [reason]</code> — Set away status | تعيين حالة الغياب
2️⃣9️⃣ <code>/back</code> — Return from away | العودة من الغياب
3️⃣0️⃣ <code>/availability</code> — Check team availability | فحص توفر الفريق
3️⃣1️⃣ <code>/meeting [time] [agenda]</code> — Schedule a meeting | جدولة اجتماع
3️⃣2️⃣ <code>/poll "Q" "A" "B" "C"</code> — Create a poll | إنشاء استطلاع
3️⃣3️⃣ <code>/approve [id]</code> — Approve a request | الموافقة على طلب
3️⃣4️⃣ <code>/reject [id] [reason]</code> — Reject with reason | الرفض مع السبب
3️⃣5️⃣ <code>/verify</code> — System health check | فحص صحة النظام
3️⃣6️⃣ <code>/clean</code> — Clean old messages | تنظيف الرسائل القديمة

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<b>PHASE 4 — PROPERTY &amp; FINANCE | العقارات والمالية</b>

3️⃣7️⃣ <code>/property list</code> — View all listings | عرض جميع القوائم
3️⃣8️⃣ <code>/property add</code> — Add new listing | إضافة قائمة جديدة
3️⃣9️⃣ <code>/property update</code> — Update listing | تحديث قائمة
4️⃣0️⃣ <code>/property status [id]</code> — Update unit status | تحديث حالة الوحدة
4️⃣1️⃣ <code>/book [unit] [guest] [dates]</code> — Log booking | تسجيل حجز
4️⃣2️⃣ <code>/mybookings</code> — View bookings | عرض الحجوزات
4️⃣3️⃣ <code>/expense [amt] [cat] [desc]</code> — Log expense | تسجيل نفقة
4️⃣4️⃣ <code>/expenses</code> — View expenses | عرض النفقات
4️⃣5️⃣ <code>/photos [unit_id]</code> — Submit property photos | إرسال صور العقار
4️⃣6️⃣ <code>/idea [text]</code> — Submit an idea | تقديم فكرة
4️⃣7️⃣ <code>/ideas</code> — View all ideas | عرض جميع الأفكار
4️⃣8️⃣ <code>/brainstorm [topic]</code> — Start brainstorm | بدء جلسة عصف ذهني
4️⃣9️⃣ <code>/weather [city]</code> — Get weather update | الحصول على تحديث الطقس

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<i>This bot is your operations co-pilot. Master these commands and you master your day.</i>
<i>هذا البوت هو مساعد عملياتك. أتقن هذه الأوامر وستتقن يومك.</i>`
};

// ============================================================
// MAIN EXECUTION
// ============================================================

async function main() {
  console.log("\n" + "=".repeat(60));
  console.log("REBUILD ALL — Starting complete group rebuild");
  console.log("=".repeat(60));

  const results = [];

  // Post all 13 topic pins (excluding 08 Marketing which is done separately)
  for (const msg of messages) {
    try {
      const id = await postAndPin(msg.thread, msg.text, msg.label);
      results.push({ label: msg.label, thread: msg.thread, id, status: "✅" });
    } catch (err) {
      console.error(`❌ FAILED: ${msg.label} — ${err.message}`);
      results.push({ label: msg.label, thread: msg.thread, id: null, status: "❌ " + err.message });
      await sleep(5000);
    }
  }

  // Post CEO Protocol in thread 4
  try {
    const id = await postAndPin(ceoProtocol.thread, ceoProtocol.text, ceoProtocol.label);
    results.push({ label: ceoProtocol.label, thread: ceoProtocol.thread, id, status: "✅" });
  } catch (err) {
    console.error(`❌ FAILED: CEO Protocol — ${err.message}`);
    results.push({ label: ceoProtocol.label, thread: ceoProtocol.thread, id: null, status: "❌ " + err.message });
  }

  // Post CEO Task in thread 11
  try {
    const id = await postAndPin(ceoTask.thread, ceoTask.text, ceoTask.label);
    results.push({ label: ceoTask.label, thread: ceoTask.thread, id, status: "✅" });
  } catch (err) {
    console.error(`❌ FAILED: CEO Task — ${err.message}`);
    results.push({ label: ceoTask.label, thread: ceoTask.thread, id: null, status: "❌ " + err.message });
  }

  // Post Mushtaq Blockers in thread 13
  try {
    const id = await postAndPin(mushtaqBlockers.thread, mushtaqBlockers.text, mushtaqBlockers.label);
    results.push({ label: mushtaqBlockers.label, thread: mushtaqBlockers.thread, id, status: "✅" });
  } catch (err) {
    console.error(`❌ FAILED: Mushtaq Blockers — ${err.message}`);
    results.push({ label: mushtaqBlockers.label, thread: mushtaqBlockers.thread, id: null, status: "❌ " + err.message });
  }

  // Post Mushtaq Priorities in thread 15
  try {
    const id = await postAndPin(mushtaqPriorities.thread, mushtaqPriorities.text, mushtaqPriorities.label);
    results.push({ label: mushtaqPriorities.label, thread: mushtaqPriorities.thread, id, status: "✅" });
  } catch (err) {
    console.error(`❌ FAILED: Mushtaq Priorities — ${err.message}`);
    results.push({ label: mushtaqPriorities.label, thread: mushtaqPriorities.thread, id: null, status: "❌ " + err.message });
  }

  // Post 49-Feature Guide in thread 3
  try {
    const id = await postAndPin(featureGuide.thread, featureGuide.text, featureGuide.label);
    results.push({ label: featureGuide.label, thread: featureGuide.thread, id, status: "✅" });
  } catch (err) {
    console.error(`❌ FAILED: 49-Feature Guide — ${err.message}`);
    results.push({ label: featureGuide.label, thread: featureGuide.thread, id: null, status: "❌ " + err.message });
  }

  // Print summary
  console.log("\n" + "=".repeat(60));
  console.log("REBUILD COMPLETE — SUMMARY");
  console.log("=".repeat(60));
  for (const r of results) {
    console.log(`${r.status} Thread ${r.thread}: ${r.label} (ID: ${r.id})`);
  }

  const success = results.filter((r) => r.status === "✅").length;
  const fail = results.filter((r) => r.status !== "✅").length;
  console.log(`\nTotal: ${success} succeeded, ${fail} failed`);
}

main().catch(console.error);
