/*
 * CTASection - Elevated Softness design
 * Bold CTA with teal gradient background, white text
 */
import { useLanguage } from "@/contexts/LanguageContext";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { motion } from "framer-motion";
import { ExternalLink, MessageCircle, Phone } from "lucide-react";

export default function CTASection() {
  const { lang, t } = useLanguage();
  const { ref, isVisible } = useScrollReveal(0.2);

  return (
    <section ref={ref} className="py-16 bg-white" id="contact">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isVisible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="relative rounded-3xl overflow-hidden"
        >
          {/* Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#0E7490] via-[#0891B2] to-[#06B6D4]" />
          <div className="absolute inset-0 opacity-10">
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>

          {/* Content */}
          <div className="relative px-6 py-12 sm:px-10 sm:py-14 text-center">
            <motion.h2
              initial={{ opacity: 0, y: 15 }}
              animate={isVisible ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="text-3xl sm:text-4xl font-extrabold text-white mb-3"
              style={{ fontFamily: "'Cairo', sans-serif" }}
            >
              {t("ابدأ رحلتك الآن", "Start Your Journey Now")}
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 15 }}
              animate={isVisible ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="text-white/85 text-base max-w-md mx-auto mb-8 leading-relaxed"
              style={{ fontFamily: lang === "ar" ? "'Tajawal', sans-serif" : "'DM Sans', sans-serif" }}
            >
              {t(
                "اكتشف أفضل العقارات للإيجار الشهري في المملكة العربية السعودية. تواصل معنا اليوم!",
                "Discover the best properties for monthly rent in Saudi Arabia. Contact us today!"
              )}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={isVisible ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="flex flex-col sm:flex-row gap-3 justify-center"
            >
              <a
                href="https://monthlykey.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white text-[#0E7490] font-bold text-sm shadow-lg shadow-black/10 hover:shadow-xl hover:-translate-y-0.5 transition-all active:translate-y-0"
                style={{ fontFamily: lang === "ar" ? "'Cairo', sans-serif" : "'DM Sans', sans-serif" }}
              >
                <ExternalLink className="w-4 h-4" />
                {t("زيارة الموقع", "Visit Website")}
              </a>
              <a
                href="https://wa.me/966500000000"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white/15 backdrop-blur-md border border-white/25 text-white font-semibold text-sm hover:bg-white/25 transition-all"
                style={{ fontFamily: lang === "ar" ? "'Cairo', sans-serif" : "'DM Sans', sans-serif" }}
              >
                <MessageCircle className="w-4 h-4" />
                {t("تواصل عبر واتساب", "WhatsApp Us")}
              </a>
            </motion.div>

            {/* Price Range */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={isVisible ? { opacity: 1 } : {}}
              transition={{ delay: 0.6, duration: 0.6 }}
              className="mt-8 pt-6 border-t border-white/20"
            >
              <p
                className="text-white/60 text-xs mb-1"
                style={{ fontFamily: lang === "ar" ? "'Tajawal', sans-serif" : "'Inter', sans-serif" }}
              >
                {t("نطاق الأسعار", "Price Range")}
              </p>
              <p
                className="text-white font-bold text-lg"
                style={{ fontFamily: "'Cairo', sans-serif" }}
              >
                {t("١,٥٠٠ - ٢٥,٠٠٠ ر.س / شهرياً", "SAR 1,500 - 25,000 / month")}
              </p>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
