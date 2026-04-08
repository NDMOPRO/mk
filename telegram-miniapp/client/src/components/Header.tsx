/*
 * Header - Elevated Softness design
 * Sticky header with glass effect, logo, and language toggle
 */
import { useLanguage } from "@/contexts/LanguageContext";
import { Globe, Key } from "lucide-react";
import { motion } from "framer-motion";

export default function Header() {
  const { lang, toggleLanguage, t } = useLanguage();

  return (
    <motion.header
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-[#e8ddd0]/60"
    >
      <div className="container flex items-center justify-between h-14">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0E7490] to-[#0891B2] flex items-center justify-center shadow-md">
            <Key className="w-4 h-4 text-white" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-bold text-[#1E293B]" style={{ fontFamily: "'Cairo', sans-serif" }}>
              {t("المفتاح الشهري", "Monthly Key")}
            </span>
            <span className="text-[10px] text-[#64748B]" style={{ fontFamily: lang === "ar" ? "'Tajawal', sans-serif" : "'Inter', sans-serif" }}>
              {t("خبير الإيجار الشهري", "Monthly Rental Expert")}
            </span>
          </div>
        </div>

        {/* Language Toggle */}
        <button
          onClick={toggleLanguage}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F5F0EB] hover:bg-[#EDE5DB] transition-colors text-xs font-medium text-[#1E293B]"
          style={{ fontFamily: lang === "ar" ? "'Inter', sans-serif" : "'Cairo', sans-serif" }}
        >
          <Globe className="w-3.5 h-3.5 text-[#0E7490]" />
          {lang === "ar" ? "EN" : "عربي"}
        </button>
      </div>
    </motion.header>
  );
}
