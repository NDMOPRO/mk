/*
 * StatsBar - Elevated Softness design
 * Floating stats bar with warm background
 */
import { useLanguage } from "@/contexts/LanguageContext";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { stats } from "@/lib/data";
import { motion } from "framer-motion";

export default function StatsBar() {
  const { t } = useLanguage();
  const { ref, isVisible } = useScrollReveal(0.3);

  return (
    <div ref={ref} className="relative -mt-10 z-10 container">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={isVisible ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="bg-white rounded-2xl shadow-xl shadow-black/8 border border-[#e8ddd0]/40 p-5"
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {stats.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 15 }}
              animate={isVisible ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.1 * i + 0.2, duration: 0.5 }}
              className="text-center"
            >
              <div
                className="text-2xl sm:text-3xl font-extrabold text-[#0E7490]"
                style={{ fontFamily: "'Cairo', sans-serif" }}
              >
                {t(stat.valueAr, stat.valueEn)}
              </div>
              <div
                className="text-xs text-[#64748B] mt-0.5 font-medium"
                style={{ fontFamily: "'Tajawal', sans-serif" }}
              >
                {t(stat.labelAr, stat.labelEn)}
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
