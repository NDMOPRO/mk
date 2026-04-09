/**
 * Internationalization (i18n) for Monthly Key Telegram Bot
 * Supports: Arabic (RTL), English, French, Urdu (RTL), Hindi
 *
 * RTL note: Arabic and Urdu strings that contain mixed content (numbers,
 * symbols, punctuation) are prefixed with the Unicode Right-to-Left Mark
 * (RLM, \u200F) to ensure correct RTL rendering in Telegram.
 */

// Unicode direction marks
const RLM = "\u200F"; // Right-to-Left Mark
const LRM = "\u200E"; // Left-to-Right Mark

const strings = {
  // ─── Arabic (العربية) ─────────────────────────────────────
  ar: {
    welcome: `${RLM}🔑 *مرحباً بك في المفتاح الشهري!*

${RLM}منصة الإيجار الشهري الموثوقة في المملكة العربية السعودية.

${RLM}ابحث عن شقتك المثالية في الرياض وغيرها من المدن السعودية. عقارات مفروشة وغير مفروشة بأسعار شفافة.

${RLM}🏠 استخدم الأزرار أدناه للبدء:`,

    help: `${RLM}📖 *دليل استخدام البوت*

${RLM}*الأوامر المتاحة:*
${RLM}/start — بدء المحادثة
${RLM}/search — البحث عن عقارات
${RLM}/language — تغيير اللغة
${RLM}/notifications — إعدادات الإشعارات
${RLM}/help — عرض هذا الدليل

${RLM}*البحث المباشر:*
${RLM}اكتب @monthlykey\\_bot في أي محادثة متبوعاً باسم المدينة أو كلمة بحث لمشاركة العقارات مباشرة.

${RLM}*الدردشة الذكية:*
${RLM}أرسل أي سؤال وسأساعدك! يمكنني الإجابة عن:
${RLM}• العقارات المتاحة والأسعار
${RLM}• المدن والأحياء المخدومة
${RLM}• كيفية عمل المنصة
${RLM}• الحجز والدفع
${RLM}• أي استفسار آخر

${RLM}🌐 زر موقعنا: monthlykey.com`,

    searchPrompt: `${RLM}🔍 *البحث عن عقارات*\n\n${RLM}اختر المدينة أو اكتب كلمة البحث:`,
    searchResults: `${RLM}🏠 *نتائج البحث:*`,
    noResults: `${RLM}لم يتم العثور على عقارات مطابقة. جرب تعديل معايير البحث.`,
    searching: `${RLM}🔍 جاري البحث...`,
    error: `${RLM}عذراً، حدث خطأ. يرجى المحاولة مرة أخرى.`,
    languageChanged: `${RLM}✅ تم تغيير اللغة إلى العربية`,
    chooseLanguage: `${RLM}🌐 اختر اللغة / Choose Language:`,

    // Reply keyboard buttons — these are plain text, no RLM needed
    // (Telegram renders button labels in their own bubble, no mixed-direction issue)
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
    notifSettings: `${RLM}🔔 *إعدادات الإشعارات*\n\n${RLM}اختر نوع الإشعارات التي تريد تلقيها:`,
    notifNewProperties: "🏠 عقارات جديدة",
    notifPriceDrops: "📉 تخفيضات الأسعار",
    notifBookings: "📋 تحديثات الحجز",
    notifEnabled: "✅ مفعّل",
    notifDisabled: "❌ معطّل",
    notifUpdated: `${RLM}✅ تم تحديث إعدادات الإشعارات`,

    // Property
    perMonth: `${LRM}ر.س${LRM} / شهرياً`,
    bedrooms: "غرف نوم",
    bathrooms: "حمامات",
    sqm: "م²",
    viewDetails: "عرض التفاصيل",
    viewOnWebsite: "🌐 عرض على الموقع",
    shareProperty: "📤 مشاركة",

    // Cities
    comingSoon: "قريباً",
    activeNow: "متاح الآن",

    // Booking
    bookingStart: `${RLM}📋 *حجز عقار*\n\n${RLM}اختر المدينة للبحث عن عقار للحجز:`,
    bookingSelectProperty: `${RLM}🏠 *اختر العقار للحجز:*`,
    bookingPropertySelected: `${RLM}✅ تم اختيار العقار`,
    bookingEnterCheckIn: `${RLM}📅 *تاريخ الدخول*\n\n${RLM}أدخل تاريخ الدخول بالصيغة: ${LRM}YYYY-MM-DD${LRM}\n${RLM}(مثال: ${LRM}2026-05-01${LRM})`,
    bookingEnterCheckOut: `${RLM}📅 *تاريخ الخروج*\n\n${RLM}أدخل تاريخ الخروج بالصيغة: ${LRM}YYYY-MM-DD${LRM}\n${RLM}(مثال: ${LRM}2026-06-01${LRM})`,
    bookingInvalidDate: `${RLM}❌ تاريخ غير صالح. يرجى إدخال التاريخ بالصيغة: ${LRM}YYYY-MM-DD`,
    bookingCheckOutBeforeCheckIn: `${RLM}❌ تاريخ الخروج يجب أن يكون بعد تاريخ الدخول.`,
    bookingPastDate: `${RLM}❌ لا يمكن اختيار تاريخ في الماضي.`,
    bookingConfirmTitle: `${RLM}📋 *تأكيد الحجز*`,
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
    bookingConfirmed: `${RLM}✅ *تم تقديم طلب الحجز بنجاح!*\n\n${RLM}رقم الحجز: #`,
    bookingCancelled: `${RLM}❌ تم إلغاء الحجز.`,
    bookingPaymentPrompt: `${RLM}💳 *الدفع*\n\n${RLM}اختر طريقة الدفع:`,
    bookingPaid: `${RLM}✅ *تم الدفع بنجاح!*\n\n${RLM}شكراً لك. تم تأكيد حجزك.`,
    bookingNotFound: `${RLM}لم يتم العثور على الحجز.`,
    myBookingsTitle: `${RLM}📋 *حجوزاتي*`,
    myBookingsEmpty: `${RLM}ليس لديك حجوزات حالياً.\n\n${RLM}استخدم /book لحجز عقار.`,
    bookingStatusPending: "⏳ قيد المراجعة",
    bookingStatusConfirmed: "✅ مؤكد",
    bookingStatusCancelled: "❌ ملغي",
    bookingStatusActive: "🟢 نشط",
    bookingStatusCompleted: "✔️ مكتمل",
    bookingPaymentPaid: "✅ مدفوع",
    bookingPaymentUnpaid: "⏳ غير مدفوع",
    bookingNoProperties: `${RLM}لم يتم العثور على عقارات. جرب البحث في مدينة أخرى.`,
    sar: "ر.س",

    // Payment
    paymentTitle: "حجز المفتاح الشهري",
    paymentDescription: "دفع حجز عقار عبر المفتاح الشهري",
    paymentSuccess: `${RLM}✅ *تم الدفع بنجاح!*\n\n${RLM}شكراً لك! تم تأكيد حجزك رقم #`,
    paymentFailed: `${RLM}❌ فشل الدفع. يرجى المحاولة مرة أخرى.`,
    paymentInvoiceSent: `${RLM}💳 تم إرسال فاتورة الدفع. اضغط على زر الدفع أدناه.`,

    // Alerts
    alertsTitle: `${RLM}🔔 *تنبيهات العقارات*`,
    alertsEmpty: `${RLM}ليس لديك تنبيهات نشطة.\n\n${RLM}استخدم /subscribe للاشتراك في تنبيهات.`,
    alertsListHeader: `${RLM}🔔 *تنبيهاتك النشطة:*\n`,
    alertCity: "📍 المدينة",
    alertPriceRange: "💰 نطاق السعر",
    alertPropertyType: "🏷️ نوع العقار",
    alertBedrooms: "🛏️ غرف النوم",
    alertAny: "الكل",
    alertDeleteBtn: "🗑️ حذف",
    alertDeleteAllBtn: "🗑️ حذف الكل",
    alertDeleted: `${RLM}✅ تم حذف التنبيه.`,
    alertAllDeleted: `${RLM}✅ تم حذف جميع التنبيهات.`,
    subscribeStart: `${RLM}🔔 *اشتراك في تنبيهات العقارات*\n\n${RLM}اختر المدينة:`,
    subscribeAllCities: "🌍 جميع المدن",
    subscribePricePrompt: `${RLM}💰 *نطاق السعر*\n\n${RLM}أدخل الحد الأدنى والأقصى للسعر الشهري (بالريال):\n\n${RLM}الصيغة: ${LRM}min-max${LRM}\n${RLM}(مثال: ${LRM}3000-8000${LRM})\n\n${RLM}أو اكتب 'skip' للتخطي`,
    subscribeTypePrompt: `${RLM}🏷️ *نوع العقار*\n\n${RLM}اختر نوع العقار:`,
    subscribeAllTypes: "🏠 جميع الأنواع",
    subscribeSuccess: `${RLM}✅ *تم الاشتراك بنجاح!*\n\n${RLM}سيتم إشعارك عند توفر عقارات مطابقة.`,
    subscribeInvalidPrice: `${RLM}❌ صيغة غير صالحة. أدخل بالصيغة: ${LRM}min-max${LRM} (مثال: ${LRM}3000-8000${LRM})`,
    unsubscribePrompt: `${RLM}🔕 *إلغاء الاشتراك*\n\n${RLM}اختر التنبيه لإلغائه أو احذف الكل:`,
    unsubscribeSuccess: `${RLM}✅ تم إلغاء الاشتراك بنجاح.`,
    alertNotification: `${RLM}🔔 *تنبيه عقار جديد!*\n\n${RLM}عقار جديد يطابق تنبيهاتك:`,
  },

  // ─── English ───────────────────────────────────────────────
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
Type @monthlykey\\_bot in any chat followed by a city name or keyword to share properties directly.

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

    notifSettings: "🔔 *Notification Settings*\n\nChoose which notifications you'd like to receive:",
    notifNewProperties: "🏠 New Properties",
    notifPriceDrops: "📉 Price Drops",
    notifBookings: "📋 Booking Updates",
    notifEnabled: "✅ Enabled",
    notifDisabled: "❌ Disabled",
    notifUpdated: "✅ Notification settings updated",

    perMonth: "SAR / month",
    bedrooms: "Bedrooms",
    bathrooms: "Bathrooms",
    sqm: "sqm",
    viewDetails: "View Details",
    viewOnWebsite: "🌐 View on Website",
    shareProperty: "📤 Share",

    comingSoon: "Coming Soon",
    activeNow: "Available Now",

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

    paymentTitle: "Monthly Key Booking",
    paymentDescription: "Property booking payment via Monthly Key",
    paymentSuccess: "✅ *Payment successful!*\n\nThank you! Your booking #",
    paymentFailed: "❌ Payment failed. Please try again.",
    paymentInvoiceSent: "💳 Payment invoice sent. Tap the Pay button below.",

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

  // ─── French (Français) ────────────────────────────────────
  fr: {
    welcome: `🔑 *Bienvenue sur Monthly Key !*

La plateforme de location mensuelle de confiance en Arabie Saoudite.

Trouvez votre appartement idéal à Riyad et dans d'autres villes saoudiennes. Propriétés meublées et non meublées à des prix transparents.

🏠 Utilisez les boutons ci-dessous pour commencer :`,

    help: `📖 *Guide du Bot*

*Commandes disponibles :*
/start — Démarrer la conversation
/search — Rechercher des propriétés
/language — Changer la langue
/notifications — Paramètres de notification
/help — Afficher ce guide

*Recherche en ligne :*
Tapez @monthlykey\\_bot dans n'importe quel chat suivi d'un nom de ville ou d'un mot-clé pour partager des propriétés directement.

🌐 Visitez notre site : monthlykey.com`,

    searchPrompt: "🔍 *Rechercher des propriétés*\n\nChoisissez une ville ou tapez votre recherche :",
    searchResults: "🏠 *Résultats de recherche :*",
    noResults: "Aucune propriété trouvée. Essayez de modifier vos critères.",
    searching: "🔍 Recherche en cours...",
    error: "Désolé, une erreur s'est produite. Veuillez réessayer.",
    languageChanged: "✅ Langue changée en français",
    chooseLanguage: "🌐 Choisissez la langue :",

    btnSearch: "🔍 Rechercher",
    btnFeatured: "⭐ En vedette",
    btnOpenApp: "📱 Ouvrir l'appli",
    btnWebsite: "🌐 Site web",
    btnHelp: "❓ Aide",
    btnLanguage: "🌐 Langue",
    btnNotifications: "🔔 Notifications",
    btnRiyadh: "🏙️ Riyad",
    btnJeddah: "🏙️ Djeddah (Bientôt)",
    btnMadinah: "🏙️ Médine (Bientôt)",
    btnAllCities: "🗺️ Toutes les villes",
    btnBack: "◀️ Retour",

    notifSettings: "🔔 *Paramètres de notification*\n\nChoisissez les notifications que vous souhaitez recevoir :",
    notifNewProperties: "🏠 Nouvelles propriétés",
    notifPriceDrops: "📉 Baisses de prix",
    notifBookings: "📋 Mises à jour de réservation",
    notifEnabled: "✅ Activé",
    notifDisabled: "❌ Désactivé",
    notifUpdated: "✅ Paramètres de notification mis à jour",

    perMonth: "SAR / mois",
    bedrooms: "Chambres",
    bathrooms: "Salles de bain",
    sqm: "m²",
    viewDetails: "Voir les détails",
    viewOnWebsite: "🌐 Voir sur le site",
    shareProperty: "📤 Partager",

    comingSoon: "Bientôt disponible",
    activeNow: "Disponible maintenant",

    bookingStart: "📋 *Réserver une propriété*\n\nChoisissez une ville :",
    bookingSelectProperty: "🏠 *Sélectionnez une propriété :*",
    bookingPropertySelected: "✅ Propriété sélectionnée",
    bookingEnterCheckIn: "📅 *Date d'arrivée*\n\nEntrez la date au format : YYYY-MM-DD\n(Exemple : 2026-05-01)",
    bookingEnterCheckOut: "📅 *Date de départ*\n\nEntrez la date au format : YYYY-MM-DD\n(Exemple : 2026-06-01)",
    bookingInvalidDate: "❌ Date invalide. Format requis : YYYY-MM-DD",
    bookingCheckOutBeforeCheckIn: "❌ La date de départ doit être après la date d'arrivée.",
    bookingPastDate: "❌ Impossible de sélectionner une date passée.",
    bookingConfirmTitle: "📋 *Confirmation de réservation*",
    bookingProperty: "🏠 Propriété",
    bookingCity: "📍 Ville",
    bookingCheckIn: "📅 Arrivée",
    bookingCheckOut: "📅 Départ",
    bookingDuration: "⏱️ Durée",
    bookingMonths: "mois",
    bookingMonthlyRent: "💰 Loyer mensuel",
    bookingDeposit: "🔒 Dépôt de garantie",
    bookingServiceFee: "📄 Frais de service",
    bookingVAT: "📊 TVA (15%)",
    bookingGrandTotal: "💵 Total",
    bookingConfirmBtn: "✅ Confirmer la réservation",
    bookingCancelBtn: "❌ Annuler",
    bookingPayBtn: "💳 Payer maintenant",
    bookingPayLaterBtn: "⏰ Payer plus tard",
    bookingConfirmed: "✅ *Demande de réservation soumise !*\n\nID de réservation : #",
    bookingCancelled: "❌ Réservation annulée.",
    bookingPaymentPrompt: "💳 *Paiement*\n\nChoisissez le mode de paiement :",
    bookingPaid: "✅ *Paiement réussi !*\n\nMerci. Votre réservation est confirmée.",
    bookingNotFound: "Réservation introuvable.",
    myBookingsTitle: "📋 *Mes réservations*",
    myBookingsEmpty: "Vous n'avez pas encore de réservations.\n\nUtilisez /book pour réserver.",
    bookingStatusPending: "⏳ En attente",
    bookingStatusConfirmed: "✅ Confirmé",
    bookingStatusCancelled: "❌ Annulé",
    bookingStatusActive: "🟢 Actif",
    bookingStatusCompleted: "✔️ Terminé",
    bookingPaymentPaid: "✅ Payé",
    bookingPaymentUnpaid: "⏳ Non payé",
    bookingNoProperties: "Aucune propriété trouvée. Essayez une autre ville.",
    sar: "SAR",

    paymentTitle: "Réservation Monthly Key",
    paymentDescription: "Paiement de réservation via Monthly Key",
    paymentSuccess: "✅ *Paiement réussi !*\n\nMerci ! Votre réservation #",
    paymentFailed: "❌ Paiement échoué. Veuillez réessayer.",
    paymentInvoiceSent: "💳 Facture envoyée. Appuyez sur le bouton Payer.",

    alertsTitle: "🔔 *Alertes propriétés*",
    alertsEmpty: "Vous n'avez pas d'alertes actives.\n\nUtilisez /subscribe pour créer des alertes.",
    alertsListHeader: "🔔 *Vos alertes actives :*\n",
    alertCity: "📍 Ville",
    alertPriceRange: "💰 Fourchette de prix",
    alertPropertyType: "🏷️ Type de propriété",
    alertBedrooms: "🛏️ Chambres",
    alertAny: "Tous",
    alertDeleteBtn: "🗑️ Supprimer",
    alertDeleteAllBtn: "🗑️ Tout supprimer",
    alertDeleted: "✅ Alerte supprimée.",
    alertAllDeleted: "✅ Toutes les alertes supprimées.",
    subscribeStart: "🔔 *S'abonner aux alertes*\n\nChoisissez une ville :",
    subscribeAllCities: "🌍 Toutes les villes",
    subscribePricePrompt: "💰 *Fourchette de prix*\n\nEntrez le prix min et max mensuel (en SAR) :\n\nFormat : min-max\n(Exemple : 3000-8000)\n\nOu tapez 'skip' pour ignorer",
    subscribeTypePrompt: "🏷️ *Type de propriété*\n\nChoisissez un type :",
    subscribeAllTypes: "🏠 Tous les types",
    subscribeSuccess: "✅ *Abonnement réussi !*\n\nVous serez notifié quand des propriétés correspondantes seront disponibles.",
    subscribeInvalidPrice: "❌ Format invalide. Entrez : min-max (Exemple : 3000-8000)",
    unsubscribePrompt: "🔕 *Se désabonner*\n\nSélectionnez une alerte à supprimer :",
    unsubscribeSuccess: "✅ Désabonnement réussi.",
    alertNotification: "🔔 *Nouvelle alerte propriété !*\n\nUne nouvelle propriété correspond à vos critères :",
  },

  // ─── Urdu (اردو) — RTL ────────────────────────────────────
  ur: {
    welcome: `${RLM}🔑 *Monthly Key میں خوش آمدید!*

${RLM}سعودی عرب میں قابل اعتماد ماہانہ کرائے کا پلیٹ فارم۔

${RLM}ریاض اور دیگر سعودی شہروں میں اپنا بہترین اپارٹمنٹ تلاش کریں۔

${RLM}🏠 شروع کرنے کے لیے نیچے دیے گئے بٹن استعمال کریں:`,

    help: `${RLM}📖 *بوٹ گائیڈ*

${RLM}*دستیاب کمانڈز:*
${RLM}/start — بات چیت شروع کریں
${RLM}/search — پراپرٹیز تلاش کریں
${RLM}/language — زبان تبدیل کریں
${RLM}/notifications — اطلاع کی ترتیبات
${RLM}/help — یہ گائیڈ دکھائیں

${RLM}🌐 ہماری ویب سائٹ: monthlykey.com`,

    searchPrompt: `${RLM}🔍 *پراپرٹیز تلاش کریں*\n\n${RLM}شہر منتخب کریں یا تلاش کا لفظ لکھیں:`,
    searchResults: `${RLM}🏠 *تلاش کے نتائج:*`,
    noResults: `${RLM}کوئی مطابقت پذیر پراپرٹی نہیں ملی۔ تلاش کے معیار تبدیل کریں۔`,
    searching: `${RLM}🔍 تلاش جاری ہے...`,
    error: `${RLM}معذرت، ایک خرابی پیش آئی۔ دوبارہ کوشش کریں۔`,
    languageChanged: `${RLM}✅ زبان اردو میں تبدیل ہو گئی`,
    chooseLanguage: `${RLM}🌐 زبان منتخب کریں / Choose Language:`,

    btnSearch: "🔍 پراپرٹی تلاش کریں",
    btnFeatured: "⭐ نمایاں پراپرٹیز",
    btnOpenApp: "📱 ایپ کھولیں",
    btnWebsite: "🌐 ویب سائٹ",
    btnHelp: "❓ مدد",
    btnLanguage: "🌐 زبان",
    btnNotifications: "🔔 اطلاعات",
    btnRiyadh: "🏙️ ریاض",
    btnJeddah: "🏙️ جدہ (جلد)",
    btnMadinah: "🏙️ مدینہ (جلد)",
    btnAllCities: "🗺️ تمام شہر",
    btnBack: "◀️ واپس",

    notifSettings: `${RLM}🔔 *اطلاع کی ترتیبات*\n\n${RLM}وصول کرنے کے لیے اطلاعات منتخب کریں:`,
    notifNewProperties: "🏠 نئی پراپرٹیز",
    notifPriceDrops: "📉 قیمتوں میں کمی",
    notifBookings: "📋 بکنگ اپڈیٹس",
    notifEnabled: "✅ فعال",
    notifDisabled: "❌ غیر فعال",
    notifUpdated: `${RLM}✅ اطلاع کی ترتیبات اپڈیٹ ہو گئیں`,

    perMonth: "SAR / ماہانہ",
    bedrooms: "بیڈروم",
    bathrooms: "باتھ روم",
    sqm: "مربع میٹر",
    viewDetails: "تفصیلات دیکھیں",
    viewOnWebsite: "🌐 ویب سائٹ پر دیکھیں",
    shareProperty: "📤 شیئر کریں",

    comingSoon: "جلد آ رہا ہے",
    activeNow: "ابھی دستیاب",

    bookingStart: `${RLM}📋 *پراپرٹی بک کریں*\n\n${RLM}شہر منتخب کریں:`,
    bookingSelectProperty: `${RLM}🏠 *بکنگ کے لیے پراپرٹی منتخب کریں:*`,
    bookingPropertySelected: `${RLM}✅ پراپرٹی منتخب ہو گئی`,
    bookingEnterCheckIn: `${RLM}📅 *چیک ان تاریخ*\n\n${RLM}تاریخ درج کریں: ${LRM}YYYY-MM-DD`,
    bookingEnterCheckOut: `${RLM}📅 *چیک آؤٹ تاریخ*\n\n${RLM}تاریخ درج کریں: ${LRM}YYYY-MM-DD`,
    bookingInvalidDate: `${RLM}❌ غلط تاریخ۔ فارمیٹ: ${LRM}YYYY-MM-DD`,
    bookingCheckOutBeforeCheckIn: `${RLM}❌ چیک آؤٹ تاریخ چیک ان کے بعد ہونی چاہیے۔`,
    bookingPastDate: `${RLM}❌ گزری ہوئی تاریخ منتخب نہیں کر سکتے۔`,
    bookingConfirmTitle: `${RLM}📋 *بکنگ کی تصدیق*`,
    bookingProperty: "🏠 پراپرٹی",
    bookingCity: "📍 شہر",
    bookingCheckIn: "📅 چیک ان",
    bookingCheckOut: "📅 چیک آؤٹ",
    bookingDuration: "⏱️ مدت",
    bookingMonths: "ماہ",
    bookingMonthlyRent: "💰 ماہانہ کرایہ",
    bookingDeposit: "🔒 سیکیورٹی ڈپازٹ",
    bookingServiceFee: "📄 سروس فیس",
    bookingVAT: "📊 VAT (15%)",
    bookingGrandTotal: "💵 کل رقم",
    bookingConfirmBtn: "✅ بکنگ کی تصدیق کریں",
    bookingCancelBtn: "❌ منسوخ کریں",
    bookingPayBtn: "💳 ابھی ادائیگی کریں",
    bookingPayLaterBtn: "⏰ بعد میں ادائیگی کریں",
    bookingConfirmed: `${RLM}✅ *بکنگ کی درخواست جمع ہو گئی!*\n\n${RLM}بکنگ نمبر: #`,
    bookingCancelled: `${RLM}❌ بکنگ منسوخ ہو گئی۔`,
    bookingPaymentPrompt: `${RLM}💳 *ادائیگی*\n\n${RLM}ادائیگی کا طریقہ منتخب کریں:`,
    bookingPaid: `${RLM}✅ *ادائیگی کامیاب!*\n\n${RLM}شکریہ۔ آپ کی بکنگ تصدیق ہو گئی۔`,
    bookingNotFound: `${RLM}بکنگ نہیں ملی۔`,
    myBookingsTitle: `${RLM}📋 *میری بکنگز*`,
    myBookingsEmpty: `${RLM}آپ کی ابھی کوئی بکنگ نہیں ہے۔`,
    bookingStatusPending: "⏳ زیر غور",
    bookingStatusConfirmed: "✅ تصدیق شدہ",
    bookingStatusCancelled: "❌ منسوخ",
    bookingStatusActive: "🟢 فعال",
    bookingStatusCompleted: "✔️ مکمل",
    bookingPaymentPaid: "✅ ادا شدہ",
    bookingPaymentUnpaid: "⏳ غیر ادا شدہ",
    bookingNoProperties: `${RLM}کوئی پراپرٹی نہیں ملی۔ دوسرے شہر میں تلاش کریں۔`,
    sar: "SAR",

    paymentTitle: "Monthly Key بکنگ",
    paymentDescription: "Monthly Key کے ذریعے بکنگ ادائیگی",
    paymentSuccess: `${RLM}✅ *ادائیگی کامیاب!*\n\n${RLM}شکریہ! آپ کی بکنگ #`,
    paymentFailed: `${RLM}❌ ادائیگی ناکام۔ دوبارہ کوشش کریں۔`,
    paymentInvoiceSent: `${RLM}💳 انوائس بھیج دی گئی۔ ادائیگی کا بٹن دبائیں۔`,

    alertsTitle: `${RLM}🔔 *پراپرٹی الرٹس*`,
    alertsEmpty: `${RLM}آپ کے کوئی فعال الرٹس نہیں ہیں۔`,
    alertsListHeader: `${RLM}🔔 *آپ کے فعال الرٹس:*\n`,
    alertCity: "📍 شہر",
    alertPriceRange: "💰 قیمت کی حد",
    alertPropertyType: "🏷️ پراپرٹی کی قسم",
    alertBedrooms: "🛏️ بیڈروم",
    alertAny: "تمام",
    alertDeleteBtn: "🗑️ حذف کریں",
    alertDeleteAllBtn: "🗑️ سب حذف کریں",
    alertDeleted: `${RLM}✅ الرٹ حذف ہو گیا۔`,
    alertAllDeleted: `${RLM}✅ تمام الرٹس حذف ہو گئے۔`,
    subscribeStart: `${RLM}🔔 *الرٹس کے لیے سبسکرائب کریں*\n\n${RLM}شہر منتخب کریں:`,
    subscribeAllCities: "🌍 تمام شہر",
    subscribePricePrompt: `${RLM}💰 *قیمت کی حد*\n\n${RLM}کم از کم اور زیادہ سے زیادہ ماہانہ قیمت درج کریں (SAR میں):`,
    subscribeTypePrompt: `${RLM}🏷️ *پراپرٹی کی قسم*\n\n${RLM}قسم منتخب کریں:`,
    subscribeAllTypes: "🏠 تمام اقسام",
    subscribeSuccess: `${RLM}✅ *سبسکرپشن کامیاب!*\n\n${RLM}مطابقت پذیر پراپرٹیز دستیاب ہونے پر آپ کو مطلع کیا جائے گا۔`,
    subscribeInvalidPrice: `${RLM}❌ غلط فارمیٹ۔`,
    unsubscribePrompt: `${RLM}🔕 *ان سبسکرائب*\n\n${RLM}الرٹ منتخب کریں:`,
    unsubscribeSuccess: `${RLM}✅ ان سبسکرائب کامیاب۔`,
    alertNotification: `${RLM}🔔 *نئی پراپرٹی الرٹ!*\n\n${RLM}ایک نئی پراپرٹی آپ کے الرٹس سے مطابقت رکھتی ہے:`,
  },

  // ─── Hindi (हिन्दी) ───────────────────────────────────────
  hi: {
    welcome: `🔑 *Monthly Key में आपका स्वागत है!*

सऊदी अरब में विश्वसनीय मासिक किराया प्लेटफ़ॉर्म।

रियाद और अन्य सऊदी शहरों में अपना आदर्श अपार्टमेंट खोजें।

🏠 शुरू करने के लिए नीचे दिए बटन का उपयोग करें:`,

    help: `📖 *बोट गाइड*

*उपलब्ध कमांड:*
/start — बातचीत शुरू करें
/search — प्रॉपर्टी खोजें
/language — भाषा बदलें
/notifications — सूचना सेटिंग
/help — यह गाइड दिखाएं

🌐 हमारी वेबसाइट: monthlykey.com`,

    searchPrompt: "🔍 *प्रॉपर्टी खोजें*\n\nशहर चुनें या खोज शब्द टाइप करें:",
    searchResults: "🏠 *खोज परिणाम:*",
    noResults: "कोई मिलान प्रॉपर्टी नहीं मिली। खोज मानदंड बदलें।",
    searching: "🔍 खोज जारी है...",
    error: "क्षमा करें, एक त्रुटि हुई। पुनः प्रयास करें।",
    languageChanged: "✅ भाषा हिंदी में बदल गई",
    chooseLanguage: "🌐 भाषा चुनें / Choose Language:",

    btnSearch: "🔍 प्रॉपर्टी खोजें",
    btnFeatured: "⭐ विशेष प्रॉपर्टीज",
    btnOpenApp: "📱 ऐप खोलें",
    btnWebsite: "🌐 वेबसाइट",
    btnHelp: "❓ सहायता",
    btnLanguage: "🌐 भाषा",
    btnNotifications: "🔔 सूचनाएं",
    btnRiyadh: "🏙️ रियाद",
    btnJeddah: "🏙️ जेद्दा (जल्द)",
    btnMadinah: "🏙️ मदीना (जल्द)",
    btnAllCities: "🗺️ सभी शहर",
    btnBack: "◀️ वापस",

    notifSettings: "🔔 *सूचना सेटिंग*\n\nप्राप्त करने के लिए सूचनाएं चुनें:",
    notifNewProperties: "🏠 नई प्रॉपर्टीज",
    notifPriceDrops: "📉 कीमत में कमी",
    notifBookings: "📋 बुकिंग अपडेट",
    notifEnabled: "✅ सक्रिय",
    notifDisabled: "❌ निष्क्रिय",
    notifUpdated: "✅ सूचना सेटिंग अपडेट हो गई",

    perMonth: "SAR / माह",
    bedrooms: "बेडरूम",
    bathrooms: "बाथरूम",
    sqm: "वर्ग मीटर",
    viewDetails: "विवरण देखें",
    viewOnWebsite: "🌐 वेबसाइट पर देखें",
    shareProperty: "📤 शेयर करें",

    comingSoon: "जल्द आ रहा है",
    activeNow: "अभी उपलब्ध",

    bookingStart: "📋 *प्रॉपर्टी बुक करें*\n\nशहर चुनें:",
    bookingSelectProperty: "🏠 *बुकिंग के लिए प्रॉपर्टी चुनें:*",
    bookingPropertySelected: "✅ प्रॉपर्टी चुनी गई",
    bookingEnterCheckIn: "📅 *चेक-इन तारीख*\n\nतारीख दर्ज करें: YYYY-MM-DD\n(उदाहरण: 2026-05-01)",
    bookingEnterCheckOut: "📅 *चेक-आउट तारीख*\n\nतारीख दर्ज करें: YYYY-MM-DD\n(उदाहरण: 2026-06-01)",
    bookingInvalidDate: "❌ अमान्य तारीख। फ़ॉर्मेट: YYYY-MM-DD",
    bookingCheckOutBeforeCheckIn: "❌ चेक-आउट तारीख चेक-इन के बाद होनी चाहिए।",
    bookingPastDate: "❌ बीती हुई तारीख नहीं चुन सकते।",
    bookingConfirmTitle: "📋 *बुकिंग पुष्टि*",
    bookingProperty: "🏠 प्रॉपर्टी",
    bookingCity: "📍 शहर",
    bookingCheckIn: "📅 चेक-इन",
    bookingCheckOut: "📅 चेक-आउट",
    bookingDuration: "⏱️ अवधि",
    bookingMonths: "महीने",
    bookingMonthlyRent: "💰 मासिक किराया",
    bookingDeposit: "🔒 सुरक्षा जमा",
    bookingServiceFee: "📄 सेवा शुल्क",
    bookingVAT: "📊 VAT (15%)",
    bookingGrandTotal: "💵 कुल राशि",
    bookingConfirmBtn: "✅ बुकिंग की पुष्टि करें",
    bookingCancelBtn: "❌ रद्द करें",
    bookingPayBtn: "💳 अभी भुगतान करें",
    bookingPayLaterBtn: "⏰ बाद में भुगतान करें",
    bookingConfirmed: "✅ *बुकिंग अनुरोध सबमिट हो गया!*\n\nबुकिंग ID: #",
    bookingCancelled: "❌ बुकिंग रद्द हो गई।",
    bookingPaymentPrompt: "💳 *भुगतान*\n\nभुगतान विधि चुनें:",
    bookingPaid: "✅ *भुगतान सफल!*\n\nधन्यवाद। आपकी बुकिंग की पुष्टि हो गई।",
    bookingNotFound: "बुकिंग नहीं मिली।",
    myBookingsTitle: "📋 *मेरी बुकिंग*",
    myBookingsEmpty: "आपकी अभी कोई बुकिंग नहीं है।",
    bookingStatusPending: "⏳ लंबित",
    bookingStatusConfirmed: "✅ पुष्टि",
    bookingStatusCancelled: "❌ रद्द",
    bookingStatusActive: "🟢 सक्रिय",
    bookingStatusCompleted: "✔️ पूर्ण",
    bookingPaymentPaid: "✅ भुगतान किया",
    bookingPaymentUnpaid: "⏳ अभुगतान",
    bookingNoProperties: "कोई प्रॉपर्टी नहीं मिली। दूसरे शहर में खोजें।",
    sar: "SAR",

    paymentTitle: "Monthly Key बुकिंग",
    paymentDescription: "Monthly Key के माध्यम से बुकिंग भुगतान",
    paymentSuccess: "✅ *भुगतान सफल!*\n\nधन्यवाद! बुकिंग #",
    paymentFailed: "❌ भुगतान विफल। कृपया पुनः प्रयास करें।",
    paymentInvoiceSent: "💳 इनवॉइस भेज दी गई। भुगतान बटन दबाएं।",

    alertsTitle: "🔔 *प्रॉपर्टी अलर्ट*",
    alertsEmpty: "आपके कोई सक्रिय अलर्ट नहीं हैं।\n\nअलर्ट बनाने के लिए /subscribe का उपयोग करें।",
    alertsListHeader: "🔔 *आपके सक्रिय अलर्ट:*\n",
    alertCity: "📍 शहर",
    alertPriceRange: "💰 मूल्य सीमा",
    alertPropertyType: "🏷️ प्रॉपर्टी प्रकार",
    alertBedrooms: "🛏️ बेडरूम",
    alertAny: "सभी",
    alertDeleteBtn: "🗑️ हटाएं",
    alertDeleteAllBtn: "🗑️ सब हटाएं",
    alertDeleted: "✅ अलर्ट हटा दिया गया।",
    alertAllDeleted: "✅ सभी अलर्ट हटा दिए गए।",
    subscribeStart: "🔔 *अलर्ट के लिए सब्सक्राइब करें*\n\nशहर चुनें:",
    subscribeAllCities: "🌍 सभी शहर",
    subscribePricePrompt: "💰 *मूल्य सीमा*\n\nन्यूनतम और अधिकतम मासिक मूल्य दर्ज करें (SAR में):\n\nप्रारूप: min-max\n(उदाहरण: 3000-8000)\n\nया 'skip' टाइप करें",
    subscribeTypePrompt: "🏷️ *प्रॉपर्टी प्रकार*\n\nप्रकार चुनें:",
    subscribeAllTypes: "🏠 सभी प्रकार",
    subscribeSuccess: "✅ *सब्सक्रिप्शन सफल!*\n\nमिलान प्रॉपर्टीज मिलने पर आपको सूचित किया जाएगा।",
    subscribeInvalidPrice: "❌ अमान्य प्रारूप। दर्ज करें: min-max (उदाहरण: 3000-8000)",
    unsubscribePrompt: "🔕 *अनसब्सक्राइब*\n\nहटाने के लिए अलर्ट चुनें:",
    unsubscribeSuccess: "✅ अनसब्सक्राइब सफल।",
    alertNotification: "🔔 *नई प्रॉपर्टी अलर्ट!*\n\nएक नई प्रॉपर्टी आपके मानदंडों से मेल खाती है:",
  },
};

/**
 * Supported languages list
 */
const supportedLanguages = [
  { code: "ar", name: "العربية", flag: "🇸🇦" },
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "fr", name: "Français", flag: "🇫🇷" },
  { code: "ur", name: "اردو", flag: "🇵🇰" },
  { code: "hi", name: "हिन्दी", flag: "🇮🇳" },
];

/**
 * Get a translated string
 */
function t(lang, key) {
  return strings[lang]?.[key] || strings["en"]?.[key] || key;
}

/**
 * Detect best language from Telegram language_code
 */
function detectLanguage(langCode) {
  if (!langCode) return "ar";
  const lc = langCode.toLowerCase();
  if (lc.startsWith("ar")) return "ar";
  if (lc.startsWith("fr")) return "fr";
  if (lc.startsWith("ur")) return "ur";
  if (lc.startsWith("hi")) return "hi";
  if (lc.startsWith("en")) return "en";
  return "en";
}

module.exports = { t, strings, supportedLanguages, detectLanguage };
