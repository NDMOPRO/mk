/*
 * HowItWorksSection - Elevated Softness design
 * Vertical timeline with numbered steps, warm white background
 */
import { useLanguage } from "@/contexts/LanguageContext";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { howItWorks, APARTMENT_IMAGE } from "@/lib/data";
import { motion } from "framer-motion";
import { Search, CalendarCheck, Home } from "lucide-react";

const stepIcons: Record<string, React.ElementType> = {
  Search,
  CalendarCheck,
  Home,
};

export default function HowItWorksSection() {
  const { lang, t } = useLanguage();
  const { ref, isVisible } = useScrollReveal(0.1);

  return (
    <section ref={ref} className="py-16 bg-white" id="how-it-works">
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
            {t("كيف يعمل", "How It Works")}
          </span>
          <h2
            className="text-3xl sm:text-4xl font-extrabold text-[#1E293B] mb-3"
            style={{ fontFamily: "'Cairo', sans-serif" }}
          >
            {t("ثلاث خطوات بسيطة", "Three Simple Steps")}
          </h2>
          <p
            className="text-[#64748B] text-base max-w-xl leading-relaxed"
            style={{ fontFamily: lang === "ar" ? "'Tajawal', sans-serif" : "'DM Sans', sans-serif" }}
          >
            {t(
              "ابدأ رحلتك مع المفتاح الشهري في دقائق معدودة",
              "Start your journey with Monthly Key in just a few minutes"
            )}
          </p>
        </motion.div>

        {/* Steps + Image Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          {/* Steps */}
          <div className="space-y-0">
            {howItWorks.map((step, i) => {
              const Icon = stepIcons[step.iconName] || Search;
              const isLast = i === howItWorks.length - 1;
              return (
                <motion.div
                  key={step.number}
                  initial={{ opacity: 0, x: lang === "ar" ? 30 : -30 }}
                  animate={isVisible ? { opacity: 1, x: 0 } : {}}
                  transition={{ delay: 0.15 * i + 0.2, duration: 0.5, ease: "easeOut" }}
                  className="flex gap-4"
                >
                  {/* Timeline */}
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#0E7490] to-[#0891B2] flex items-center justify-center shadow-lg shadow-[#0E7490]/20 shrink-0">
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    {!isLast && (
                      <div className="w-0.5 h-16 bg-gradient-to-b from-[#0E7490]/30 to-[#0E7490]/5 my-1" />
                    )}
                  </div>

                  {/* Content */}
                  <div className={`pt-1 ${isLast ? "pb-0" : "pb-8"}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="text-xs font-bold text-[#0E7490] bg-[#0E7490]/10 px-2 py-0.5 rounded-md"
                        style={{ fontFamily: "'Cairo', sans-serif" }}
                      >
                        {t(`الخطوة ${step.number}`, `Step ${step.number}`)}
                      </span>
                    </div>
                    <h3
                      className="text-lg font-bold text-[#1E293B] mb-1"
                      style={{ fontFamily: "'Cairo', sans-serif" }}
                    >
                      {t(step.titleAr, step.titleEn)}
                    </h3>
                    <p
                      className="text-sm text-[#64748B] leading-relaxed"
                      style={{ fontFamily: lang === "ar" ? "'Tajawal', sans-serif" : "'Inter', sans-serif" }}
                    >
                      {t(step.descAr, step.descEn)}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Image */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={isVisible ? { opacity: 1, scale: 1 } : {}}
            transition={{ delay: 0.4, duration: 0.7, ease: "easeOut" }}
            className="hidden lg:block"
          >
            <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-black/10">
              <img
                src={APARTMENT_IMAGE}
                alt={t("شقة مفروشة فاخرة", "Luxury furnished apartment")}
                className="w-full h-80 object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0A1628]/40 to-transparent" />
              <div className="absolute bottom-4 right-4 left-4">
                <div className="bg-white/90 backdrop-blur-md rounded-xl p-3 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-[#64748B]" style={{ fontFamily: "'Tajawal', sans-serif" }}>
                        {t("يبدأ من", "Starting from")}
                      </p>
                      <p className="text-lg font-bold text-[#0E7490]" style={{ fontFamily: "'Cairo', sans-serif" }}>
                        {t("١,٥٠٠ ر.س", "SAR 1,500")}
                        <span className="text-xs text-[#64748B] font-normal mr-1">
                          {t("/شهرياً", "/month")}
                        </span>
                      </p>
                    </div>
                    <div className="px-3 py-1.5 rounded-lg bg-[#059669] text-white text-xs font-semibold">
                      {t("متاح الآن", "Available")}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
