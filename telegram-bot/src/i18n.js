/**
 * Internationalization (i18n) for Monthly Key Telegram Bot
 * Supports: Arabic, English, French, Urdu, Hindi
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
اكتب @monthlykey\\_bot في أي محادثة متبوعاً باسم المدينة أو كلمة بحث لمشاركة العقارات مباشرة.

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

  // ─── French (Francais) ─────────────────────────────────────
  fr: {
    welcome: `🔑 *Bienvenue sur Monthly Key !*

La plateforme de location mensuelle de confiance en Arabie Saoudite.

Trouvez votre appartement ideal a Riyad et dans d'autres villes saoudiennes. Proprietes meublees et non meublees a des prix transparents.

🏠 Utilisez les boutons ci-dessous pour commencer :`,

    help: `📖 *Guide du Bot*

*Commandes disponibles :*
/start — Demarrer la conversation
/search — Rechercher des proprietes
/book — Reserver une propriete
/mybookings — Mes reservations
/alerts — Gerer les alertes
/subscribe — S'abonner aux alertes
/unsubscribe — Se desabonner des alertes
/language — Changer la langue
/notifications — Parametres de notification
/help — Afficher ce guide

*Recherche en ligne :*
Tapez @monthlykey\\_bot dans n'importe quel chat suivi d'un nom de ville ou d'un mot-cle pour partager des proprietes directement.

*Chat intelligent :*
Envoyez n'importe quelle question et je vous aiderai !

🌐 Visitez notre site : monthlykey.com`,

    searchPrompt: "🔍 *Rechercher des proprietes*\n\nChoisissez une ville ou tapez votre recherche :",
    searchResults: "🏠 *Resultats de recherche :*",
    noResults: "Aucune propriete trouvee. Essayez de modifier vos criteres.",
    searching: "🔍 Recherche en cours...",
    error: "Desole, une erreur s'est produite. Veuillez reessayer.",
    languageChanged: "✅ Langue changee en francais",
    chooseLanguage: "🌐 Choisissez la langue :",

    btnSearch: "🔍 Rechercher",
    btnFeatured: "⭐ En vedette",
    btnOpenApp: "📱 Ouvrir l'appli",
    btnWebsite: "🌐 Site web",
    btnHelp: "❓ Aide",
    btnLanguage: "🌐 Langue",
    btnNotifications: "🔔 Notifications",
    btnRiyadh: "🏙️ Riyad",
    btnJeddah: "🏙️ Djeddah (Bientot)",
    btnMadinah: "🏙️ Medine (Bientot)",
    btnAllCities: "🗺️ Toutes les villes",
    btnBack: "◀️ Retour",

    notifSettings: `🔔 *Parametres de notification*\n\nChoisissez les notifications que vous souhaitez recevoir :`,
    notifNewProperties: "🏠 Nouvelles proprietes",
    notifPriceDrops: "📉 Baisses de prix",
    notifBookings: "📋 Mises a jour de reservation",
    notifEnabled: "✅ Active",
    notifDisabled: "❌ Desactive",
    notifUpdated: "✅ Parametres de notification mis a jour",

    perMonth: "SAR / mois",
    bedrooms: "Chambres",
    bathrooms: "Salles de bain",
    sqm: "m²",
    viewDetails: "Voir les details",
    viewOnWebsite: "🌐 Voir sur le site",
    shareProperty: "📤 Partager",

    comingSoon: "Bientot disponible",
    activeNow: "Disponible maintenant",

    bookingStart: "📋 *Reserver une propriete*\n\nChoisissez une ville :",
    bookingSelectProperty: "🏠 *Selectionnez une propriete :*",
    bookingPropertySelected: "✅ Propriete selectionnee",
    bookingEnterCheckIn: "📅 *Date d'arrivee*\n\nEntrez la date au format : YYYY-MM-DD\n(Exemple : 2026-05-01)",
    bookingEnterCheckOut: "📅 *Date de depart*\n\nEntrez la date au format : YYYY-MM-DD\n(Exemple : 2026-06-01)",
    bookingInvalidDate: "❌ Date invalide. Format requis : YYYY-MM-DD",
    bookingCheckOutBeforeCheckIn: "❌ La date de depart doit etre apres la date d'arrivee.",
    bookingPastDate: "❌ Impossible de selectionner une date passee.",
    bookingConfirmTitle: "📋 *Confirmation de reservation*",
    bookingProperty: "🏠 Propriete",
    bookingCity: "📍 Ville",
    bookingCheckIn: "📅 Arrivee",
    bookingCheckOut: "📅 Depart",
    bookingDuration: "⏱️ Duree",
    bookingMonths: "mois",
    bookingMonthlyRent: "💰 Loyer mensuel",
    bookingDeposit: "🔒 Depot de garantie",
    bookingServiceFee: "📄 Frais de service",
    bookingVAT: "📊 TVA (15%)",
    bookingGrandTotal: "💵 Total",
    bookingConfirmBtn: "✅ Confirmer",
    bookingCancelBtn: "❌ Annuler",
    bookingPayBtn: "💳 Payer maintenant",
    bookingPayLaterBtn: "⏰ Payer plus tard",
    bookingConfirmed: "✅ *Reservation soumise !*\n\nNumero de reservation : #",
    bookingCancelled: "❌ Reservation annulee.",
    bookingPaymentPrompt: "💳 *Paiement*\n\nChoisissez le mode de paiement :",
    bookingPaid: "✅ *Paiement reussi !*\n\nMerci. Votre reservation est confirmee.",
    bookingNotFound: "Reservation introuvable.",
    myBookingsTitle: "📋 *Mes reservations*",
    myBookingsEmpty: "Vous n'avez pas encore de reservations.\n\nUtilisez /book pour reserver.",
    bookingStatusPending: "⏳ En attente",
    bookingStatusConfirmed: "✅ Confirmee",
    bookingStatusCancelled: "❌ Annulee",
    bookingStatusActive: "🟢 Active",
    bookingStatusCompleted: "✔️ Terminee",
    bookingPaymentPaid: "✅ Paye",
    bookingPaymentUnpaid: "⏳ Non paye",
    bookingNoProperties: "Aucune propriete trouvee. Essayez une autre ville.",
    sar: "SAR",

    paymentTitle: "Reservation Monthly Key",
    paymentDescription: "Paiement de reservation via Monthly Key",
    paymentSuccess: "✅ *Paiement reussi !*\n\nMerci ! Reservation #",
    paymentFailed: "❌ Echec du paiement. Veuillez reessayer.",
    paymentInvoiceSent: "💳 Facture envoyee. Appuyez sur le bouton Payer.",

    alertsTitle: "🔔 *Alertes proprietes*",
    alertsEmpty: "Vous n'avez pas d'alertes actives.\n\nUtilisez /subscribe pour creer une alerte.",
    alertsListHeader: "🔔 *Vos alertes actives :*\n",
    alertCity: "📍 Ville",
    alertPriceRange: "💰 Fourchette de prix",
    alertPropertyType: "🏷️ Type de propriete",
    alertBedrooms: "🛏️ Chambres",
    alertAny: "Tous",
    alertDeleteBtn: "🗑️ Supprimer",
    alertDeleteAllBtn: "🗑️ Tout supprimer",
    alertDeleted: "✅ Alerte supprimee.",
    alertAllDeleted: "✅ Toutes les alertes supprimees.",
    subscribeStart: "🔔 *S'abonner aux alertes*\n\nChoisissez une ville :",
    subscribeAllCities: "🌍 Toutes les villes",
    subscribePricePrompt: "💰 *Fourchette de prix*\n\nEntrez le prix min et max (en SAR) :\n\nFormat : min-max\n(Exemple : 3000-8000)\n\nOu tapez 'skip' pour passer",
    subscribeTypePrompt: "🏷️ *Type de propriete*\n\nChoisissez un type :",
    subscribeAllTypes: "🏠 Tous les types",
    subscribeSuccess: "✅ *Abonnement reussi !*\n\nVous serez notifie des nouvelles proprietes correspondantes.",
    subscribeInvalidPrice: "❌ Format invalide. Entrez : min-max (Exemple : 3000-8000)",
    unsubscribePrompt: "🔕 *Se desabonner*\n\nSelectionnez une alerte a supprimer :",
    unsubscribeSuccess: "✅ Desabonnement reussi.",
    alertNotification: "🔔 *Nouvelle alerte propriete !*\n\nUne nouvelle propriete correspond a vos criteres :",
  },

  // ─── Urdu (اردو) ──────────────────────────────────────────
  ur: {
    welcome: `🔑 *Monthly Key میں خوش آمدید!*

سعودی عرب میں ماہانہ کرایے کا قابل اعتماد پلیٹ فارم۔

ریاض اور دیگر سعودی شہروں میں اپنا مثالی اپارٹمنٹ تلاش کریں۔ فرنشڈ اور غیر فرنشڈ پراپرٹیز شفاف قیمتوں کے ساتھ۔

🏠 شروع کرنے کے لیے نیچے دیے گئے بٹن استعمال کریں:`,

    help: `📖 *بوٹ گائیڈ*

*دستیاب کمانڈز:*
/start — بات چیت شروع کریں
/search — پراپرٹیز تلاش کریں
/book — پراپرٹی بک کریں
/mybookings — میری بکنگز
/alerts — الرٹس کا نظم کریں
/subscribe — الرٹس کے لیے سبسکرائب کریں
/unsubscribe — الرٹس سے ان سبسکرائب کریں
/language — زبان تبدیل کریں
/notifications — نوٹیفکیشن سیٹنگز
/help — یہ گائیڈ دکھائیں

*ان لائن سرچ:*
کسی بھی چیٹ میں @monthlykey\\_bot ٹائپ کریں اور شہر کا نام یا کلیدی لفظ لکھیں۔

🌐 ہماری ویب سائٹ: monthlykey.com`,

    searchPrompt: "🔍 *پراپرٹیز تلاش کریں*\n\nشہر منتخب کریں یا تلاش لکھیں:",
    searchResults: "🏠 *تلاش کے نتائج:*",
    noResults: "کوئی مماثل پراپرٹی نہیں ملی۔ تلاش کے معیار تبدیل کریں۔",
    searching: "🔍 تلاش جاری ہے...",
    error: "معذرت، ایک خرابی ہوئی۔ دوبارہ کوشش کریں۔",
    languageChanged: "✅ زبان اردو میں تبدیل ہو گئی",
    chooseLanguage: "🌐 زبان منتخب کریں:",

    btnSearch: "🔍 تلاش کریں",
    btnFeatured: "⭐ نمایاں پراپرٹیز",
    btnOpenApp: "📱 ایپ کھولیں",
    btnWebsite: "🌐 ویب سائٹ",
    btnHelp: "❓ مدد",
    btnLanguage: "🌐 زبان",
    btnNotifications: "🔔 نوٹیفکیشنز",
    btnRiyadh: "🏙️ ریاض",
    btnJeddah: "🏙️ جدہ (جلد)",
    btnMadinah: "🏙️ مدینہ (جلد)",
    btnAllCities: "🗺️ تمام شہر",
    btnBack: "◀️ واپس",

    notifSettings: `🔔 *نوٹیفکیشن سیٹنگز*\n\nمنتخب کریں کون سی نوٹیفکیشنز آپ وصول کرنا چاہتے ہیں:`,
    notifNewProperties: "🏠 نئی پراپرٹیز",
    notifPriceDrops: "📉 قیمت میں کمی",
    notifBookings: "📋 بکنگ اپڈیٹس",
    notifEnabled: "✅ فعال",
    notifDisabled: "❌ غیر فعال",
    notifUpdated: "✅ نوٹیفکیشن سیٹنگز اپڈیٹ ہو گئیں",

    perMonth: "SAR / ماہانہ",
    bedrooms: "کمرے",
    bathrooms: "باتھ روم",
    sqm: "مربع میٹر",
    viewDetails: "تفصیلات دیکھیں",
    viewOnWebsite: "🌐 ویب سائٹ پر دیکھیں",
    shareProperty: "📤 شیئر کریں",

    comingSoon: "جلد آ رہا ہے",
    activeNow: "ابھی دستیاب",

    bookingStart: "📋 *پراپرٹی بک کریں*\n\nشہر منتخب کریں:",
    bookingSelectProperty: "🏠 *بکنگ کے لیے پراپرٹی منتخب کریں:*",
    bookingPropertySelected: "✅ پراپرٹی منتخب ہو گئی",
    bookingEnterCheckIn: "📅 *چیک ان تاریخ*\n\nتاریخ درج کریں: YYYY-MM-DD\n(مثال: 2026-05-01)",
    bookingEnterCheckOut: "📅 *چیک آؤٹ تاریخ*\n\nتاریخ درج کریں: YYYY-MM-DD\n(مثال: 2026-06-01)",
    bookingInvalidDate: "❌ غلط تاریخ۔ فارمیٹ: YYYY-MM-DD",
    bookingCheckOutBeforeCheckIn: "❌ چیک آؤٹ تاریخ چیک ان کے بعد ہونی چاہیے۔",
    bookingPastDate: "❌ گزشتہ تاریخ منتخب نہیں کی جا سکتی۔",
    bookingConfirmTitle: "📋 *بکنگ کی تصدیق*",
    bookingProperty: "🏠 پراپرٹی",
    bookingCity: "📍 شہر",
    bookingCheckIn: "📅 چیک ان",
    bookingCheckOut: "📅 چیک آؤٹ",
    bookingDuration: "⏱️ مدت",
    bookingMonths: "مہینے",
    bookingMonthlyRent: "💰 ماہانہ کرایہ",
    bookingDeposit: "🔒 سیکیورٹی ڈپازٹ",
    bookingServiceFee: "📄 سروس فیس",
    bookingVAT: "📊 VAT (15%)",
    bookingGrandTotal: "💵 کل رقم",
    bookingConfirmBtn: "✅ تصدیق کریں",
    bookingCancelBtn: "❌ منسوخ کریں",
    bookingPayBtn: "💳 ابھی ادائیگی کریں",
    bookingPayLaterBtn: "⏰ بعد میں ادائیگی",
    bookingConfirmed: "✅ *بکنگ کی درخواست جمع ہو گئی!*\n\nبکنگ نمبر: #",
    bookingCancelled: "❌ بکنگ منسوخ ہو گئی۔",
    bookingPaymentPrompt: "💳 *ادائیگی*\n\nادائیگی کا طریقہ منتخب کریں:",
    bookingPaid: "✅ *ادائیگی کامیاب!*\n\nشکریہ۔ آپ کی بکنگ کی تصدیق ہو گئی۔",
    bookingNotFound: "بکنگ نہیں ملی۔",
    myBookingsTitle: "📋 *میری بکنگز*",
    myBookingsEmpty: "آپ کی کوئی بکنگ نہیں ہے۔\n\nبکنگ کے لیے /book استعمال کریں۔",
    bookingStatusPending: "⏳ زیر غور",
    bookingStatusConfirmed: "✅ تصدیق شدہ",
    bookingStatusCancelled: "❌ منسوخ",
    bookingStatusActive: "🟢 فعال",
    bookingStatusCompleted: "✔️ مکمل",
    bookingPaymentPaid: "✅ ادا شدہ",
    bookingPaymentUnpaid: "⏳ غیر ادا شدہ",
    bookingNoProperties: "کوئی پراپرٹی نہیں ملی۔ دوسرے شہر میں تلاش کریں۔",
    sar: "SAR",

    paymentTitle: "Monthly Key بکنگ",
    paymentDescription: "Monthly Key کے ذریعے بکنگ کی ادائیگی",
    paymentSuccess: "✅ *ادائیگی کامیاب!*\n\nشکریہ! بکنگ #",
    paymentFailed: "❌ ادائیگی ناکام۔ دوبارہ کوشش کریں۔",
    paymentInvoiceSent: "💳 انوائس بھیج دی گئی۔ ادائیگی کا بٹن دبائیں۔",

    alertsTitle: "🔔 *پراپرٹی الرٹس*",
    alertsEmpty: "آپ کے کوئی فعال الرٹس نہیں ہیں۔\n\nالرٹ بنانے کے لیے /subscribe استعمال کریں۔",
    alertsListHeader: "🔔 *آپ کے فعال الرٹس:*\n",
    alertCity: "📍 شہر",
    alertPriceRange: "💰 قیمت کی حد",
    alertPropertyType: "🏷️ پراپرٹی کی قسم",
    alertBedrooms: "🛏️ کمرے",
    alertAny: "سب",
    alertDeleteBtn: "🗑️ حذف کریں",
    alertDeleteAllBtn: "🗑️ سب حذف کریں",
    alertDeleted: "✅ الرٹ حذف ہو گیا۔",
    alertAllDeleted: "✅ تمام الرٹس حذف ہو گئے۔",
    subscribeStart: "🔔 *الرٹس کے لیے سبسکرائب کریں*\n\nشہر منتخب کریں:",
    subscribeAllCities: "🌍 تمام شہر",
    subscribePricePrompt: "💰 *قیمت کی حد*\n\nکم از کم اور زیادہ سے زیادہ ماہانہ قیمت درج کریں (SAR میں):\n\nفارمیٹ: min-max\n(مثال: 3000-8000)\n\nیا 'skip' ٹائپ کریں",
    subscribeTypePrompt: "🏷️ *پراپرٹی کی قسم*\n\nقسم منتخب کریں:",
    subscribeAllTypes: "🏠 تمام اقسام",
    subscribeSuccess: "✅ *سبسکرپشن کامیاب!*\n\nمماثل پراپرٹیز ملنے پر آپ کو مطلع کیا جائے گا۔",
    subscribeInvalidPrice: "❌ غلط فارمیٹ۔ درج کریں: min-max (مثال: 3000-8000)",
    unsubscribePrompt: "🔕 *ان سبسکرائب*\n\nحذف کرنے کے لیے الرٹ منتخب کریں:",
    unsubscribeSuccess: "✅ ان سبسکرائب کامیاب۔",
    alertNotification: "🔔 *نئی پراپرٹی الرٹ!*\n\nایک نئی پراپرٹی آپ کے معیار سے مماثل ہے:",
  },

  // ─── Hindi (हिन्दी) ────────────────────────────────────────
  hi: {
    welcome: `🔑 *Monthly Key में आपका स्वागत है!*

सऊदी अरब में विश्वसनीय मासिक किराये का प्लेटफॉर्म।

रियाद और अन्य सऊदी शहरों में अपना आदर्श अपार्टमेंट खोजें। फर्निश्ड और अनफर्निश्ड प्रॉपर्टीज पारदर्शी कीमतों के साथ।

🏠 शुरू करने के लिए नीचे दिए गए बटन का उपयोग करें:`,

    help: `📖 *बॉट गाइड*

*उपलब्ध कमांड:*
/start — बातचीत शुरू करें
/search — प्रॉपर्टी खोजें
/book — प्रॉपर्टी बुक करें
/mybookings — मेरी बुकिंग
/alerts — अलर्ट प्रबंधित करें
/subscribe — अलर्ट के लिए सब्सक्राइब करें
/unsubscribe — अलर्ट से अनसब्सक्राइब करें
/language — भाषा बदलें
/notifications — नोटिफिकेशन सेटिंग्स
/help — यह गाइड दिखाएं

*इनलाइन सर्च:*
किसी भी चैट में @monthlykey\\_bot टाइप करें और शहर का नाम या कीवर्ड लिखें।

🌐 हमारी वेबसाइट: monthlykey.com`,

    searchPrompt: "🔍 *प्रॉपर्टी खोजें*\n\nशहर चुनें या खोज लिखें:",
    searchResults: "🏠 *खोज परिणाम:*",
    noResults: "कोई मिलान प्रॉपर्टी नहीं मिली। खोज मानदंड बदलें।",
    searching: "🔍 खोज जारी है...",
    error: "क्षमा करें, एक त्रुटि हुई। कृपया पुनः प्रयास करें।",
    languageChanged: "✅ भाषा हिन्दी में बदल दी गई",
    chooseLanguage: "🌐 भाषा चुनें:",

    btnSearch: "🔍 खोजें",
    btnFeatured: "⭐ विशेष प्रॉपर्टीज",
    btnOpenApp: "📱 ऐप खोलें",
    btnWebsite: "🌐 वेबसाइट",
    btnHelp: "❓ मदद",
    btnLanguage: "🌐 भाषा",
    btnNotifications: "🔔 नोटिफिकेशन",
    btnRiyadh: "🏙️ रियाद",
    btnJeddah: "🏙️ जेद्दा (जल्द)",
    btnMadinah: "🏙️ मदीना (जल्द)",
    btnAllCities: "🗺️ सभी शहर",
    btnBack: "◀️ वापस",

    notifSettings: `🔔 *नोटिफिकेशन सेटिंग्स*\n\nचुनें कि आप कौन सी नोटिफिकेशन प्राप्त करना चाहते हैं:`,
    notifNewProperties: "🏠 नई प्रॉपर्टीज",
    notifPriceDrops: "📉 मूल्य में कमी",
    notifBookings: "📋 बुकिंग अपडेट",
    notifEnabled: "✅ सक्रिय",
    notifDisabled: "❌ निष्क्रिय",
    notifUpdated: "✅ नोटिफिकेशन सेटिंग्स अपडेट हो गईं",

    perMonth: "SAR / मासिक",
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
    bookingEnterCheckIn: "📅 *चेक-इन तिथि*\n\nतिथि दर्ज करें: YYYY-MM-DD\n(उदाहरण: 2026-05-01)",
    bookingEnterCheckOut: "📅 *चेक-आउट तिथि*\n\nतिथि दर्ज करें: YYYY-MM-DD\n(उदाहरण: 2026-06-01)",
    bookingInvalidDate: "❌ अमान्य तिथि। प्रारूप: YYYY-MM-DD",
    bookingCheckOutBeforeCheckIn: "❌ चेक-आउट तिथि चेक-इन के बाद होनी चाहिए।",
    bookingPastDate: "❌ बीती हुई तिथि नहीं चुनी जा सकती।",
    bookingConfirmTitle: "📋 *बुकिंग की पुष्टि*",
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
    bookingConfirmBtn: "✅ पुष्टि करें",
    bookingCancelBtn: "❌ रद्द करें",
    bookingPayBtn: "💳 अभी भुगतान करें",
    bookingPayLaterBtn: "⏰ बाद में भुगतान",
    bookingConfirmed: "✅ *बुकिंग अनुरोध सबमिट हो गया!*\n\nबुकिंग नंबर: #",
    bookingCancelled: "❌ बुकिंग रद्द हो गई।",
    bookingPaymentPrompt: "💳 *भुगतान*\n\nभुगतान का तरीका चुनें:",
    bookingPaid: "✅ *भुगतान सफल!*\n\nधन्यवाद। आपकी बुकिंग की पुष्टि हो गई।",
    bookingNotFound: "बुकिंग नहीं मिली।",
    myBookingsTitle: "📋 *मेरी बुकिंग*",
    myBookingsEmpty: "आपकी कोई बुकिंग नहीं है।\n\nबुक करने के लिए /book का उपयोग करें।",
    bookingStatusPending: "⏳ विचाराधीन",
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
  { code: "fr", name: "Francais", flag: "🇫🇷" },
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
