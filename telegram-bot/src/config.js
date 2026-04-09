/**
 * Configuration for Monthly Key Telegram Bot
 * Phase 1-3
 */
require("dotenv").config();

const config = {
  // Telegram Bot
  botToken: process.env.BOT_TOKEN,

  // OpenAI
  openaiApiKey: process.env.OPENAI_API_KEY,
  aiModel: "gpt-4.1-mini",

  // API
  apiBaseUrl: process.env.API_BASE_URL || "https://monthlykey.com/api/trpc",

  // URLs
  // Mini App is served from tg.monthlykey.com (tg-client/ folder, same Railway backend)
  webappUrl: process.env.WEBAPP_URL || "https://tg.monthlykey.com",
  websiteUrl: process.env.WEBSITE_URL || "https://monthlykey.com",

  // Payment
  // Provider token from @BotFather for Telegram Payments
  paymentProviderToken: process.env.PAYMENT_PROVIDER_TOKEN || "",

  // Phase 3: Admin
  // Comma-separated list of Telegram user IDs that have admin access
  adminIds: (process.env.ADMIN_IDS || "")
    .split(",")
    .map((id) => parseInt(id.trim(), 10))
    .filter((id) => !isNaN(id)),

  // Phase 3: Channel Auto-Posting
  // Channel ID or @username to post new listings to
  channelId: process.env.CHANNEL_ID || "",
  // How often to check for new listings (in milliseconds), default 5 minutes
  channelCheckInterval: parseInt(process.env.CHANNEL_CHECK_INTERVAL, 10) || 300000,

  // Service Areas
  serviceAreas: [
    {
      id: "riyadh",
      name_ar: "الرياض",
      name_en: "Riyadh",
      status: "active",
      districts: [
        { ar: "العليا", en: "Al Olaya" },
        { ar: "الملز", en: "Al Malaz" },
        { ar: "السليمانية", en: "Al Sulaimaniyah" },
        { ar: "الياسمين", en: "Al Yasmin" },
        { ar: "النخيل", en: "Al Nakheel" },
        { ar: "الروضة", en: "Al Rawdah" },
        { ar: "المروج", en: "Al Muruj" },
        { ar: "الصحافة", en: "Al Sahafah" },
        { ar: "الربوة", en: "Al Rabwah" },
        { ar: "الورود", en: "Al Wurud" },
        { ar: "النرجس", en: "Al Narjis" },
        { ar: "الملقا", en: "Al Malqa" },
        { ar: "حطين", en: "Hittin" },
        { ar: "الرحمانية", en: "Al Rahmaniyah" },
        { ar: "الغدير", en: "Al Ghadir" },
        { ar: "العقيق", en: "Al Aqiq" },
        { ar: "الرمال", en: "Al Rimal" },
        { ar: "قرطبة", en: "Qurtubah" },
        { ar: "الحمراء", en: "Al Hamra" },
        { ar: "المونسية", en: "Al Munsiyah" },
        { ar: "الازدهار", en: "Al Izdihar" },
        { ar: "الشفا", en: "Al Shifa" },
        { ar: "العريجاء", en: "Al Uraija" },
        { ar: "الدرعية", en: "Al Diriyah" },
        { ar: "طويق", en: "Tuwaiq" },
        { ar: "الخزامى", en: "Al Khuzama" },
        { ar: "السفارات", en: "Diplomatic Quarter" },
        { ar: "الواحة", en: "Al Wahah" },
        { ar: "المصيف", en: "Al Masif" },
        { ar: "الفلاح", en: "Al Falah" },
      ],
    },
    {
      id: "jeddah",
      name_ar: "جدة",
      name_en: "Jeddah",
      status: "coming_soon",
      districts: [
        { ar: "الحمراء", en: "Al Hamra" },
        { ar: "الروضة", en: "Al Rawdah" },
        { ar: "الزهراء", en: "Al Zahra" },
        { ar: "الأندلس", en: "Al Andalus" },
        { ar: "الشاطئ", en: "Al Shati" },
        { ar: "المروة", en: "Al Marwah" },
        { ar: "الصفا", en: "Al Safa" },
        { ar: "النعيم", en: "Al Naeem" },
        { ar: "المحمدية", en: "Al Mohammadiyah" },
        { ar: "أبحر الشمالية", en: "Obhur North" },
        { ar: "أبحر الجنوبية", en: "Obhur South" },
        { ar: "الخالدية", en: "Al Khalidiyah" },
        { ar: "السلامة", en: "Al Salamah" },
        { ar: "البوادي", en: "Al Bawadi" },
        { ar: "الفيحاء", en: "Al Fayha" },
      ],
    },
    {
      id: "madinah",
      name_ar: "المدينة المنورة",
      name_en: "Madinah",
      status: "coming_soon",
      districts: [
        { ar: "الحرم", en: "Al Haram" },
        { ar: "قباء", en: "Quba" },
        { ar: "العزيزية", en: "Al Aziziyah" },
        { ar: "الإسكان", en: "Al Iskan" },
        { ar: "الخالدية", en: "Al Khalidiyah" },
        { ar: "العيون", en: "Al Uyun" },
        { ar: "أحد", en: "Uhud" },
        { ar: "الروضة", en: "Al Rawdah" },
        { ar: "النزهة", en: "Al Nuzha" },
        { ar: "بني بياضة", en: "Bani Bayada" },
        { ar: "العنابس", en: "Al Anabis" },
        { ar: "الدفاع", en: "Al Difa" },
      ],
    },
  ],

  // Property types mapping
  propertyTypes: {
    apartment: { en: "Apartment", ar: "شقة" },
    villa: { en: "Villa", ar: "فيلا" },
    studio: { en: "Studio", ar: "استوديو" },
    duplex: { en: "Duplex", ar: "دوبلكس" },
    furnished_room: { en: "Furnished Room", ar: "غرفة مفروشة" },
    compound: { en: "Compound", ar: "كمباوند" },
    hotel_apartment: { en: "Hotel Apartment", ar: "شقة فندقية" },
  },

  // Furnished levels
  furnishedLevels: {
    unfurnished: { en: "Unfurnished", ar: "غير مفروش" },
    semi_furnished: { en: "Semi Furnished", ar: "نصف مفروش" },
    fully_furnished: { en: "Fully Furnished", ar: "مفروش بالكامل" },
  },
};

module.exports = config;
