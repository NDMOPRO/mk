/*
 * HeroSection - Elevated Softness design
 * Full-bleed hero with gradient overlay, tagline, and CTA
 * Dark image background → white/light text
 */
import { useLanguage } from "@/contexts/LanguageContext";
import { HERO_IMAGE } from "@/lib/data";
import { motion } from "framer-motion";
import { ArrowDown, Sparkles } from "lucide-react";

export default function HeroSection() {
  const { lang, t } = useLanguage();

  return (
    <section className="relative overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0">
        <img
          src={HERO_IMAGE}
          alt="Monthly Key - Premium Properties"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0A1628]/80 via-[#0A1628]/60 to-[#0E7490]/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A1628]/90 via-transparent to-transparent" />
      </div>

      {/* Content */}
      <div className="relative container pt-16 pb-20 min-h-[85vh] flex flex-col justify-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="mb-6"
        >
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-white/90 text-xs font-medium"
            style={{ fontFamily: lang === "ar" ? "'Tajawal', sans-serif" : "'Inter', sans-serif" }}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#F97316]" />
            {t("المنصة الرائدة في السعودية", "Leading Platform in Saudi Arabia")}
          </span>
        </motion.div>

        {/* Main Title */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.7, ease: "easeOut" }}
          className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-4"
          style={{ fontFamily: "'Cairo', sans-serif" }}
        >
          {t("المفتاح الشهري", "Monthly Key")}
        </motion.h1>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="text-lg sm:text-xl text-white/85 max-w-lg leading-relaxed mb-8"
          style={{ fontFamily: lang === "ar" ? "'Tajawal', sans-serif" : "'DM Sans', sans-serif" }}
        >
          {t(
            "خبير الإيجار الشهري الآن في المملكة العربية السعودية. اكتشف شقق مفروشة فاخرة بعقود رقمية آمنة.",
            "The monthly rental expert now in Saudi Arabia. Discover luxury furnished apartments with secure digital contracts."
          )}
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65, duration: 0.6 }}
          className="flex flex-wrap gap-3"
        >
          <a
            href="https://monthlykey.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white font-semibold text-sm shadow-lg shadow-[#F97316]/30 transition-all hover:shadow-xl hover:shadow-[#F97316]/40 hover:-translate-y-0.5 active:translate-y-0"
            style={{ fontFamily: lang === "ar" ? "'Cairo', sans-serif" : "'DM Sans', sans-serif" }}
          >
            {t("تصفح العقارات", "Browse Properties")}
          </a>
          <a
            href="#how-it-works"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/15 backdrop-blur-md border border-white/25 text-white font-medium text-sm hover:bg-white/25 transition-all"
            style={{ fontFamily: lang === "ar" ? "'Cairo', sans-serif" : "'DM Sans', sans-serif" }}
          >
            {t("كيف يعمل؟", "How it works?")}
          </a>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.8 }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          >
            <ArrowDown className="w-5 h-5 text-white/50" />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
