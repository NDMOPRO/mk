import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { cities, districts, roles } from "../drizzle/schema";
import { eq, sql } from "drizzle-orm";
import { ENV } from "./_core/env";

/**
 * Seed cities and districts for Saudi Arabia
 * Called on server startup to ensure data is available
 */
export async function seedCitiesAndDistricts() {
  const pool = mysql.createPool(ENV.databaseUrl);
  const db = drizzle(pool);

  try {
    // Check if cities already seeded
    const [cityCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(cities);
    if (cityCount.count >= 6) {
      console.log("[Seed] Cities already seeded, updating images...");
      // Always update city images to latest CDN URLs (fixes old Unsplash/Dubai images)
      const imageMap: Record<string, string> = {
        Riyadh: "https://d2xsxph8kpxj0f.cloudfront.net/310519663340926600/SVjftMwJXeVbFV32MvDGSY/city-riyadh-gBvDvbaArHxRTAuez5dnXn.webp",
        Jeddah: "https://d2xsxph8kpxj0f.cloudfront.net/310519663340926600/SVjftMwJXeVbFV32MvDGSY/city-jeddah-WFGmiJYKMNRSNaTnzq8qXt.webp",
        Madinah: "https://d2xsxph8kpxj0f.cloudfront.net/310519663340926600/SVjftMwJXeVbFV32MvDGSY/city-madinah-hxt4voaJVbMTWzXoSdVsd6.webp",
        Makkah: "https://d2xsxph8kpxj0f.cloudfront.net/310519663340926600/SVjftMwJXeVbFV32MvDGSY/city-makkah-oGPYddxbBFYkcXSUWcLYDB.webp",
        Dammam: "https://d2xsxph8kpxj0f.cloudfront.net/310519663340926600/SVjftMwJXeVbFV32MvDGSY/city-dammam-bZJNfjyoKPkeXDTR8RNW6z.webp",
        Khobar: "https://d2xsxph8kpxj0f.cloudfront.net/310519663340926600/SVjftMwJXeVbFV32MvDGSY/city-khobar-cjrqkEFq6b9jxdXNb7BmKx.webp",
        Tabuk: "https://d2xsxph8kpxj0f.cloudfront.net/310519663340926600/SVjftMwJXeVbFV32MvDGSY/city-tabuk-Ui8CmcjahN2oxD3bKY99z5.webp",
        Abha: "https://d2xsxph8kpxj0f.cloudfront.net/310519663340926600/SVjftMwJXeVbFV32MvDGSY/city-abha-TGsfEcdWqSoDPJ5Q6Ng78X.webp",
      };
      for (const [name, url] of Object.entries(imageMap)) {
        await db.update(cities).set({ imageUrl: url }).where(eq(cities.nameEn, name));
      }
      console.log("[Seed] City images updated to authentic Saudi CDN URLs.");
      await seedDefaultRoles(db);
      await seedAdditionalDistricts(db);
      return;
    }

    // ─── Cities ──────────────────────────────────────────────────────
    const cityData = [
      { nameEn: "Riyadh", nameAr: "الرياض", region: "Riyadh", regionAr: "منطقة الرياض", latitude: "24.7136", longitude: "46.6753", sortOrder: 1, isActive: true, imageUrl: "https://d2xsxph8kpxj0f.cloudfront.net/310519663340926600/SVjftMwJXeVbFV32MvDGSY/city-riyadh-gBvDvbaArHxRTAuez5dnXn.webp" },
      { nameEn: "Jeddah", nameAr: "جدة", region: "Makkah", regionAr: "منطقة مكة المكرمة", latitude: "21.5433", longitude: "39.1728", sortOrder: 2, isActive: false, imageUrl: "https://d2xsxph8kpxj0f.cloudfront.net/310519663340926600/SVjftMwJXeVbFV32MvDGSY/city-jeddah-WFGmiJYKMNRSNaTnzq8qXt.webp" },
      { nameEn: "Madinah", nameAr: "المدينة المنورة", region: "Madinah", regionAr: "منطقة المدينة المنورة", latitude: "24.4539", longitude: "39.6142", sortOrder: 3, isActive: false, imageUrl: "https://d2xsxph8kpxj0f.cloudfront.net/310519663340926600/SVjftMwJXeVbFV32MvDGSY/city-madinah-hxt4voaJVbMTWzXoSdVsd6.webp" },
      { nameEn: "Makkah", nameAr: "مكة المكرمة", region: "Makkah", regionAr: "منطقة مكة المكرمة", latitude: "21.3891", longitude: "39.8579", sortOrder: 4, isActive: false, imageUrl: "https://d2xsxph8kpxj0f.cloudfront.net/310519663340926600/SVjftMwJXeVbFV32MvDGSY/city-makkah-oGPYddxbBFYkcXSUWcLYDB.webp" },
      { nameEn: "Dammam", nameAr: "الدمام", region: "Eastern", regionAr: "المنطقة الشرقية", latitude: "26.4207", longitude: "50.0888", sortOrder: 5, isActive: false, imageUrl: "https://d2xsxph8kpxj0f.cloudfront.net/310519663340926600/SVjftMwJXeVbFV32MvDGSY/city-dammam-bZJNfjyoKPkeXDTR8RNW6z.webp" },
      { nameEn: "Khobar", nameAr: "الخبر", region: "Eastern", regionAr: "المنطقة الشرقية", latitude: "26.2172", longitude: "50.1971", sortOrder: 6, isActive: false, imageUrl: "https://d2xsxph8kpxj0f.cloudfront.net/310519663340926600/SVjftMwJXeVbFV32MvDGSY/city-khobar-cjrqkEFq6b9jxdXNb7BmKx.webp" },
      { nameEn: "Tabuk", nameAr: "تبوك", region: "Tabuk", regionAr: "منطقة تبوك", latitude: "28.3838", longitude: "36.5550", sortOrder: 7, isActive: false, imageUrl: "https://d2xsxph8kpxj0f.cloudfront.net/310519663340926600/SVjftMwJXeVbFV32MvDGSY/city-tabuk-Ui8CmcjahN2oxD3bKY99z5.webp" },
      { nameEn: "Abha", nameAr: "أبها", region: "Asir", regionAr: "منطقة عسير", latitude: "18.2164", longitude: "42.5053", sortOrder: 8, isActive: false, imageUrl: "https://d2xsxph8kpxj0f.cloudfront.net/310519663340926600/SVjftMwJXeVbFV32MvDGSY/city-abha-TGsfEcdWqSoDPJ5Q6Ng78X.webp" },
    ];

    for (const city of cityData) {
      const existing = await db.select().from(cities).where(eq(cities.nameEn, city.nameEn));
      if (existing.length === 0) {
        await db.insert(cities).values(city as any);
        console.log(`[Seed] City '${city.nameEn}' created.`);
      }
    }

    // Get city IDs
    const allCities = await db.select().from(cities);
    const cityMap = new Map(allCities.map(c => [c.nameEn, c.id]));

    // ─── Districts ───────────────────────────────────────────────────
    const districtData: Array<{ city: string; cityAr: string; cityId: number; nameEn: string; nameAr: string; latitude?: string; longitude?: string }> = [
      // Riyadh
      { city: "Riyadh", cityAr: "الرياض", cityId: cityMap.get("Riyadh")!, nameEn: "Al Olaya", nameAr: "العليا", latitude: "24.6900", longitude: "46.6850" },
      { city: "Riyadh", cityAr: "الرياض", cityId: cityMap.get("Riyadh")!, nameEn: "Al Malaz", nameAr: "الملز", latitude: "24.6600", longitude: "46.7300" },
      { city: "Riyadh", cityAr: "الرياض", cityId: cityMap.get("Riyadh")!, nameEn: "Al Sulaimaniyah", nameAr: "السليمانية", latitude: "24.6950", longitude: "46.6700" },
      { city: "Riyadh", cityAr: "الرياض", cityId: cityMap.get("Riyadh")!, nameEn: "Al Yasmin", nameAr: "الياسمين", latitude: "24.8200", longitude: "46.6400" },
      { city: "Riyadh", cityAr: "الرياض", cityId: cityMap.get("Riyadh")!, nameEn: "Al Nakheel", nameAr: "النخيل", latitude: "24.7700", longitude: "46.6300" },
      { city: "Riyadh", cityAr: "الرياض", cityId: cityMap.get("Riyadh")!, nameEn: "Al Rawdah", nameAr: "الروضة", latitude: "24.7100", longitude: "46.7400" },
      { city: "Riyadh", cityAr: "الرياض", cityId: cityMap.get("Riyadh")!, nameEn: "Al Muruj", nameAr: "المروج", latitude: "24.7500", longitude: "46.6500" },
      { city: "Riyadh", cityAr: "الرياض", cityId: cityMap.get("Riyadh")!, nameEn: "Al Sahafah", nameAr: "الصحافة", latitude: "24.8100", longitude: "46.6600" },
      { city: "Riyadh", cityAr: "الرياض", cityId: cityMap.get("Riyadh")!, nameEn: "Al Rabwah", nameAr: "الربوة", latitude: "24.6800", longitude: "46.7200" },
      { city: "Riyadh", cityAr: "الرياض", cityId: cityMap.get("Riyadh")!, nameEn: "Al Wurud", nameAr: "الورود", latitude: "24.7000", longitude: "46.6700" },

      // Jeddah
      { city: "Jeddah", cityAr: "جدة", cityId: cityMap.get("Jeddah")!, nameEn: "Al Rawdah", nameAr: "الروضة", latitude: "21.5800", longitude: "39.1600" },
      { city: "Jeddah", cityAr: "جدة", cityId: cityMap.get("Jeddah")!, nameEn: "Al Salamah", nameAr: "السلامة", latitude: "21.5700", longitude: "39.1500" },
      { city: "Jeddah", cityAr: "جدة", cityId: cityMap.get("Jeddah")!, nameEn: "Al Hamra", nameAr: "الحمراء", latitude: "21.5500", longitude: "39.1700" },
      { city: "Jeddah", cityAr: "جدة", cityId: cityMap.get("Jeddah")!, nameEn: "Al Zahra", nameAr: "الزهراء", latitude: "21.5600", longitude: "39.1400" },
      { city: "Jeddah", cityAr: "جدة", cityId: cityMap.get("Jeddah")!, nameEn: "Al Andalus", nameAr: "الأندلس", latitude: "21.5400", longitude: "39.1300" },
      { city: "Jeddah", cityAr: "جدة", cityId: cityMap.get("Jeddah")!, nameEn: "Al Shati", nameAr: "الشاطئ", latitude: "21.5900", longitude: "39.1100" },
      { city: "Jeddah", cityAr: "جدة", cityId: cityMap.get("Jeddah")!, nameEn: "Al Marwah", nameAr: "المروة", latitude: "21.5300", longitude: "39.1800" },
      { city: "Jeddah", cityAr: "جدة", cityId: cityMap.get("Jeddah")!, nameEn: "Al Safa", nameAr: "الصفا", latitude: "21.5650", longitude: "39.1550" },
      { city: "Jeddah", cityAr: "جدة", cityId: cityMap.get("Jeddah")!, nameEn: "Al Naeem", nameAr: "النعيم", latitude: "21.5750", longitude: "39.1650" },
      { city: "Jeddah", cityAr: "جدة", cityId: cityMap.get("Jeddah")!, nameEn: "Al Mohammadiyah", nameAr: "المحمدية", latitude: "21.5850", longitude: "39.1250" },

      // Madinah
      { city: "Madinah", cityAr: "المدينة المنورة", cityId: cityMap.get("Madinah")!, nameEn: "Al Haram", nameAr: "الحرم", latitude: "24.4672", longitude: "39.6112" },
      { city: "Madinah", cityAr: "المدينة المنورة", cityId: cityMap.get("Madinah")!, nameEn: "Quba", nameAr: "قباء", latitude: "24.4400", longitude: "39.6200" },
      { city: "Madinah", cityAr: "المدينة المنورة", cityId: cityMap.get("Madinah")!, nameEn: "Al Aziziyah", nameAr: "العزيزية", latitude: "24.4500", longitude: "39.6000" },
      { city: "Madinah", cityAr: "المدينة المنورة", cityId: cityMap.get("Madinah")!, nameEn: "Al Iskan", nameAr: "الإسكان", latitude: "24.4300", longitude: "39.5900" },
      { city: "Madinah", cityAr: "المدينة المنورة", cityId: cityMap.get("Madinah")!, nameEn: "Al Khalidiyah", nameAr: "الخالدية", latitude: "24.4600", longitude: "39.5800" },
      { city: "Madinah", cityAr: "المدينة المنورة", cityId: cityMap.get("Madinah")!, nameEn: "Al Uyun", nameAr: "العيون", latitude: "24.4700", longitude: "39.5700" },
      { city: "Madinah", cityAr: "المدينة المنورة", cityId: cityMap.get("Madinah")!, nameEn: "Uhud", nameAr: "أحد", latitude: "24.4900", longitude: "39.6100" },
      { city: "Madinah", cityAr: "المدينة المنورة", cityId: cityMap.get("Madinah")!, nameEn: "Al Rawdah", nameAr: "الروضة", latitude: "24.4800", longitude: "39.6300" },
      { city: "Madinah", cityAr: "المدينة المنورة", cityId: cityMap.get("Madinah")!, nameEn: "Al Nuzha", nameAr: "النزهة", latitude: "24.4550", longitude: "39.6050" },
      { city: "Madinah", cityAr: "المدينة المنورة", cityId: cityMap.get("Madinah")!, nameEn: "Bani Bayada", nameAr: "بني بياضة", latitude: "24.4650", longitude: "39.5950" },

      // Makkah
      { city: "Makkah", cityAr: "مكة المكرمة", cityId: cityMap.get("Makkah")!, nameEn: "Al Aziziyah", nameAr: "العزيزية", latitude: "21.4000", longitude: "39.8400" },
      { city: "Makkah", cityAr: "مكة المكرمة", cityId: cityMap.get("Makkah")!, nameEn: "Al Shawqiyah", nameAr: "الشوقية", latitude: "21.4100", longitude: "39.8200" },
      { city: "Makkah", cityAr: "مكة المكرمة", cityId: cityMap.get("Makkah")!, nameEn: "Al Naseem", nameAr: "النسيم", latitude: "21.3800", longitude: "39.8700" },
      { city: "Makkah", cityAr: "مكة المكرمة", cityId: cityMap.get("Makkah")!, nameEn: "Al Awali", nameAr: "العوالي", latitude: "21.3700", longitude: "39.8800" },
      { city: "Makkah", cityAr: "مكة المكرمة", cityId: cityMap.get("Makkah")!, nameEn: "Al Rusayfah", nameAr: "الرصيفة", latitude: "21.3900", longitude: "39.8300" },
      { city: "Makkah", cityAr: "مكة المكرمة", cityId: cityMap.get("Makkah")!, nameEn: "Al Zahir", nameAr: "الزاهر", latitude: "21.3950", longitude: "39.8500" },
      { city: "Makkah", cityAr: "مكة المكرمة", cityId: cityMap.get("Makkah")!, nameEn: "Al Hamra", nameAr: "الحمراء", latitude: "21.4050", longitude: "39.8600" },
      { city: "Makkah", cityAr: "مكة المكرمة", cityId: cityMap.get("Makkah")!, nameEn: "Batha Quraysh", nameAr: "بطحاء قريش", latitude: "21.3850", longitude: "39.8450" },
      { city: "Makkah", cityAr: "مكة المكرمة", cityId: cityMap.get("Makkah")!, nameEn: "Al Kakiyah", nameAr: "الكعكية", latitude: "21.4150", longitude: "39.8350" },
      { city: "Makkah", cityAr: "مكة المكرمة", cityId: cityMap.get("Makkah")!, nameEn: "Al Hijrah", nameAr: "الهجرة", latitude: "21.3750", longitude: "39.8550" },

      // Dammam
      { city: "Dammam", cityAr: "الدمام", cityId: cityMap.get("Dammam")!, nameEn: "Al Faisaliyah", nameAr: "الفيصلية", latitude: "26.4300", longitude: "50.1000" },
      { city: "Dammam", cityAr: "الدمام", cityId: cityMap.get("Dammam")!, nameEn: "Al Shati", nameAr: "الشاطئ", latitude: "26.4400", longitude: "50.1200" },
      { city: "Dammam", cityAr: "الدمام", cityId: cityMap.get("Dammam")!, nameEn: "Al Mazrouiyah", nameAr: "المزروعية", latitude: "26.4100", longitude: "50.0900" },
      { city: "Dammam", cityAr: "الدمام", cityId: cityMap.get("Dammam")!, nameEn: "Al Jalawiyah", nameAr: "الجلوية", latitude: "26.4200", longitude: "50.0800" },
      { city: "Dammam", cityAr: "الدمام", cityId: cityMap.get("Dammam")!, nameEn: "Al Anwar", nameAr: "الأنوار", latitude: "26.4000", longitude: "50.0700" },
      { city: "Dammam", cityAr: "الدمام", cityId: cityMap.get("Dammam")!, nameEn: "Al Khaleej", nameAr: "الخليج", latitude: "26.4500", longitude: "50.1100" },
      { city: "Dammam", cityAr: "الدمام", cityId: cityMap.get("Dammam")!, nameEn: "Al Firdaws", nameAr: "الفردوس", latitude: "26.3900", longitude: "50.0600" },
      { city: "Dammam", cityAr: "الدمام", cityId: cityMap.get("Dammam")!, nameEn: "Al Nada", nameAr: "الندى", latitude: "26.4350", longitude: "50.0950" },
      { city: "Dammam", cityAr: "الدمام", cityId: cityMap.get("Dammam")!, nameEn: "Al Aziziyah", nameAr: "العزيزية", latitude: "26.4150", longitude: "50.0850" },
      { city: "Dammam", cityAr: "الدمام", cityId: cityMap.get("Dammam")!, nameEn: "Al Rayyan", nameAr: "الريان", latitude: "26.4050", longitude: "50.0750" },

      // Khobar
      { city: "Khobar", cityAr: "الخبر", cityId: cityMap.get("Khobar")!, nameEn: "Al Hizam Al Dhahabi", nameAr: "الحزام الذهبي", latitude: "26.2800", longitude: "50.2100" },
      { city: "Khobar", cityAr: "الخبر", cityId: cityMap.get("Khobar")!, nameEn: "Al Aqrabiyah", nameAr: "العقربية", latitude: "26.2700", longitude: "50.2000" },
      { city: "Khobar", cityAr: "الخبر", cityId: cityMap.get("Khobar")!, nameEn: "North Khobar", nameAr: "الخبر الشمالية", latitude: "26.2900", longitude: "50.2200" },
      { city: "Khobar", cityAr: "الخبر", cityId: cityMap.get("Khobar")!, nameEn: "South Khobar", nameAr: "الخبر الجنوبية", latitude: "26.2100", longitude: "50.1900" },
      { city: "Khobar", cityAr: "الخبر", cityId: cityMap.get("Khobar")!, nameEn: "Al Thuqbah", nameAr: "الثقبة", latitude: "26.2500", longitude: "50.2050" },
      { city: "Khobar", cityAr: "الخبر", cityId: cityMap.get("Khobar")!, nameEn: "Al Rakah", nameAr: "الراكة", latitude: "26.2600", longitude: "50.2150" },
      { city: "Khobar", cityAr: "الخبر", cityId: cityMap.get("Khobar")!, nameEn: "Al Yarmouk", nameAr: "اليرموك", latitude: "26.2400", longitude: "50.1950" },
      { city: "Khobar", cityAr: "الخبر", cityId: cityMap.get("Khobar")!, nameEn: "Al Safa", nameAr: "الصفا", latitude: "26.2300", longitude: "50.1850" },
      { city: "Khobar", cityAr: "الخبر", cityId: cityMap.get("Khobar")!, nameEn: "Al Bandariyah", nameAr: "البندرية", latitude: "26.2200", longitude: "50.2250" },
      { city: "Khobar", cityAr: "الخبر", cityId: cityMap.get("Khobar")!, nameEn: "Al Tahliyah", nameAr: "التحلية", latitude: "26.2750", longitude: "50.2080" },

      // Tabuk
      { city: "Tabuk", cityAr: "تبوك", cityId: cityMap.get("Tabuk")!, nameEn: "Al Faisaliyah", nameAr: "الفيصلية", latitude: "28.3900", longitude: "36.5600" },
      { city: "Tabuk", cityAr: "تبوك", cityId: cityMap.get("Tabuk")!, nameEn: "Al Muruj", nameAr: "المروج", latitude: "28.3800", longitude: "36.5500" },
      { city: "Tabuk", cityAr: "تبوك", cityId: cityMap.get("Tabuk")!, nameEn: "Al Sulaimaniyah", nameAr: "السليمانية", latitude: "28.3700", longitude: "36.5400" },
      { city: "Tabuk", cityAr: "تبوك", cityId: cityMap.get("Tabuk")!, nameEn: "Al Rabwah", nameAr: "الربوة", latitude: "28.3950", longitude: "36.5650" },
      { city: "Tabuk", cityAr: "تبوك", cityId: cityMap.get("Tabuk")!, nameEn: "Al Nakheel", nameAr: "النخيل", latitude: "28.3750", longitude: "36.5450" },
      { city: "Tabuk", cityAr: "تبوك", cityId: cityMap.get("Tabuk")!, nameEn: "Al Wurud", nameAr: "الورود", latitude: "28.3850", longitude: "36.5550" },
      { city: "Tabuk", cityAr: "تبوك", cityId: cityMap.get("Tabuk")!, nameEn: "Al Masif", nameAr: "المصيف", latitude: "28.4000", longitude: "36.5700" },
      { city: "Tabuk", cityAr: "تبوك", cityId: cityMap.get("Tabuk")!, nameEn: "Al Aziziyah", nameAr: "العزيزية", latitude: "28.3650", longitude: "36.5350" },
      { city: "Tabuk", cityAr: "تبوك", cityId: cityMap.get("Tabuk")!, nameEn: "Al Rawdah", nameAr: "الروضة", latitude: "28.3550", longitude: "36.5250" },
      { city: "Tabuk", cityAr: "تبوك", cityId: cityMap.get("Tabuk")!, nameEn: "Al Rayyan", nameAr: "الريان", latitude: "28.4050", longitude: "36.5750" },

      // Abha
      { city: "Abha", cityAr: "أبها", cityId: cityMap.get("Abha")!, nameEn: "Al Mansak", nameAr: "المنسك", latitude: "18.2200", longitude: "42.5100" },
      { city: "Abha", cityAr: "أبها", cityId: cityMap.get("Abha")!, nameEn: "Al Khalidiyah", nameAr: "الخالدية", latitude: "18.2300", longitude: "42.5200" },
      { city: "Abha", cityAr: "أبها", cityId: cityMap.get("Abha")!, nameEn: "Al Rabwah", nameAr: "الربوة", latitude: "18.2100", longitude: "42.5000" },
      { city: "Abha", cityAr: "أبها", cityId: cityMap.get("Abha")!, nameEn: "Al Miftahah", nameAr: "المفتاحة", latitude: "18.2250", longitude: "42.5050" },
      { city: "Abha", cityAr: "أبها", cityId: cityMap.get("Abha")!, nameEn: "Al Dhubab", nameAr: "الضباب", latitude: "18.2350", longitude: "42.5150" },
      { city: "Abha", cityAr: "أبها", cityId: cityMap.get("Abha")!, nameEn: "Al Naseem", nameAr: "النسيم", latitude: "18.2050", longitude: "42.4950" },
      { city: "Abha", cityAr: "أبها", cityId: cityMap.get("Abha")!, nameEn: "Al Wardatain", nameAr: "الوردتين", latitude: "18.2150", longitude: "42.5250" },
      { city: "Abha", cityAr: "أبها", cityId: cityMap.get("Abha")!, nameEn: "Al Muwadhafeen", nameAr: "الموظفين", latitude: "18.2000", longitude: "42.4900" },
      { city: "Abha", cityAr: "أبها", cityId: cityMap.get("Abha")!, nameEn: "Shamsan", nameAr: "شمسان", latitude: "18.2400", longitude: "42.5300" },
      { city: "Abha", cityAr: "أبها", cityId: cityMap.get("Abha")!, nameEn: "Al Sadd", nameAr: "السد", latitude: "18.1950", longitude: "42.4850" },
    ];

    // Insert districts in batches
    const batchSize = 20;
    for (let i = 0; i < districtData.length; i += batchSize) {
      const batch = districtData.slice(i, i + batchSize);
      await db.insert(districts).values(batch as any[]);
    }
    console.log(`[Seed] ${districtData.length} districts seeded across 8 cities.`);

    // Seed default roles
    await seedDefaultRoles(db);
    // Seed additional districts for Riyadh, Jeddah, Madinah
    await seedAdditionalDistricts(db);

  } catch (error) {
    console.error("[Seed] Error seeding cities/districts:", error);
  }
}

async function seedDefaultRoles(db: ReturnType<typeof drizzle>) {
  try {
    const defaultRoles = [
      {
        name: "Super Admin",
        nameAr: "مدير عام",
        description: "Full system access with all permissions",
        descriptionAr: "صلاحيات كاملة للنظام",
        permissions: JSON.stringify([
          "properties.view", "properties.create", "properties.edit", "properties.delete",
          "bookings.view", "bookings.create", "bookings.approve", "bookings.cancel",
          "users.view", "users.edit", "users.delete", "users.roles",
          "payments.view", "payments.process",
          "services.view", "services.manage",
          "maintenance.view", "maintenance.manage",
          "settings.view", "settings.edit",
          "analytics.view",
          "notifications.send",
          "cms.edit",
        ]),
        isSystem: true,
      },
      {
        name: "Property Manager",
        nameAr: "مدير عقارات",
        description: "Manage properties, bookings, and tenants",
        descriptionAr: "إدارة العقارات والحجوزات والمستأجرين",
        permissions: JSON.stringify([
          "properties.view", "properties.create", "properties.edit",
          "bookings.view", "bookings.approve", "bookings.cancel",
          "users.view",
          "payments.view",
          "services.view", "services.manage",
          "maintenance.view", "maintenance.manage",
        ]),
        isSystem: true,
      },
      {
        name: "Accountant",
        nameAr: "محاسب",
        description: "View and manage financial records",
        descriptionAr: "عرض وإدارة السجلات المالية",
        permissions: JSON.stringify([
          "properties.view",
          "bookings.view",
          "payments.view", "payments.process",
          "analytics.view",
        ]),
        isSystem: true,
      },
      {
        name: "Support Agent",
        nameAr: "موظف دعم",
        description: "Handle service requests and maintenance",
        descriptionAr: "معالجة طلبات الخدمات والصيانة",
        permissions: JSON.stringify([
          "properties.view",
          "bookings.view",
          "users.view",
          "services.view", "services.manage",
          "maintenance.view", "maintenance.manage",
        ]),
        isSystem: true,
      },
      {
        name: "Viewer",
        nameAr: "مشاهد",
        description: "Read-only access to the system",
        descriptionAr: "صلاحية عرض فقط",
        permissions: JSON.stringify([
          "properties.view",
          "bookings.view",
          "users.view",
          "payments.view",
          "analytics.view",
        ]),
        isSystem: true,
      },
      {
        name: "Operations Manager",
        nameAr: "مدير العمليات",
        description: "Oversee daily operations, properties, bookings, and maintenance",
        descriptionAr: "الإشراف على العمليات اليومية والعقارات والحجوزات والصيانة",
        permissions: JSON.stringify([
          "properties.view", "properties.create", "properties.edit",
          "bookings.view", "bookings.create", "bookings.approve", "bookings.cancel",
          "users.view",
          "payments.view", "payments.process",
          "services.view", "services.manage",
          "maintenance.view", "maintenance.manage",
          "settings.view",
          "analytics.view",
        ]),
        isSystem: false,
      },
      {
        name: "CFO",
        nameAr: "المدير المالي",
        description: "Full access to financial records, payments, and analytics",
        descriptionAr: "صلاحيات كاملة للسجلات المالية والمدفوعات والتحليلات",
        permissions: JSON.stringify([
          "properties.view",
          "bookings.view",
          "payments.view", "payments.process",
          "analytics.view",
          "settings.view",
        ]),
        isSystem: false,
      },
    ];

    // Seed each role individually (skip if already exists by name)
    let seeded = 0;
    for (const role of defaultRoles) {
      const [existing] = await db.select({ count: sql<number>`COUNT(*)` }).from(roles).where(eq(roles.name, role.name));
      if (existing.count === 0) {
        await db.insert(roles).values(role as any);
        seeded++;
      }
    }
    if (seeded > 0) {
      console.log(`[Seed] ${seeded} new roles seeded.`);
    } else {
      console.log("[Seed] All roles already exist, skipping.");
    }
  } catch (error) {
    console.error("[Seed] Error seeding roles:", error);
  }
}

/**
 * Seed additional districts for Riyadh, Jeddah, and Madinah.
 * Only adds districts that don't already exist (checked by nameAr + city).
 * All new districts are added as inactive (isActive: false).
 */
async function seedAdditionalDistricts(db: ReturnType<typeof drizzle>) {
  try {
    // Get city IDs
    const allCities = await db.select().from(cities);
    const cityIdMap = new Map<string, number>();
    for (const c of allCities) {
      cityIdMap.set(c.nameEn, c.id);
    }

    // Get all existing districts to avoid duplicates
    const existingDistricts = await db.select({
      nameAr: districts.nameAr,
      city: districts.city,
    }).from(districts);

    const existingSet = new Set(
      existingDistricts.map((d) => `${d.nameAr}__${d.city}`)
    );

    const additionalDistricts: Array<{ city: string; cityAr: string; nameEn: string; nameAr: string; isActive: boolean }> = [
      // ─── Riyadh additional districts ───
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Falah", nameAr: "الفلاح", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Wadi", nameAr: "الوادي", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Nada", nameAr: "الندى", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Rabi", nameAr: "الربيع", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Nafl", nameAr: "النفل", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Ghadir", nameAr: "الغدير", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Aqiq", nameAr: "العقيق", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Hittin", nameAr: "حطين", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Malqa", nameAr: "الملقا", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Narjis", nameAr: "النرجس", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Arid", nameAr: "العارض", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Qairawan", nameAr: "القيروان", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Banban", nameAr: "بنبان", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Mughrazat", nameAr: "المغرزات", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Izdihar", nameAr: "الازدهار", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "King Abdulaziz", nameAr: "الملك عبد العزيز", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "King Abdullah South", nameAr: "الملك عبد الله الجنوبي", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "King Abdullah North", nameAr: "الملك عبد الله الشمالي", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Wahah", nameAr: "الواحة", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Salah Al Din", nameAr: "صلاح الدين", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "King Fahd", nameAr: "الملك فهد", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Mursalat", nameAr: "المرسلات", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Nuzha", nameAr: "النزهة", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Taawun", nameAr: "التعاون", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Masif", nameAr: "المصيف", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Rimal", nameAr: "الرمال", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Munisiyah", nameAr: "المونسية", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Qurtubah", nameAr: "قرطبة", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Janadriyah", nameAr: "الجنادرية", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Qadisiyah", nameAr: "القادسية", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Yarmuk", nameAr: "اليرموك", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Ghirnatah", nameAr: "غرناطة", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Ishbiliyah", nameAr: "أشبيلية", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Hamra", nameAr: "الحمراء", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Muaiziliyah", nameAr: "المعيزلية", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Khaleej", nameAr: "الخليج", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "King Faisal", nameAr: "الملك فيصل", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Quds", nameAr: "القدس", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Nahdah", nameAr: "النهضة", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Andalus", nameAr: "الأندلس", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Mathar", nameAr: "المعذر", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Mohammadiyah", nameAr: "المحمدية", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Rahmaniyah", nameAr: "الرحمانية", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Raid", nameAr: "الرائد", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Umm Al Hamam East", nameAr: "أم الحمام الشرقي", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Umm Al Hamam West", nameAr: "أم الحمام الغربي", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Safarat", nameAr: "السفارات", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Mahdiyah", nameAr: "المهدية", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Irqah", nameAr: "عرقة", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Dhahrat Laban", nameAr: "ظهرة لبن", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Khuzama", nameAr: "الخزامى", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Naseem East", nameAr: "النسيم الشرقي", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Naseem West", nameAr: "النسيم الغربي", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Salam", nameAr: "السلام", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Rayyan", nameAr: "الريان", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Rawabi", nameAr: "الروابي", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Nadheem", nameAr: "النظيم", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Manar", nameAr: "المنار", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Nadwah", nameAr: "الندوة", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Jarir", nameAr: "جرير", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Zahra", nameAr: "الزهراء", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Safa", nameAr: "الصفا", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Dubbat", nameAr: "الضباط", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Wizarat", nameAr: "الوزارات", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Faruq", nameAr: "الفاروق", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Amal", nameAr: "العمل", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Thulaim", nameAr: "ثليم", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Murabba", nameAr: "المربع", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Futah", nameAr: "الفوطة", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Rafiah", nameAr: "الرفيعة", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Hada", nameAr: "الهدا", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Sharqiyah", nameAr: "الشرقية", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Nasiriyah", nameAr: "الناصرية", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Siyah", nameAr: "صياح", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Wisham", nameAr: "الوشام", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Namudhajiyah", nameAr: "النموذجية", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Mutamarat", nameAr: "المؤتمرات", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Badiah", nameAr: "البديعة", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Umm Sulaim", nameAr: "أم سليم", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Shumaisi", nameAr: "الشميسي", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Jaradiyah", nameAr: "الجرادية", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Fakhriyah", nameAr: "الفاخرية", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Ulaysha", nameAr: "عليشة", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Hijrat Wadi Laban", nameAr: "هجرة وادي لبن", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Urayja", nameAr: "العريجاء", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Urayja Central", nameAr: "العريجاء الوسطى", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Urayja West", nameAr: "العريجاء الغربية", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Duraihimiyah", nameAr: "الدريهمية", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Shubra", nameAr: "شبرا", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Suwaidi", nameAr: "السويدي", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Suwaidi West", nameAr: "السويدي الغربي", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Dhahrat Al Badiah", nameAr: "ظهرة البديعة", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Sultanah", nameAr: "سلطانة", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Zahrah", nameAr: "الزهرة", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Wadi Laban", nameAr: "وادي لبن", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Dhahrat Namar", nameAr: "ظهرة نمار", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Dirab", nameAr: "ديراب", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Namar", nameAr: "نمار", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Hazm", nameAr: "الحزم", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Tuwaiq", nameAr: "طويق", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Uhud", nameAr: "أحد", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Ukaz", nameAr: "عكاظ", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Shifa", nameAr: "الشفاء", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Shualan", nameAr: "الشعلان", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Marwah", nameAr: "المروة", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Badr", nameAr: "بدر", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Masani", nameAr: "المصانع", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Mansuriyah", nameAr: "المنصورية", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Uraid", nameAr: "عريض", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Amajiyah", nameAr: "العماجية", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Khashm Al Aan", nameAr: "خشم العان", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Difaa", nameAr: "الدفاع", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Manakh", nameAr: "المناخ", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Sili", nameAr: "السلي", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Noor", nameAr: "النور", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Iskan", nameAr: "الإسكان", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Sinaiyah Al Jadidah", nameAr: "الصناعية الجديدة", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Fayha", nameAr: "الفيحاء", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Jazirah", nameAr: "الجزيرة", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Saadah", nameAr: "السعادة", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Heet", nameAr: "هيت", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Bariyah", nameAr: "البرية", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Mashael", nameAr: "المشاعل", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Batha", nameAr: "البطحاء", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Dubiyah", nameAr: "الدوبية", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Qura", nameAr: "القرى", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Sinaiyah", nameAr: "الصناعية", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Wusayta", nameAr: "الوسيطاء", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Mankal", nameAr: "معكال", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Faisaliyah", nameAr: "الفيصلية", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Manfuhah", nameAr: "منفوحة", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Mansurah", nameAr: "المنصورة", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Yamamah", nameAr: "اليمامة", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Salam", nameAr: "سلام", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Jabrah", nameAr: "جبرة", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Atiqah", nameAr: "عتيقة", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Ghubayra", nameAr: "غبيراء", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Butaiha", nameAr: "البطيحا", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Khalidiyah", nameAr: "الخالدية", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Dirah", nameAr: "الديرة", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Dhahirah", nameAr: "الظهيرة", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Oud", nameAr: "العود", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Murqab", nameAr: "المرقب", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Manfuhah Al Jadidah", nameAr: "منفوحة الجديدة", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Dahu", nameAr: "الدحو", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Sukayrinah", nameAr: "سكيرينة", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Aziziyah", nameAr: "العزيزية", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Taibah", nameAr: "طيبة", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Misfat", nameAr: "المصفاة", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Dar Al Bayda", nameAr: "الدار البيضاء", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Hair", nameAr: "الحاير", isActive: false },
      { city: "Riyadh", cityAr: "الرياض", nameEn: "Al Ghanamiyah", nameAr: "الغنامية", isActive: false },
      // ─── Jeddah additional districts ───
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Kanadirah", nameAr: "الكنادرة", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Baharah", nameAr: "البحارة", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Sawalihah", nameAr: "الصوالحة", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Shuruq", nameAr: "الشروق", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Zanabiqah", nameAr: "الزنابقة", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Sarahin", nameAr: "السراحين", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Shamiyah", nameAr: "الشامية", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Muqayta", nameAr: "المقيطع", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Ghawla", nameAr: "الغولاء", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Khalij Salman", nameAr: "خليج سلمان", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Abhur Al Shamaliyah", nameAr: "أبحر الشمالية", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Corniche", nameAr: "الكورنيش", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Dhahban East", nameAr: "ذهبان الشرقي", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Dhahban West", nameAr: "ذهبان الغربي", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Shati Al Dhahabi", nameAr: "الشاطئ الذهبي", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Ajwad", nameAr: "الأجواد", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Manar", nameAr: "المنار", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Samir", nameAr: "السامر", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Huda", nameAr: "الهدى", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Hamdaniyah", nameAr: "الحمدانية", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Salihiyah", nameAr: "الصالحية", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Majid", nameAr: "الماجد", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Nahdah", nameAr: "النهضة", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Basatin", nameAr: "البساتين", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Murjan", nameAr: "المرجان", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Abhur Al Janubi", nameAr: "أبحر الجنوبي", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Nuzha", nameAr: "النزهة", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Rabwah", nameAr: "الربوة", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Bawadi", nameAr: "البوادي", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Faisaliyah", nameAr: "الفيصلية", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Zahrah", nameAr: "الزهرة", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Khalidiyah", nameAr: "الخالدية", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Mahamid", nameAr: "المحاميد", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Harazat", nameAr: "الحرازات", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Wahah", nameAr: "الواحة", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Muntazahat", nameAr: "المنتزهات", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Nakheel", nameAr: "النخيل", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Salimiyah", nameAr: "السالمية", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Sulaimaniyah East", nameAr: "السليمانية الشرقية", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Aziziyah", nameAr: "العزيزية", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Mushrifah", nameAr: "مشرفة", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Rihab", nameAr: "الرحاب", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Baghdadiyah", nameAr: "البغدادية", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Naseem", nameAr: "النسيم", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Bani Malik", nameAr: "بني مالك", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Wurud", nameAr: "الورود", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Sharafiyah", nameAr: "الشرفية", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Ruwais", nameAr: "الرويس", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Rawabi", nameAr: "الروابي", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Jamiah", nameAr: "الجامعة", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Sulaimaniyah", nameAr: "السليمانية", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Fayha", nameAr: "الفيحاء", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Thaghr", nameAr: "الثغر", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Nazlah Al Yamaniyah", nameAr: "النزلة اليمانية", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Nazlah Al Sharqiyah", nameAr: "النزلة الشرقية", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Qurayyat", nameAr: "القريات", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Thaalibah", nameAr: "الثعالبة", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Petromin", nameAr: "بترومين", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Ghulail", nameAr: "غليل", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Madain Al Fahd", nameAr: "مدائن الفهد", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Adl West", nameAr: "العدل الغربي", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Waziriyah", nameAr: "الوزيرية", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Kandarah", nameAr: "الكندرة", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Baghdadiyah East", nameAr: "البغدادية الشرقية", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Baghdadiyah West", nameAr: "البغدادية الغربية", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Hindawiyah", nameAr: "الهنداوية", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Sabil", nameAr: "السبيل", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Sahifah", nameAr: "الصحيفة", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Amariyah", nameAr: "العمارية", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Balad", nameAr: "البلد", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Mazlum", nameAr: "المظلوم", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Sham", nameAr: "الشام", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Yaman", nameAr: "اليمن", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Bahr", nameAr: "البحر", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Amir Fawaz South", nameAr: "الأمير فواز الجنوبي", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Amir Fawaz North", nameAr: "الأمير فواز الشمالي", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Amir Abdulmajid", nameAr: "الأمير عبد المجيد", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Adl", nameAr: "العدل", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Umm Al Silm", nameAr: "أم السلم", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Hudhayfat", nameAr: "الحذيفات", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Mursalat", nameAr: "المرسلات", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Ajawid", nameAr: "الأجاويد", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Khalid South", nameAr: "خالد الجنوبي", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Shifa", nameAr: "الشفا", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Fal", nameAr: "فال", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Jawharah", nameAr: "الجوهرة", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Sanabil", nameAr: "السنابل", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Suruuriyah", nameAr: "السرورية", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Qurainiyah", nameAr: "القرينية", isActive: false },
      { city: "Jeddah", cityAr: "جدة", nameEn: "Al Qawzain", nameAr: "القوزين", isActive: false },
      // ─── Madinah additional districts ───
      { city: "Madinah", cityAr: "المدينة المنورة", nameEn: "King Fahd", nameAr: "الملك فهد", isActive: false },
      { city: "Madinah", cityAr: "المدينة المنورة", nameEn: "Al Rabwah", nameAr: "الربوة", isActive: false },
      { city: "Madinah", cityAr: "المدينة المنورة", nameEn: "Sayyid Al Shuhada", nameAr: "سيد الشهداء", isActive: false },
      { city: "Madinah", cityAr: "المدينة المنورة", nameEn: "Al Anabis", nameAr: "العنابس", isActive: false },
      { city: "Madinah", cityAr: "المدينة المنورة", nameEn: "Al Sahman", nameAr: "السحمان", isActive: false },
      { city: "Madinah", cityAr: "المدينة المنورة", nameEn: "Al Mustarah", nameAr: "المستراح", isActive: false },
      { city: "Madinah", cityAr: "المدينة المنورة", nameEn: "Al Bahr", nameAr: "البحر", isActive: false },
      { city: "Madinah", cityAr: "المدينة المنورة", nameEn: "Al Jubur", nameAr: "الجبور", isActive: false },
      { city: "Madinah", cityAr: "المدينة المنورة", nameEn: "Al Nasr", nameAr: "النصر", isActive: false },
      { city: "Madinah", cityAr: "المدينة المنورة", nameEn: "Al Anbariyah", nameAr: "العنبرية", isActive: false },
      { city: "Madinah", cityAr: "المدينة المنورة", nameEn: "Al Awali", nameAr: "العوالي", isActive: false },
      { city: "Madinah", cityAr: "المدينة المنورة", nameEn: "Al Manakhah", nameAr: "المناخة", isActive: false },
      { city: "Madinah", cityAr: "المدينة المنورة", nameEn: "Al Aghwat", nameAr: "الأغوات", isActive: false },
      { city: "Madinah", cityAr: "المدينة المنورة", nameEn: "Al Sahah", nameAr: "الساحة", isActive: false },
      { city: "Madinah", cityAr: "المدينة المنورة", nameEn: "Zuqaq Al Tayyar", nameAr: "زقاق الطيار", isActive: false },
      { city: "Madinah", cityAr: "المدينة المنورة", nameEn: "Al Harrah Al Sharqiyah", nameAr: "الحرة الشرقية", isActive: false },
      { city: "Madinah", cityAr: "المدينة المنورة", nameEn: "Al Tajuri", nameAr: "التاجوري", isActive: false },
      { city: "Madinah", cityAr: "المدينة المنورة", nameEn: "Bab Al Majidi", nameAr: "باب المجيدي", isActive: false },
      { city: "Madinah", cityAr: "المدينة المنورة", nameEn: "Bab Al Shami", nameAr: "باب الشامي", isActive: false },
      { city: "Madinah", cityAr: "المدينة المنورة", nameEn: "Al Harrah Al Gharbiyah", nameAr: "الحرة الغربية", isActive: false },
      { city: "Madinah", cityAr: "المدينة المنورة", nameEn: "Al Jurf", nameAr: "الجرف", isActive: false },
      { city: "Madinah", cityAr: "المدينة المنورة", nameEn: "Al Duwaymah", nameAr: "الدويمة", isActive: false },
      { city: "Madinah", cityAr: "المدينة المنورة", nameEn: "Al Qiblatain", nameAr: "القبلتين", isActive: false },
      { city: "Madinah", cityAr: "المدينة المنورة", nameEn: "Abyar Ali", nameAr: "أبيار علي", isActive: false },
      { city: "Madinah", cityAr: "المدينة المنورة", nameEn: "Al Iskan", nameAr: "الاسكان", isActive: false },
      { city: "Madinah", cityAr: "المدينة المنورة", nameEn: "Al Matar", nameAr: "المطار", isActive: false },
      { city: "Madinah", cityAr: "المدينة المنورة", nameEn: "Al Bayda", nameAr: "البيداء", isActive: false },
      { city: "Madinah", cityAr: "المدينة المنورة", nameEn: "Talat Al Hubub", nameAr: "تلعة الهبوب", isActive: false },
      { city: "Madinah", cityAr: "المدينة المنورة", nameEn: "Al Mabuth", nameAr: "المبعوث", isActive: false },
      { city: "Madinah", cityAr: "المدينة المنورة", nameEn: "Al Aqul", nameAr: "العاقول", isActive: false },
      { city: "Madinah", cityAr: "المدينة المنورة", nameEn: "Al Khadra", nameAr: "الخضراء", isActive: false },
      { city: "Madinah", cityAr: "المدينة المنورة", nameEn: "Wairah", nameAr: "وعيره", isActive: false },
      { city: "Madinah", cityAr: "المدينة المنورة", nameEn: "Al Faisal", nameAr: "الفيصل", isActive: false },
      { city: "Madinah", cityAr: "المدينة المنورة", nameEn: "Al Harrah Al Shamaliyah Al Sharqiyah", nameAr: "الحرة الشمالية الشرقية", isActive: false },
      { city: "Madinah", cityAr: "المدينة المنورة", nameEn: "Qurban", nameAr: "قربان", isActive: false },
      { city: "Madinah", cityAr: "المدينة المنورة", nameEn: "Al Munshiyah", nameAr: "المنشية", isActive: false },
      { city: "Madinah", cityAr: "المدينة المنورة", nameEn: "Al Sih", nameAr: "السيح", isActive: false },
      { city: "Madinah", cityAr: "المدينة المنورة", nameEn: "Al Wabrah", nameAr: "الوبرة", isActive: false },
      { city: "Madinah", cityAr: "المدينة المنورة", nameEn: "Urwah", nameAr: "عروة", isActive: false },
      { city: "Madinah", cityAr: "المدينة المنورة", nameEn: "Al Dakhl Al Mahdud", nameAr: "الدخل المحدود", isActive: false },
      { city: "Madinah", cityAr: "المدينة المنورة", nameEn: "Al Usbah", nameAr: "العصبة", isActive: false },
      { city: "Madinah", cityAr: "المدينة المنورة", nameEn: "Shawran", nameAr: "شوران", isActive: false },
      { city: "Madinah", cityAr: "المدينة المنورة", nameEn: "Al Rayah", nameAr: "الراية", isActive: false },
      { city: "Madinah", cityAr: "المدينة المنورة", nameEn: "Al Fath", nameAr: "الفتح", isActive: false },
      { city: "Madinah", cityAr: "المدينة المنورة", nameEn: "Al Hamra", nameAr: "الحمراء", isActive: false },
      { city: "Madinah", cityAr: "المدينة المنورة", nameEn: "Abu Markhah", nameAr: "أبو مرخه", isActive: false },
      { city: "Madinah", cityAr: "المدينة المنورة", nameEn: "Al Masani", nameAr: "المصانع", isActive: false },
    ];

    // Filter out already existing districts
    const newDistricts = additionalDistricts.filter(
      (d) => !existingSet.has(`${d.nameAr}__${d.city}`)
    );

    if (newDistricts.length === 0) {
      console.log("[Seed] Additional districts already seeded, skipping.");
      return;
    }

    // Add cityId to each district
    const toInsert = newDistricts.map((d) => ({
      ...d,
      cityId: cityIdMap.get(d.city) ?? null,
    }));

    // Insert in batches of 20
    const batchSize = 20;
    for (let i = 0; i < toInsert.length; i += batchSize) {
      const batch = toInsert.slice(i, i + batchSize);
      await db.insert(districts).values(batch as any[]);
    }
    console.log(`[Seed] ${newDistricts.length} additional districts added (inactive) for Riyadh, Jeddah, Madinah.`);
  } catch (error) {
    console.error("[Seed] Error seeding additional districts:", error);
  }
}
