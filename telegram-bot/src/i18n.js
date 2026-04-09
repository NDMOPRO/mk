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
  },
};

/**
 * Get a translated string
 */
function t(lang, key) {
  return strings[lang]?.[key] || strings["en"]?.[key] || key;
}

module.exports = { t, strings };
