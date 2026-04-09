/**
 * Internationalization (i18n) for Monthly Key Telegram Bot
 * Supports Arabic and English
 */

const strings = {
  ar: {
    welcome: `🔑 *مرحباً بك في المفتاح الشهري!*

منصة الإيجار الشهري الموثوقة في المملكة العربية السعودية.

ابحث عن شقتك المثالية في الرياض وغيرها من المدن السعودية. عقارات مفروشة وغير مفروشة بأسعار شفافة.

🏠 استخدم الأزرار أدناه للبدء:`,

    help: `📖 *دليل استخدام البوت*

*الأوامر المتاحة:*
/start — بدء المحادثة
/search — البحث عن عقارات
/book — حجز عقار
/mybookings — حجوزاتي
/alerts — إدارة تنبيهات العقارات
/subscribe — الاشتراك في تنبيهات
/unsubscribe — إلغاء الاشتراك من التنبيهات
/language — تغيير اللغة
/notifications — إعدادات الإشعارات
/help — عرض هذا الدليل

*البحث المباشر:*
اكتب @MonthlyKeyBot في أي محادثة متبوعاً باسم المدينة أو كلمة بحث لمشاركة العقارات مباشرة.

*الدردشة الذكية:*
أرسل أي سؤال وسأساعدك! يمكنني الإجابة عن:
• العقارات المتاحة والأسعار
• المدن والأحياء المخدومة
• كيفية عمل المنصة
• الحجز والدفع
• أي استفسار آخر

🌐 زر موقعنا: monthlykey.com`,

    searchPrompt: "🔍 *البحث عن عقارات*\n\nاختر المدينة أو اكتب كلمة البحث:",
    searchResults: "🏠 *نتائج البحث:*",
    noResults: "لم يتم العثور على عقارات مطابقة. جرب تعديل معايير البحث.",
    searching: "🔍 جاري البحث...",
    error: "عذراً، حدث خطأ. يرجى المحاولة مرة أخرى.",
    languageChanged: "✅ تم تغيير اللغة إلى العربية",
    chooseLanguage: "🌐 اختر اللغة / Choose Language:",
    
    // Buttons
    btnSearch: "🔍 البحث عن عقار",
    btnFeatured: "⭐ العقارات المميزة",
    btnOpenApp: "📱 فتح التطبيق",
    btnWebsite: "🌐 الموقع الإلكتروني",
    btnHelp: "❓ المساعدة",
    btnLanguage: "🌐 English",
    btnNotifications: "🔔 الإشعارات",
    btnRiyadh: "🏙️ الرياض",
    btnJeddah: "🏙️ جدة (قريباً)",
    btnMadinah: "🏙️ المدينة (قريباً)",
    btnAllCities: "🗺️ كل المدن",
    btnBack: "◀️ رجوع",

    // Notifications
    notifSettings: `🔔 *إعدادات الإشعارات*\n\nاختر نوع الإشعارات التي تريد تلقيها:`,
    notifNewProperties: "🏠 عقارات جديدة",
    notifPriceDrops: "📉 تخفيضات الأسعار",
    notifBookings: "📋 تحديثات الحجز",
    notifEnabled: "✅ مفعّل",
    notifDisabled: "❌ معطّل",
    notifUpdated: "✅ تم تحديث إعدادات الإشعارات",

    // Property
    perMonth: "ر.س / شهرياً",
    bedrooms: "غرف نوم",
    bathrooms: "حمامات",
    sqm: "م²",
    viewDetails: "عرض التفاصيل",
    viewOnWebsite: "🌐 عرض على الموقع",
    shareProperty: "📤 مشاركة",

    // Cities
    comingSoon: "قريباً",
    activeNow: "متاح الآن",

    // ─── Phase 2: Booking ──────────────────────────────────────
    bookingStart: "📋 *حجز عقار*\n\nاختر المدينة للبحث عن عقار للحجز:",
    bookingSelectProperty: "🏠 *اختر العقار للحجز:*",
    bookingPropertySelected: "✅ تم اختيار العقار",
    bookingEnterCheckIn: "📅 *تاريخ الدخول*\n\nأدخل تاريخ الدخول بالصيغة: YYYY-MM-DD\n(مثال: 2026-05-01)",
    bookingEnterCheckOut: "📅 *تاريخ الخروج*\n\nأدخل تاريخ الخروج بالصيغة: YYYY-MM-DD\n(مثال: 2026-06-01)",
    bookingInvalidDate: "❌ تاريخ غير صالح. يرجى إدخال التاريخ بالصيغة: YYYY-MM-DD",
    bookingCheckOutBeforeCheckIn: "❌ تاريخ الخروج يجب أن يكون بعد تاريخ الدخول.",
    bookingPastDate: "❌ لا يمكن اختيار تاريخ في الماضي.",
    bookingConfirmTitle: "📋 *تأكيد الحجز*",
    bookingProperty: "🏠 العقار",
    bookingCity: "📍 المدينة",
    bookingCheckIn: "📅 تاريخ الدخول",
    bookingCheckOut: "📅 تاريخ الخروج",
    bookingDuration: "⏱️ المدة",
    bookingMonths: "شهر",
    bookingMonthlyRent: "💰 الإيجار الشهري",
    bookingDeposit: "🔒 تأمين",
    bookingServiceFee: "📄 رسوم الخدمة",
    bookingVAT: "📊 ضريبة القيمة المضافة",
    bookingGrandTotal: "💵 الإجمالي",
    bookingConfirmBtn: "✅ تأكيد الحجز",
    bookingCancelBtn: "❌ إلغاء",
    bookingPayBtn: "💳 الدفع الآن",
    bookingPayLaterBtn: "⏰ الدفع لاحقاً",
    bookingConfirmed: "✅ *تم تقديم طلب الحجز بنجاح!*\n\nرقم الحجز: #",
    bookingCancelled: "❌ تم إلغاء الحجز.",
    bookingPaymentPrompt: "💳 *الدفع*\n\nاختر طريقة الدفع:",
    bookingPaid: "✅ *تم الدفع بنجاح!*\n\nشكراً لك. تم تأكيد حجزك.",
    bookingNotFound: "لم يتم العثور على الحجز.",
    myBookingsTitle: "📋 *حجوزاتي*",
    myBookingsEmpty: "ليس لديك حجوزات حالياً.\n\nاستخدم /book لحجز عقار.",
    bookingStatusPending: "⏳ قيد المراجعة",
    bookingStatusConfirmed: "✅ مؤكد",
    bookingStatusCancelled: "❌ ملغي",
    bookingStatusActive: "🟢 نشط",
    bookingStatusCompleted: "✔️ مكتمل",
    bookingPaymentPaid: "✅ مدفوع",
    bookingPaymentUnpaid: "⏳ غير مدفوع",
    bookingNoProperties: "لم يتم العثور على عقارات. جرب البحث في مدينة أخرى.",
    sar: "ر.س",

    // ─── Phase 2: Payment ──────────────────────────────────────
    paymentTitle: "حجز المفتاح الشهري",
    paymentDescription: "دفع حجز عقار عبر المفتاح الشهري",
    paymentSuccess: "✅ *تم الدفع بنجاح!*\n\nشكراً لك! تم تأكيد حجزك رقم #",
    paymentFailed: "❌ فشل الدفع. يرجى المحاولة مرة أخرى.",
    paymentInvoiceSent: "💳 تم إرسال فاتورة الدفع. اضغط على زر الدفع أدناه.",

    // ─── Phase 2: Alerts ───────────────────────────────────────
    alertsTitle: "🔔 *تنبيهات العقارات*",
    alertsEmpty: "ليس لديك تنبيهات نشطة.\n\nاستخدم /subscribe للاشتراك في تنبيهات.",
    alertsListHeader: "🔔 *تنبيهاتك النشطة:*\n",
    alertCity: "📍 المدينة",
    alertPriceRange: "💰 نطاق السعر",
    alertPropertyType: "🏷️ نوع العقار",
    alertBedrooms: "🛏️ غرف النوم",
    alertAny: "الكل",
    alertDeleteBtn: "🗑️ حذف",
    alertDeleteAllBtn: "🗑️ حذف الكل",
    alertDeleted: "✅ تم حذف التنبيه.",
    alertAllDeleted: "✅ تم حذف جميع التنبيهات.",
    subscribeStart: "🔔 *اشتراك في تنبيهات العقارات*\n\nاختر المدينة:",
    subscribeAllCities: "🌍 جميع المدن",
    subscribePricePrompt: "💰 *نطاق السعر*\n\nأدخل الحد الأدنى والأقصى للسعر الشهري (بالريال):\n\nالصيغة: min-max\n(مثال: 3000-8000)\n\nأو اكتب 'skip' للتخطي",
    subscribeTypePrompt: "🏷️ *نوع العقار*\n\nاختر نوع العقار:",
    subscribeAllTypes: "🏠 جميع الأنواع",
    subscribeSuccess: "✅ *تم الاشتراك بنجاح!*\n\nسيتم إشعارك عند توفر عقارات مطابقة.",
    subscribeInvalidPrice: "❌ صيغة غير صالحة. أدخل بالصيغة: min-max (مثال: 3000-8000)",
    unsubscribePrompt: "🔕 *إلغاء الاشتراك*\n\nاختر التنبيه لإلغائه أو احذف الكل:",
    unsubscribeSuccess: "✅ تم إلغاء الاشتراك بنجاح.",
    alertNotification: "🔔 *تنبيه عقار جديد!*\n\nعقار جديد يطابق تنبيهاتك:",
  },

  en: {
    welcome: `🔑 *Welcome to Monthly Key!*

The trusted monthly rental platform in Saudi Arabia.

Find your perfect apartment in Riyadh and other Saudi cities. Furnished and unfurnished properties with transparent pricing.

🏠 Use the buttons below to get started:`,

    help: `📖 *Bot Guide*

*Available Commands:*
/start — Start the conversation
/search — Search for properties
/book — Book a property
/mybookings — My bookings
/alerts — Manage property alerts
/subscribe — Subscribe to alerts
/unsubscribe — Unsubscribe from alerts
/language — Change language
/notifications — Notification settings
/help — Show this guide

*Inline Search:*
Type @MonthlyKeyBot in any chat followed by a city name or keyword to share properties directly.

*Smart Chat:*
Send any question and I'll help! I can answer about:
• Available properties and pricing
• Covered cities and districts
• How the platform works
• Booking and payments
• Any other inquiry

🌐 Visit our website: monthlykey.com`,

    searchPrompt: "🔍 *Search Properties*\n\nChoose a city or type your search query:",
    searchResults: "🏠 *Search Results:*",
    noResults: "No matching properties found. Try adjusting your search criteria.",
    searching: "🔍 Searching...",
    error: "Sorry, an error occurred. Please try again.",
    languageChanged: "✅ Language changed to English",
    chooseLanguage: "🌐 اختر اللغة / Choose Language:",

    // Buttons
    btnSearch: "🔍 Search Properties",
    btnFeatured: "⭐ Featured Properties",
    btnOpenApp: "📱 Open App",
    btnWebsite: "🌐 Website",
    btnHelp: "❓ Help",
    btnLanguage: "🌐 العربية",
    btnNotifications: "🔔 Notifications",
    btnRiyadh: "🏙️ Riyadh",
    btnJeddah: "🏙️ Jeddah (Soon)",
    btnMadinah: "🏙️ Madinah (Soon)",
    btnAllCities: "🗺️ All Cities",
    btnBack: "◀️ Back",

    // Notifications
    notifSettings: `🔔 *Notification Settings*\n\nChoose which notifications you'd like to receive:`,
    notifNewProperties: "🏠 New Properties",
    notifPriceDrops: "📉 Price Drops",
    notifBookings: "📋 Booking Updates",
    notifEnabled: "✅ Enabled",
    notifDisabled: "❌ Disabled",
    notifUpdated: "✅ Notification settings updated",

    // Property
    perMonth: "SAR / month",
    bedrooms: "Bedrooms",
    bathrooms: "Bathrooms",
    sqm: "sqm",
    viewDetails: "View Details",
    viewOnWebsite: "🌐 View on Website",
    shareProperty: "📤 Share",

    // Cities
    comingSoon: "Coming Soon",
    activeNow: "Available Now",

    // ─── Phase 2: Booking ──────────────────────────────────────
    bookingStart: "📋 *Book a Property*\n\nChoose a city to search for properties:",
    bookingSelectProperty: "🏠 *Select a property to book:*",
    bookingPropertySelected: "✅ Property selected",
    bookingEnterCheckIn: "📅 *Check-in Date*\n\nEnter your check-in date in format: YYYY-MM-DD\n(Example: 2026-05-01)",
    bookingEnterCheckOut: "📅 *Check-out Date*\n\nEnter your check-out date in format: YYYY-MM-DD\n(Example: 2026-06-01)",
    bookingInvalidDate: "❌ Invalid date. Please enter the date in format: YYYY-MM-DD",
    bookingCheckOutBeforeCheckIn: "❌ Check-out date must be after check-in date.",
    bookingPastDate: "❌ Cannot select a date in the past.",
    bookingConfirmTitle: "📋 *Booking Confirmation*",
    bookingProperty: "🏠 Property",
    bookingCity: "📍 City",
    bookingCheckIn: "📅 Check-in",
    bookingCheckOut: "📅 Check-out",
    bookingDuration: "⏱️ Duration",
    bookingMonths: "month(s)",
    bookingMonthlyRent: "💰 Monthly Rent",
    bookingDeposit: "🔒 Security Deposit",
    bookingServiceFee: "📄 Service Fee",
    bookingVAT: "📊 VAT (15%)",
    bookingGrandTotal: "💵 Grand Total",
    bookingConfirmBtn: "✅ Confirm Booking",
    bookingCancelBtn: "❌ Cancel",
    bookingPayBtn: "💳 Pay Now",
    bookingPayLaterBtn: "⏰ Pay Later",
    bookingConfirmed: "✅ *Booking request submitted!*\n\nBooking ID: #",
    bookingCancelled: "❌ Booking cancelled.",
    bookingPaymentPrompt: "💳 *Payment*\n\nChoose payment method:",
    bookingPaid: "✅ *Payment successful!*\n\nThank you. Your booking is confirmed.",
    bookingNotFound: "Booking not found.",
    myBookingsTitle: "📋 *My Bookings*",
    myBookingsEmpty: "You have no bookings yet.\n\nUse /book to book a property.",
    bookingStatusPending: "⏳ Pending",
    bookingStatusConfirmed: "✅ Confirmed",
    bookingStatusCancelled: "❌ Cancelled",
    bookingStatusActive: "🟢 Active",
    bookingStatusCompleted: "✔️ Completed",
    bookingPaymentPaid: "✅ Paid",
    bookingPaymentUnpaid: "⏳ Unpaid",
    bookingNoProperties: "No properties found. Try searching in another city.",
    sar: "SAR",

    // ─── Phase 2: Payment ──────────────────────────────────────
    paymentTitle: "Monthly Key Booking",
    paymentDescription: "Property booking payment via Monthly Key",
    paymentSuccess: "✅ *Payment successful!*\n\nThank you! Your booking #",
    paymentFailed: "❌ Payment failed. Please try again.",
    paymentInvoiceSent: "💳 Payment invoice sent. Tap the Pay button below.",

    // ─── Phase 2: Alerts ───────────────────────────────────────
    alertsTitle: "🔔 *Property Alerts*",
    alertsEmpty: "You have no active alerts.\n\nUse /subscribe to set up alerts.",
    alertsListHeader: "🔔 *Your Active Alerts:*\n",
    alertCity: "📍 City",
    alertPriceRange: "💰 Price Range",
    alertPropertyType: "🏷️ Property Type",
    alertBedrooms: "🛏️ Bedrooms",
    alertAny: "Any",
    alertDeleteBtn: "🗑️ Delete",
    alertDeleteAllBtn: "🗑️ Delete All",
    alertDeleted: "✅ Alert deleted.",
    alertAllDeleted: "✅ All alerts deleted.",
    subscribeStart: "🔔 *Subscribe to Property Alerts*\n\nChoose a city:",
    subscribeAllCities: "🌍 All Cities",
    subscribePricePrompt: "💰 *Price Range*\n\nEnter minimum and maximum monthly price (in SAR):\n\nFormat: min-max\n(Example: 3000-8000)\n\nOr type 'skip' to skip",
    subscribeTypePrompt: "🏷️ *Property Type*\n\nChoose a property type:",
    subscribeAllTypes: "🏠 All Types",
    subscribeSuccess: "✅ *Subscribed successfully!*\n\nYou'll be notified when matching properties are listed.",
    subscribeInvalidPrice: "❌ Invalid format. Enter as: min-max (Example: 3000-8000)",
    unsubscribePrompt: "🔕 *Unsubscribe*\n\nSelect an alert to remove or delete all:",
    unsubscribeSuccess: "✅ Unsubscribed successfully.",
    alertNotification: "🔔 *New Property Alert!*\n\nA new property matches your alerts:",
  },
};

/**
 * Get a translated string
 */
function t(lang, key) {
  return strings[lang]?.[key] || strings["en"]?.[key] || key;
}

module.exports = { t, strings };
