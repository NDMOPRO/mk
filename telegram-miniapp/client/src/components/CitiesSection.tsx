/*
 * CitiesSection - Elevated Softness design
 * Horizontal scrollable city cards with featured cities larger
 */
import { useLanguage } from "@/contexts/LanguageContext";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { cities } from "@/lib/data";
import { motion } from "framer-motion";
import { MapPin } from "lucide-react";

export default function CitiesSection() {
  const { lang, t } = useLanguage();
  const { ref, isVisible } = useScrollReveal(0.1);

  const featuredCities = cities.filter((c) => c.featured);
  const otherCities = cities.filter((c) => !c.featured);

  return (
    <section ref={ref} className="py-16 bg-[#FDFAF6]" id="cities">
      <div className="container">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isVisible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="mb-10"
        >
          <span
            className="text-xs font-semibold text-[#0E7490] uppercase tracking-wider mb-2 block"
            style={{ fontFamily: lang === "ar" ? "'Tajawal', sans-serif" : "'Inter', sans-serif" }}
          >
            {t("مدننا", "Our Cities")}
          </span>
          <h2
            className="text-3xl sm:text-4xl font-extrabold text-[#1E293B] mb-3"
            style={{ fontFamily: "'Cairo', sans-serif" }}
          >
            {t("نخدمك في أهم المدن السعودية", "Serving Major Saudi Cities")}
          </h2>
          <p
            className="text-[#64748B] text-base max-w-xl leading-relaxed"
            style={{ fontFamily: lang === "ar" ? "'Tajawal', sans-serif" : "'DM Sans', sans-serif" }}
          >
            {t(
              "اكتشف عقارات مميزة في ٩ مدن سعودية رئيسية",
              "Discover premium properties across 9 major Saudi cities"
            )}
          </p>
        </motion.div>

        {/* Featured Cities - Large Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          {featuredCities.map((city, i) => (
            <motion.div
              key={city.nameEn}
              initial={{ opacity: 0, y: 25 }}
              animate={isVisible ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.1 * i + 0.2, duration: 0.5 }}
              className="group relative rounded-2xl overflow-hidden h-52 shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer"
            >
              <img
                src={city.image}
                alt={t(city.nameAr, city.nameEn)}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0A1628]/80 via-[#0A1628]/20 to-transparent" />
              <div className="absolute bottom-4 right-4 left-4 flex items-end justify-between">
                <div>
                  <h3
                    className="text-xl font-bold text-white mb-0.5"
                    style={{ fontFamily: "'Cairo', sans-serif" }}
                  >
                    {t(city.nameAr, city.nameEn)}
                  </h3>
                  <div className="flex items-center gap-1 text-white/70 text-xs">
                    <MapPin className="w-3 h-3" />
                    <span style={{ fontFamily: lang === "ar" ? "'Tajawal', sans-serif" : "'Inter', sans-serif" }}>
                      {t("عقارات متاحة", "Properties available")}
                    </span>
                  </div>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-white/20 backdrop-blur-md text-white text-xs font-semibold border border-white/20">
                  {t("استكشف", "Explore")}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Other Cities - Horizontal Scroll */}
        <div className="overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          <div className="flex gap-3" style={{ minWidth: "max-content" }}>
            {otherCities.map((city, i) => (
              <motion.div
                key={city.nameEn}
                initial={{ opacity: 0, y: 20 }}
                animate={isVisible ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.08 * i + 0.4, duration: 0.5 }}
                className="group relative rounded-xl overflow-hidden w-36 h-44 shrink-0 shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer"
              >
                <img
                  src={city.image}
                  alt={t(city.nameAr, city.nameEn)}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0A1628]/80 via-[#0A1628]/10 to-transparent" />
                <div className="absolute bottom-3 right-3 left-3">
                  <h3
                    className="text-sm font-bold text-white"
                    style={{ fontFamily: "'Cairo', sans-serif" }}
                  >
                    {t(city.nameAr, city.nameEn)}
                  </h3>
                  <div className="flex items-center gap-0.5 text-white/60 text-[10px] mt-0.5">
                    <MapPin className="w-2.5 h-2.5" />
                    <span style={{ fontFamily: lang === "ar" ? "'Tajawal', sans-serif" : "'Inter', sans-serif" }}>
                      {t("اكتشف", "Discover")}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
