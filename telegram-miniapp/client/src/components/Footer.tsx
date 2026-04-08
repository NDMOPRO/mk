/*
 * Footer - Elevated Softness design
 * Minimal footer with branding and links
 */
import { useLanguage } from "@/contexts/LanguageContext";
import { Key } from "lucide-react";

export default function Footer() {
  const { lang, t } = useLanguage();

  return (
    <footer className="bg-[#0A1628] text-white py-8">
      <div className="container">
        {/* Logo & Brand */}
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0E7490] to-[#0891B2] flex items-center justify-center">
            <Key className="w-4 h-4 text-white" />
          </div>
          <span className="text-base font-bold" style={{ fontFamily: "'Cairo', sans-serif" }}>
            {t("المفتاح الشهري", "Monthly Key")}
          </span>
        </div>

        <p
          className="text-white/50 text-sm mb-6 max-w-sm leading-relaxed"
          style={{ fontFamily: lang === "ar" ? "'Tajawal', sans-serif" : "'Inter', sans-serif" }}
        >
          {t(
            "المنصة الرائدة للتأجير الشهري في المملكة العربية السعودية. شقق مفروشة، استوديوهات، وفلل في أهم المدن السعودية.",
            "The leading monthly rental platform in Saudi Arabia. Furnished apartments, studios, and villas in major Saudi cities."
          )}
        </p>

        {/* Links */}
        <div className="flex flex-wrap gap-4 mb-6">
          {[
            { ar: "الرئيسية", en: "Home", href: "#" },
            { ar: "خدماتنا", en: "Services", href: "#services" },
            { ar: "المدن", en: "Cities", href: "#cities" },
            { ar: "تواصل معنا", en: "Contact", href: "#contact" },
          ].map((link) => (
            <a
              key={link.en}
              href={link.href}
              className="text-white/40 hover:text-white/80 text-sm transition-colors"
              style={{ fontFamily: lang === "ar" ? "'Tajawal', sans-serif" : "'Inter', sans-serif" }}
            >
              {t(link.ar, link.en)}
            </a>
          ))}
        </div>

        {/* Divider */}
        <div className="border-t border-white/10 pt-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <p
              className="text-white/30 text-xs"
              style={{ fontFamily: lang === "ar" ? "'Tajawal', sans-serif" : "'Inter', sans-serif" }}
            >
              {t(
                `© ${new Date().getFullYear()} المفتاح الشهري. جميع الحقوق محفوظة.`,
                `© ${new Date().getFullYear()} Monthly Key. All rights reserved.`
              )}
            </p>
            <div className="flex items-center gap-1 text-white/30 text-xs">
              <span style={{ fontFamily: lang === "ar" ? "'Tajawal', sans-serif" : "'Inter', sans-serif" }}>
                {t("صُنع بـ ❤️ في السعودية", "Made with ❤️ in Saudi Arabia")}
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
