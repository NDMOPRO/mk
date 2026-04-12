const https = require('https');

const TOKEN = '8729034252:AAFzfZIDrquCNjoI1lrZKVCh6x9iH9hZL84';
const CHAT_ID = -1003967447285;
const THREAD_MARKETING = 11;

function api(method, params) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(params);
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${TOKEN}/${method}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

const message = `📣 <b>CEO TASK ASSIGNMENT | مهمة مُكلَّف بها من المدير التنفيذي</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔖 <b>Task Ref:</b> MKT-2026-001
📅 <b>Date Issued:</b> April 12, 2026
⏳ <b>Deadline:</b> April 19, 2026
👤 <b>Assigned To:</b> Mushtaq Ibn Muhammad — Operational Manager
👑 <b>Assigned By:</b> CEO

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 <b>TASK: Build Riyadh Company Database for Direct Marketing</b>

The CEO has assigned the following task to the Operational Manager. You are required to compile a comprehensive, verified database of companies in Riyadh to be used for future direct marketing campaigns.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📂 <b>REQUIRED DATA FIELDS (per company):</b>

1️⃣  Company Name | اسم الشركة
2️⃣  Industry / Category | القطاع / الفئة
3️⃣  Contact Person (if available) | الشخص المسؤول
4️⃣  Phone Number | رقم الهاتف
5️⃣  WhatsApp Number (if available) | رقم الواتساب
6️⃣  Email Address | البريد الإلكتروني
7️⃣  Website | الموقع الإلكتروني
8️⃣  Office Location in Riyadh | موقع المكتب في الرياض
9️⃣  Source of Information | مصدر المعلومات

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ <b>APPROVED SOURCES:</b>

• Al Qasim Real Estate source
• Public business directories and trusted online sources
• Approved business contacts we already have access to

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚫 <b>RULES — MUST BE FOLLOWED:</b>

• Do <b>NOT</b> use private or unverified personal contacts
• Do <b>NOT</b> add fake, missing, or guessed data
• Every entry must be verified before inclusion
• Submit the completed database as a spreadsheet (Excel/Google Sheets)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🇸🇦 <b>تكليف من المدير التنفيذي | CEO TASK ASSIGNMENT</b>

🔖 <b>رقم المهمة:</b> MKT-2026-001
📅 <b>تاريخ الإصدار:</b> 12 أبريل 2026
⏳ <b>الموعد النهائي:</b> 19 أبريل 2026
👤 <b>المُكلَّف:</b> مشتاق ابن محمد — مدير العمليات
👑 <b>المُكلِّف:</b> المدير التنفيذي

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 <b>المهمة: بناء قاعدة بيانات شركات الرياض للتسويق المباشر</b>

كلّف المدير التنفيذي مدير العمليات بتجميع قاعدة بيانات شاملة وموثّقة للشركات في الرياض، لاستخدامها في حملات التسويق المباشر المستقبلية.

📂 <b>الحقول المطلوبة لكل شركة:</b>

1️⃣  اسم الشركة
2️⃣  القطاع / الفئة
3️⃣  الشخص المسؤول (إن توفّر)
4️⃣  رقم الهاتف
5️⃣  رقم الواتساب (إن توفّر)
6️⃣  البريد الإلكتروني
7️⃣  الموقع الإلكتروني
8️⃣  موقع المكتب في الرياض
9️⃣  مصدر المعلومات

✅ <b>المصادر المعتمدة:</b>

• مصدر القاسم للعقارات
• أدلة الأعمال العامة والمصادر الإلكترونية الموثوقة
• جهات الاتصال التجارية المعتمدة المتاحة لدينا

🚫 <b>القواعد الواجب الالتزام بها:</b>

• لا تستخدم جهات اتصال شخصية خاصة أو غير موثّقة
• لا تُدرج بيانات مزيّفة أو مفقودة أو مُخمَّنة
• يجب التحقق من كل إدخال قبل إدراجه
• يُسلَّم قاعدة البيانات المكتملة على شكل جدول بيانات (Excel / Google Sheets)`;

async function main() {
  console.log('Posting CEO task assignment to Marketing topic (thread 11)...');
  
  const result = await api('sendMessage', {
    chat_id: CHAT_ID,
    message_thread_id: THREAD_MARKETING,
    text: message,
    parse_mode: 'HTML',
    disable_notification: true
  });

  if (result.ok) {
    console.log(`✅ Posted successfully! Message ID: ${result.result.message_id}`);
  } else {
    console.error(`❌ Failed: ${result.description}`);
    process.exit(1);
  }
}

main().catch(console.error);
