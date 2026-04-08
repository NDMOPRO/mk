/*
 * Monthly Key (المفتاح الشهري) - Content Data
 * Elevated Softness design: warm teal + beige + coral CTA
 */

export const HERO_IMAGE = "https://d2xsxph8kpxj0f.cloudfront.net/310519663343528112/FSSFos8rgPRTJcnhcPDqQc/hero-bg-BdsnhesALrqhbrLr4oQHaX.webp";
export const SERVICES_BG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663343528112/FSSFos8rgPRTJcnhcPDqQc/services-bg-aNAKADRWPpCzffPGJvkcAJ.webp";
export const APARTMENT_IMAGE = "https://d2xsxph8kpxj0f.cloudfront.net/310519663343528112/FSSFos8rgPRTJcnhcPDqQc/apartment-interior-EFkbR2mVMqMMYXNy8kr8PD.webp";

export interface Service {
  id: string;
  iconName: string;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
}

export const services: Service[] = [
  {
    id: "property-management",
    iconName: "Building2",
    titleAr: "إدارة العقارات",
    titleEn: "Property Management",
    descAr: "إدارة شاملة لعقارك الشهري مع تقارير دورية مفصلة",
    descEn: "Comprehensive monthly property management with periodic reports",
  },
  {
    id: "monthly-rental",
    iconName: "Key",
    titleAr: "الإيجار الشهري",
    titleEn: "Monthly Rental",
    descAr: "تأجير مرن بعقود رقمية متوافقة مع نظام إيجار",
    descEn: "Flexible rental with digital contracts compatible with Ejar system",
  },
  {
    id: "revenue-management",
    iconName: "TrendingUp",
    titleAr: "إدارة الإيرادات",
    titleEn: "Revenue Management",
    descAr: "تسعير ذكي وتحسين العوائد بناءً على بيانات السوق",
    descEn: "Smart pricing and yield optimization based on market data",
  },
  {
    id: "property-care",
    iconName: "Wrench",
    titleAr: "العناية بالعقار",
    titleEn: "Property Care",
    descAr: "صيانة وتجديد وتصميم داخلي احترافي لعقارك",
    descEn: "Maintenance, renovation, and professional interior design",
  },
  {
    id: "tenant-experience",
    iconName: "HeadphonesIcon",
    titleAr: "تجربة المستأجر",
    titleEn: "Tenant Experience",
    descAr: "دعم المستأجرين على مدار الساعة باللغة العربية",
    descEn: "24/7 Arabic tenant support for the best experience",
  },
  {
    id: "verification-security",
    iconName: "ShieldCheck",
    titleAr: "التحقق والأمان",
    titleEn: "Verification & Security",
    descAr: "تحقق من الهوية الوطنية وعقود رقمية آمنة",
    descEn: "National ID verification and secure digital contracts",
  },
];

export interface Step {
  number: number;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  iconName: string;
}

export const howItWorks: Step[] = [
  {
    number: 1,
    titleAr: "ابحث عن عقارك",
    titleEn: "Search for your property",
    descAr: "تصفح مئات العقارات المتاحة للتأجير الشهري في مدينتك",
    descEn: "Browse hundreds of properties available for monthly rent in your city",
    iconName: "Search",
  },
  {
    number: 2,
    titleAr: "احجز إقامتك",
    titleEn: "Book your stay",
    descAr: "اختر المدة المناسبة واحجز بسهولة مع عقد رقمي",
    descEn: "Choose the right duration and book easily with a digital contract",
    iconName: "CalendarCheck",
  },
  {
    number: 3,
    titleAr: "استمتع بسكنك",
    titleEn: "Enjoy your stay",
    descAr: "انتقل واستمتع بإقامة مريحة مع دعم متواصل",
    descEn: "Move in and enjoy a comfortable stay with continuous support",
    iconName: "Home",
  },
];

export interface City {
  nameAr: string;
  nameEn: string;
  image: string;
  featured?: boolean;
}

export const cities: City[] = [
  {
    nameAr: "الرياض",
    nameEn: "Riyadh",
    image: "https://d2xsxph8kpxj0f.cloudfront.net/310519663343528112/FSSFos8rgPRTJcnhcPDqQc/city-riyadh-f8b8NGuXoUn3vvNS6QsbfV.webp",
    featured: true,
  },
  {
    nameAr: "جدة",
    nameEn: "Jeddah",
    image: "https://d2xsxph8kpxj0f.cloudfront.net/310519663343528112/FSSFos8rgPRTJcnhcPDqQc/city-jeddah-5xp6RJ5jhFaWYZsqXxoFxN.webp",
    featured: true,
  },
  {
    nameAr: "الدمام",
    nameEn: "Dammam",
    image: "https://images.unsplash.com/photo-1578895101408-1a36b834405b?w=600&q=80",
  },
  {
    nameAr: "مكة المكرمة",
    nameEn: "Mecca",
    image: "https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa?w=600&q=80",
  },
  {
    nameAr: "المدينة المنورة",
    nameEn: "Medina",
    image: "https://images.unsplash.com/photo-1590076215667-875d4ef2d7de?w=600&q=80",
  },
  {
    nameAr: "الخبر",
    nameEn: "Khobar",
    image: "https://images.unsplash.com/photo-1586724237569-f3d0c1dee8c6?w=600&q=80",
  },
  {
    nameAr: "الطائف",
    nameEn: "Taif",
    image: "https://images.unsplash.com/photo-1466442929976-97f336a657be?w=600&q=80",
  },
  {
    nameAr: "تبوك",
    nameEn: "Tabuk",
    image: "https://images.unsplash.com/photo-1682687220742-aba13b6e50ba?w=600&q=80",
  },
  {
    nameAr: "أبها",
    nameEn: "Abha",
    image: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=600&q=80",
  },
];

export const stats = [
  { valueAr: "+٥٠٠", valueEn: "500+", labelAr: "عقار متاح", labelEn: "Properties Available" },
  { valueAr: "+٩", valueEn: "9+", labelAr: "مدينة", labelEn: "Cities" },
  { valueAr: "+١٠٠٠", valueEn: "1000+", labelAr: "مستأجر سعيد", labelEn: "Happy Tenants" },
  { valueAr: "٢٤/٧", valueEn: "24/7", labelAr: "دعم متواصل", labelEn: "Support" },
];
