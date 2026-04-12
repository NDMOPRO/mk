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

async function sendWithRetry(method, params, retries) {
  retries = retries || 3;
  for (let i = 0; i < retries; i++) {
    const r = await apiCall(method, params);
    if (r.ok) return r;
    if (r.error_code === 429) {
      const wait = ((r.parameters && r.parameters.retry_after) || 35) * 1000 + 1000;
      console.log('    Rate limited. Waiting ' + (wait / 1000) + 's...');
      await sleep(wait);
    } else {
      console.error('    API error: ' + r.description);
      return r;
    }
  }
}

const DIV = '━━━━━━━━━━━━━━━━━━━━';

const TOPICS = [
  {
    id: null,
    label: 'General | عام',
    msg: `💬 *Welcome to Monthly Key — Daily Operations HQ*

This is the main hub for all operational communication. Use the dedicated topics for specific matters and keep this General channel for announcements and cross-team updates.

*How to use this group:*
• Each topic has a specific purpose — use the right one
• Tag team members when action is required
• The bot (@monthlykey_bot) is always listening — ask it anything

${DIV}

💬 *مرحباً بكم في Monthly Key — مقر العمليات اليومية*

هذا هو المحور الرئيسي لجميع الاتصالات التشغيلية. استخدم المواضيع المخصصة للأمور المحددة، واحتفظ بهذه القناة العامة للإعلانات والتحديثات المشتركة بين الفرق.

*كيفية استخدام هذه المجموعة:*
• لكل موضوع غرض محدد — استخدم الموضوع الصحيح
• أشر إلى أعضاء الفريق عند الحاجة إلى اتخاذ إجراء
• البوت (@monthlykey_bot) يستمع دائماً — اسأله أي شيء`
  },
  {
    id: 3,
    label: '00 — Rules & Guide',
    msg: `📋 *00 — Rules & Guide | القواعد والدليل*

*Group Rules:*
1. Stay on topic — use the correct thread for each matter
2. Be professional and respectful at all times
3. Tag the relevant person when you need a response
4. Log all tasks, blockers, and updates through the bot
5. Respond to your mentions within your SLA window
6. No personal conversations in operational topics

*Bot Commands Quick Reference:*
/task — Create a task
/done — Mark a task complete
/remind — Set a reminder
/checklist — View your task checklist
/ai — Ask the AI assistant anything

${DIV}

📋 *00 — القواعد والدليل*

*قواعد المجموعة:*
١. التزم بالموضوع — استخدم الخيط الصحيح لكل مسألة
٢. كن محترفاً ومهذباً في جميع الأوقات
٣. أشر إلى الشخص المعني عندما تحتاج إلى رد
٤. سجّل جميع المهام والعوائق والتحديثات عبر البوت
٥. رد على إشاراتك ضمن نافذة الـ SLA الخاصة بك
٦. لا محادثات شخصية في المواضيع التشغيلية

*مرجع سريع لأوامر البوت:*
/task — إنشاء مهمة
/done — تحديد مهمة كمنجزة
/remind — تعيين تذكير
/checklist — عرض قائمة مهامك
/ai — اسأل المساعد الذكي أي شيء`
  },
  {
    id: 4,
    label: '01 — CEO Update',
    msg: `📊 *01 — CEO Update | تحديث المدير التنفيذي*

*To the Monthly Key Team,*

Our success is built on discipline, speed, and accountability. Every day we operate, we must be better than the day before.

*Three principles I expect from every team member:*

🕐 *Respect time.* Log your updates before end of day. If it is not in the system, it did not happen.

⚡ *Move fast.* Blockers must be raised immediately — not tomorrow. Use the Blockers topic the moment you are stuck.

✅ *Own your work.* Every task you accept is your responsibility until it is marked Done. No exceptions.

This system exists to make your work easier and our business stronger. Use it fully.

${DIV}

📊 *01 — تحديث المدير التنفيذي*

*إلى فريق Monthly Key،*

نجاحنا مبني على الانضباط والسرعة والمساءلة. في كل يوم نعمل فيه، يجب أن نكون أفضل مما كنا عليه بالأمس.

*ثلاثة مبادئ أتوقعها من كل عضو في الفريق:*

🕐 *احترم الوقت.* سجّل تحديثاتك قبل نهاية اليوم. إذا لم يكن في النظام، فهذا يعني أنه لم يحدث.

⚡ *تحرك بسرعة.* يجب الإبلاغ عن العوائق فوراً — ليس غداً. استخدم موضوع العوائق في اللحظة التي تعلق فيها.

✅ *تملّك عملك.* كل مهمة تقبلها هي مسؤوليتك حتى يتم تحديدها كمنجزة. لا استثناءات.

هذا النظام موجود لجعل عملك أسهل وأعمالنا أقوى. استخدمه بالكامل.`
  },
  {
    id: 5,
    label: '02 — Operations',
    msg: `🔧 *02 — Operations | المتابعة التشغيلية*

*Purpose:* Daily operational tracking, coordination, and follow-ups across all properties and teams.

*Use this topic for:*
• Daily standup updates
• Property status reports
• Operational issues and resolutions
• Inter-team coordination
• Check-in / check-out tracking

*Bot commands:*
/task — Log a new operational task
/checklist — View pending tasks
/occupancy — Check property occupancy

${DIV}

🔧 *02 — المتابعة التشغيلية*

*الغرض:* المتابعة التشغيلية اليومية والتنسيق والمتابعة عبر جميع العقارات والفرق.

*استخدم هذا الموضوع لـ:*
• تحديثات الاجتماع اليومي
• تقارير حالة العقارات
• المشاكل التشغيلية وحلولها
• التنسيق بين الفرق
• تتبع تسجيل الوصول / المغادرة

*أوامر البوت:*
/task — تسجيل مهمة تشغيلية جديدة
/checklist — عرض المهام المعلقة
/occupancy — التحقق من إشغال العقارات`
  },
  {
    id: 6,
    label: '03 — Listings',
    msg: `🏠 *03 — Listings | العقارات والمخزون*

*Purpose:* Management of all property listings, inventory updates, and availability tracking.

*Use this topic for:*
• New property listings and updates
• Inventory changes (furniture, amenities)
• Pricing adjustments
• Property photos and condition reports
• Platform listing status (Airbnb, Booking.com, etc.)

*Bot commands:*
/photos — Submit or review property photos
/occupancy — View current occupancy

${DIV}

🏠 *03 — العقارات والمخزون*

*الغرض:* إدارة جميع قوائم العقارات وتحديثات المخزون وتتبع التوفر.

*استخدم هذا الموضوع لـ:*
• قوائم العقارات الجديدة والتحديثات
• تغييرات المخزون (الأثاث والمرافق)
• تعديلات الأسعار
• صور العقارات وتقارير الحالة
• حالة القوائم على المنصات (Airbnb، Booking.com، إلخ)

*أوامر البوت:*
/photos — تقديم أو مراجعة صور العقارات
/occupancy — عرض الإشغال الحالي`
  },
  {
    id: 7,
    label: '04 — Bookings & Revenue',
    msg: `💰 *04 — Bookings & Revenue | الحجوزات والإيرادات*

*Purpose:* Tracking all bookings, revenue performance, and financial targets.

*Use this topic for:*
• New booking confirmations
• Cancellations and modifications
• Revenue reports and targets
• Occupancy rate discussions
• Payment collection status

*Bot commands:*
/expense — Log an expense
/revenue — View revenue summary
/occupancy — Check booking occupancy

${DIV}

💰 *04 — الحجوزات والإيرادات*

*الغرض:* تتبع جميع الحجوزات والأداء المالي والأهداف المالية.

*استخدم هذا الموضوع لـ:*
• تأكيدات الحجز الجديدة
• الإلغاءات والتعديلات
• تقارير الإيرادات والأهداف
• مناقشات معدل الإشغال
• حالة تحصيل المدفوعات

*أوامر البوت:*
/expense — تسجيل مصروف
/revenue — عرض ملخص الإيرادات
/occupancy — التحقق من إشغال الحجوزات`
  },
  {
    id: 8,
    label: '05 — Support',
    msg: `🎧 *05 — Support | دعم العملاء*

*Purpose:* Customer support coordination, guest issue resolution, and service quality tracking.

*Use this topic for:*
• Guest complaints and requests
• Maintenance requests from guests
• Emergency situations
• Service quality feedback
• Escalations requiring management attention

*SLA: Respond within 12 hours.*

*Bot commands:*
/task — Log a support task
/escalate — Escalate an issue to management

${DIV}

🎧 *05 — دعم العملاء*

*الغرض:* تنسيق دعم العملاء وحل مشاكل الضيوف وتتبع جودة الخدمة.

*استخدم هذا الموضوع لـ:*
• شكاوى وطلبات الضيوف
• طلبات الصيانة من الضيوف
• حالات الطوارئ
• تعليقات جودة الخدمة
• التصعيد الذي يتطلب اهتمام الإدارة

*معيار الخدمة (SLA): الرد خلال ١٢ ساعة.*

*أوامر البوت:*
/task — تسجيل مهمة دعم
/escalate — تصعيد مشكلة إلى الإدارة`
  },
  {
    id: 9,
    label: '06 — Tech Issues',
    msg: `💻 *06 — Tech Issues | المشاكل التقنية*

*Purpose:* Reporting, tracking, and resolving all technical bugs, system issues, and platform problems.

*Use this topic for:*
• Bot or system bugs
• Platform technical issues (Airbnb, Booking.com, PMS)
• App or software problems
• Internet or device issues at properties
• Feature requests for the bot

*SLA: Acknowledge within 48 hours.*

*Bot commands:*
/task — Log a tech issue
/done — Mark an issue resolved

${DIV}

💻 *06 — المشاكل التقنية*

*الغرض:* الإبلاغ عن جميع الأعطال التقنية ومشاكل النظام ومشاكل المنصات وتتبعها وحلها.

*استخدم هذا الموضوع لـ:*
• أعطال البوت أو النظام
• المشاكل التقنية للمنصات (Airbnb، Booking.com، PMS)
• مشاكل التطبيقات أو البرامج
• مشاكل الإنترنت أو الأجهزة في العقارات
• طلبات الميزات للبوت

*معيار الخدمة (SLA): الإقرار خلال ٤٨ ساعة.*

*أوامر البوت:*
/task — تسجيل مشكلة تقنية
/done — تحديد مشكلة كمحلولة`
  },
  {
    id: 10,
    label: '07 — Payments',
    msg: `💳 *07 — Payments | المدفوعات والمالية*

*Purpose:* All financial transactions, payment tracking, expense management, and accounting coordination.

*Use this topic for:*
• Payment confirmations and receipts
• Outstanding payment follow-ups
• Expense approvals
• Invoice management
• Petty cash and supplier payments

*Bot commands:*
/expense — Log an expense
/approve — Approve a pending expense
/reject — Reject an expense request

${DIV}

💳 *07 — المدفوعات والمالية*

*الغرض:* جميع المعاملات المالية وتتبع المدفوعات وإدارة المصروفات وتنسيق المحاسبة.

*استخدم هذا الموضوع لـ:*
• تأكيدات الدفع والإيصالات
• متابعة المدفوعات المعلقة
• موافقات المصروفات
• إدارة الفواتير
• المصروفات النثرية ومدفوعات الموردين

*أوامر البوت:*
/expense — تسجيل مصروف
/approve — الموافقة على مصروف معلق
/reject — رفض طلب مصروف`
  },
  {
    id: 11,
    label: '08 — Marketing',
    msg: `📣 *08 — Marketing | التسويق والمحتوى*

*Purpose:* Marketing campaigns, content creation, social media coordination, and brand management.

*Use this topic for:*
• Campaign planning and updates
• Content approvals and feedback
• Social media posts and schedules
• Photography and video requests
• Promotional offers and pricing strategy

*Bot commands:*
/idea — Submit a marketing idea
/ideas — View and vote on submitted ideas
/task — Log a marketing task

${DIV}

📣 *08 — التسويق والمحتوى*

*الغرض:* حملات التسويق وإنشاء المحتوى وتنسيق وسائل التواصل الاجتماعي وإدارة العلامة التجارية.

*استخدم هذا الموضوع لـ:*
• تخطيط الحملات وتحديثاتها
• موافقات المحتوى والتعليقات عليه
• منشورات وجداول وسائل التواصل الاجتماعي
• طلبات التصوير الفوتوغرافي والفيديو
• العروض الترويجية واستراتيجية التسعير

*أوامر البوت:*
/idea — تقديم فكرة تسويقية
/ideas — عرض الأفكار المقدمة والتصويت عليها
/task — تسجيل مهمة تسويقية`
  },
  {
    id: 12,
    label: '09 — Legal',
    msg: `⚖️ *09 — Legal | القانونية والامتثال*

*Purpose:* Legal matters, contract management, regulatory compliance, and risk management.

*Use this topic for:*
• Contract reviews and approvals
• Regulatory compliance updates
• Legal disputes or notices
• Insurance matters
• Licensing and permits

*All legal matters are confidential. Tag management directly for urgent issues.*

${DIV}

⚖️ *09 — القانونية والامتثال*

*الغرض:* المسائل القانونية وإدارة العقود والامتثال التنظيمي وإدارة المخاطر.

*استخدم هذا الموضوع لـ:*
• مراجعات العقود والموافقات عليها
• تحديثات الامتثال التنظيمي
• النزاعات القانونية أو الإشعارات
• مسائل التأمين
• الترخيص والتصاريح

*جميع المسائل القانونية سرية. أشر إلى الإدارة مباشرة للمسائل العاجلة.*`
  },
  {
    id: 13,
    label: '10 — Blockers',
    msg: `🚨 *10 — Blockers | العوائق والتصعيد*

*Purpose:* Immediate escalation of blockers, urgent issues, and anything preventing the team from moving forward.

*Use this topic for:*
• Anything blocking your work right now
• Issues requiring immediate management decision
• Emergency situations
• Cross-team dependencies that are unresolved
• Escalations from Support or Operations

*SLA: Management acknowledges within 24 hours. Do NOT wait — post immediately when blocked.*

*Bot commands:*
/task — Log a blocker
/escalate — Escalate with priority flag

${DIV}

🚨 *10 — العوائق والتصعيد*

*الغرض:* التصعيد الفوري للعوائق والمشاكل العاجلة وأي شيء يمنع الفريق من المضي قدماً.

*استخدم هذا الموضوع لـ:*
• أي شيء يعيق عملك الآن
• المسائل التي تتطلب قراراً إدارياً فورياً
• حالات الطوارئ
• التبعيات بين الفرق غير المحلولة
• التصعيد من الدعم أو العمليات

*معيار الخدمة (SLA): تقر الإدارة خلال ٢٤ ساعة. لا تنتظر — انشر فوراً عند التعثر.*

*أوامر البوت:*
/task — تسجيل عائق
/escalate — تصعيد مع علامة الأولوية`
  },
  {
    id: 14,
    label: '11 — Completed',
    msg: `✅ *11 — Completed | المنجز اليوم*

*Purpose:* Daily log of completed tasks, resolved issues, and team achievements.

*Use this topic for:*
• Marking tasks as done with a brief summary
• Celebrating wins and milestones
• End-of-day completion reports
• Resolved support tickets
• Closed blockers

*Post your completions here daily. This builds our team's performance record.*

*Bot commands:*
/done — Mark a task complete (auto-posts here)

${DIV}

✅ *11 — المنجز اليوم*

*الغرض:* سجل يومي للمهام المنجزة والمشاكل المحلولة وإنجازات الفريق.

*استخدم هذا الموضوع لـ:*
• تحديد المهام كمنجزة مع ملخص موجز
• الاحتفال بالإنجازات والمعالم
• تقارير الإنجاز في نهاية اليوم
• تذاكر الدعم المحلولة
• العوائق المغلقة

*انشر إنجازاتك هنا يومياً. هذا يبني سجل أداء فريقنا.*

*أوامر البوت:*
/done — تحديد مهمة كمنجزة (ينشر هنا تلقائياً)`
  },
  {
    id: 15,
    label: '12 — Priorities',
    msg: `📌 *12 — Priorities | أولويات الغد*

*Purpose:* Setting and communicating tomorrow's priorities, ensuring the team starts each day aligned and focused.

*Use this topic for:*
• End-of-day priority setting for tomorrow
• Top 3 tasks each team member will focus on
• Handover notes between shifts
• Weekly planning and goal alignment
• Upcoming deadlines and important dates

*Post your priorities every evening before leaving.*

*Bot commands:*
/task — Add a priority task for tomorrow
/checklist — Review your pending priorities

${DIV}

📌 *12 — أولويات الغد*

*الغرض:* تحديد أولويات الغد والتواصل بشأنها، وضمان بدء الفريق كل يوم بتوافق وتركيز.

*استخدم هذا الموضوع لـ:*
• تحديد الأولويات في نهاية اليوم للغد
• أهم ٣ مهام سيركز عليها كل عضو في الفريق
• ملاحظات التسليم بين المناوبات
• التخطيط الأسبوعي ومواءمة الأهداف
• المواعيد النهائية القادمة والتواريخ المهمة

*انشر أولوياتك كل مساء قبل المغادرة.*

*أوامر البوت:*
/task — إضافة مهمة ذات أولوية للغد
/checklist — مراجعة أولوياتك المعلقة`
  },
  {
    id: 235,
    label: '15 — Admin Panel',
    msg: `🔐 *15 — Admin Panel | لوحة الإدارة*

*Restricted: Administrators only.*

This topic is reserved for bot configuration, system management, and administrative operations. All actions here are logged in the audit trail.

*Available commands:*
/admin help — Full command reference
/admin config — View bot configuration
/admin logs — View recent audit logs
/admin stats — System statistics
/admin roles — All team role assignments
/admin schedule — All scheduled jobs
/admin db — Database table counts
/admin broadcast — Send message to any topic
/admin test — Test bot connectivity

*Non-administrators will be denied access automatically.*

${DIV}

🔐 *15 — لوحة الإدارة*

*مقيّد: للمسؤولين فقط.*

هذا الموضوع مخصص لتكوين البوت وإدارة النظام والعمليات الإدارية. جميع الإجراءات هنا مسجلة في سجل التدقيق.

*الأوامر المتاحة:*
/admin help — مرجع الأوامر الكامل
/admin config — عرض تكوين البوت
/admin logs — عرض سجلات التدقيق الأخيرة
/admin stats — إحصائيات النظام
/admin roles — جميع تعيينات أدوار الفريق
/admin schedule — جميع المهام المجدولة
/admin db — أعداد جداول قاعدة البيانات
/admin broadcast — إرسال رسالة إلى أي موضوع
/admin test — اختبار اتصال البوت

*سيتم رفض وصول غير المسؤولين تلقائياً.*`
  }
];

async function main() {
  const results = [];
  for (var i = 0; i < TOPICS.length; i++) {
    var topic = TOPICS[i];
    console.log('[' + (i+1) + '/' + TOPICS.length + '] Posting to: ' + topic.label + '...');

    var sendParams = {
      chat_id: CHAT_ID,
      text: topic.msg,
      parse_mode: 'Markdown'
    };
    if (topic.id !== null) sendParams.message_thread_id = topic.id;

    var r = await sendWithRetry('sendMessage', sendParams);
    if (!r || !r.ok) {
      console.error('  FAILED: ' + (r ? r.description : 'no response'));
      results.push({ topic: topic.label, status: 'FAILED' });
      await sleep(3000);
      continue;
    }

    var msgId = r.result.message_id;
    console.log('  Sent (ID: ' + msgId + '). Pinning...');

    var p = await sendWithRetry('pinChatMessage', { chat_id: CHAT_ID, message_id: msgId });
    if (p && p.ok) {
      console.log('  Pinned!');
      results.push({ topic: topic.label, status: 'OK', msgId: msgId });
    } else {
      console.warn('  Pin failed: ' + (p ? p.description : 'no response'));
      results.push({ topic: topic.label, status: 'SENT_NOT_PINNED', msgId: msgId });
    }

    // 3 second delay between topics to avoid rate limits
    await sleep(3000);
  }

  console.log('\n=== FINAL RESULTS ===');
  for (var j = 0; j < results.length; j++) {
    var res = results[j];
    console.log((res.status === 'OK' ? '✅' : '⚠️') + ' ' + res.topic + ' — ' + res.status + (res.msgId ? ' (msg ' + res.msgId + ')' : ''));
  }
}

main().catch(console.error);
