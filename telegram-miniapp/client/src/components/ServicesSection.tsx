/*
 * ServicesSection - Elevated Softness design
 * Service cards with teal icon circles, warm background
 */
import { useLanguage } from "@/contexts/LanguageContext";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { services } from "@/lib/data";
import { motion } from "framer-motion";
import {
  Building2,
  Key,
  TrendingUp,
  Wrench,
  Headphones,
  ShieldCheck,
} from "lucide-react";

const iconMap: Record<string, React.ElementType> = {
  Building2,
  Key,
  TrendingUp,
  Wrench,
  HeadphonesIcon: Headphones,
  ShieldCheck,
};

const cardColors = [
  { bg: "bg-[#0E7490]/10", icon: "text-[#0E7490]", border: "border-[#0E7490]/15" },
  { bg: "bg-[#F97316]/10", icon: "text-[#F97316]", border: "border-[#F97316]/15" },
  { bg: "bg-[#059669]/10", icon: "text-[#059669]", border: "border-[#059669]/15" },
  { bg: "bg-[#7C3AED]/10", icon: "text-[#7C3AED]", border: "border-[#7C3AED]/15" },
  { bg: "bg-[#DB2777]/10", icon: "text-[#DB2777]", border: "border-[#DB2777]/15" },
  { bg: "bg-[#0E7490]/10", icon: "text-[#0E7490]", border: "border-[#0E7490]/15" },
];

export default function ServicesSection() {
  const { lang, t } = useLanguage();
  const { ref, isVisible } = useScrollReveal(0.1);

  return (
    <section ref={ref} className="py-16 bg-[#FDFAF6]" id="services">
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
            {t("خدماتنا", "Our Services")}
          </span>
          <h2
            className="text-3xl sm:text-4xl font-extrabold text-[#1E293B] mb-3"
            style={{ fontFamily: "'Cairo', sans-serif" }}
          >
            {t("حلول متكاملة للتأجير الشهري", "Complete Monthly Rental Solutions")}
          </h2>
          <p
            className="text-[#64748B] text-base max-w-xl leading-relaxed"
            style={{ fontFamily: lang === "ar" ? "'Tajawal', sans-serif" : "'DM Sans', sans-serif" }}
          >
            {t(
              "نقدم مجموعة شاملة من الخدمات لتلبية جميع احتياجاتك العقارية",
              "We offer a comprehensive suite of services to meet all your real estate needs"
            )}
          </p>
        </motion.div>

        {/* Service Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((service, i) => {
            const Icon = iconMap[service.iconName] || Building2;
            const color = cardColors[i % cardColors.length];
            return (
              <motion.div
                key={service.id}
                initial={{ opacity: 0, y: 25 }}
                animate={isVisible ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.08 * i + 0.15, duration: 0.5, ease: "easeOut" }}
                className={`group p-5 rounded-xl bg-white border ${color.border} shadow-sm hover:shadow-lg hover:shadow-black/5 transition-all duration-300 hover:-translate-y-1`}
              >
                <div className={`w-11 h-11 rounded-xl ${color.bg} flex items-center justify-center mb-3.5`}>
                  <Icon className={`w-5 h-5 ${color.icon}`} />
                </div>
                <h3
                  className="text-base font-bold text-[#1E293B] mb-1.5"
                  style={{ fontFamily: "'Cairo', sans-serif" }}
                >
                  {t(service.titleAr, service.titleEn)}
                </h3>
                <p
                  className="text-sm text-[#64748B] leading-relaxed"
                  style={{ fontFamily: lang === "ar" ? "'Tajawal', sans-serif" : "'Inter', sans-serif" }}
                >
                  {t(service.descAr, service.descEn)}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
