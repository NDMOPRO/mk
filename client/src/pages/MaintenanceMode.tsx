import { useSiteSettings } from "@/hooks/use-site-settings";
import { useI18n } from "@/lib/i18n";
import { useState, useEffect, useMemo, useRef } from "react";
import { Clock, Globe, Mail } from "lucide-react";

/* ── SVG Social Icons (inline for zero-dependency) ── */
function TwitterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

function SnapchatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12.922-.214.12-.042.195-.065.28-.088a.96.96 0 01.287-.038c.218 0 .449.059.63.18.345.24.405.615.39.81a.726.726 0 01-.12.39c-.33.45-1.065.705-1.545.87-.12.045-.24.075-.345.105-.18.06-.27.09-.345.165-.075.09-.105.195-.12.315-.015.18.06.36.12.465.45.705 1.125 1.29 1.95 1.695.21.105.42.18.615.24.33.09.585.24.66.48.09.3-.12.585-.33.765a3.3 3.3 0 01-.675.435c-.39.195-.81.33-1.245.42-.06.015-.12.03-.18.06-.06.03-.12.075-.165.165-.06.12-.075.27-.09.39-.015.075-.03.15-.045.225a.66.66 0 01-.66.495c-.15 0-.315-.03-.48-.06-.27-.06-.585-.12-.96-.12-.195 0-.39.015-.585.045-.375.06-.72.24-1.095.435-.54.27-1.155.585-2.04.585-.06 0-.12 0-.195-.015-.06.015-.12.015-.195.015-.885 0-1.5-.315-2.04-.585-.375-.195-.72-.375-1.095-.435a3.6 3.6 0 00-.585-.045c-.39 0-.69.06-.96.12-.18.03-.33.06-.48.06a.66.66 0 01-.66-.495c-.015-.075-.03-.15-.045-.225-.015-.12-.03-.27-.09-.39-.045-.09-.105-.135-.165-.165-.06-.03-.12-.045-.18-.06a5.1 5.1 0 01-1.245-.42 3.3 3.3 0 01-.675-.435c-.21-.18-.42-.465-.33-.765.075-.24.33-.39.66-.48.195-.06.405-.135.615-.24.825-.405 1.5-.99 1.95-1.695.06-.105.135-.285.12-.465-.015-.12-.045-.225-.12-.315-.075-.075-.165-.105-.345-.165-.105-.03-.225-.06-.345-.105-.48-.165-1.215-.42-1.545-.87a.726.726 0 01-.12-.39c-.015-.195.045-.57.39-.81a.96.96 0 01.63-.18c.09 0 .18.015.27.038.09.023.165.046.285.088.27.09.615.21.915.214.195 0 .33-.045.405-.09a8.7 8.7 0 01-.03-.51l-.003-.06c-.105-1.628-.23-3.654.3-4.847C7.86 1.069 11.216.793 12.206.793z" />
    </svg>
  );
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  );
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function YouTubeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

/* ── Social links config ── */
const socialPlatforms = [
  { key: "social.twitter", icon: TwitterIcon, label: "X / Twitter", hoverColor: "hover:bg-white/20 hover:text-white" },
  { key: "social.instagram", icon: InstagramIcon, label: "Instagram", hoverColor: "hover:bg-gradient-to-br hover:from-[#f09433] hover:to-[#bc1888] hover:text-white" },
  { key: "social.snapchat", icon: SnapchatIcon, label: "Snapchat", hoverColor: "hover:bg-[#FFFC00] hover:text-black" },
  { key: "social.tiktok", icon: TikTokIcon, label: "TikTok", hoverColor: "hover:bg-white/20 hover:text-white" },
  { key: "social.linkedin", icon: LinkedInIcon, label: "LinkedIn", hoverColor: "hover:bg-[#0A66C2] hover:text-white" },
  { key: "social.youtube", icon: YouTubeIcon, label: "YouTube", hoverColor: "hover:bg-[#FF0000] hover:text-white" },
] as const;

/* ── Animated Key Shimmer ── */
function KeyShimmer() {
  return (
    <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
      <div
        className="absolute -inset-full"
        style={{
          background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.08) 45%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.08) 55%, transparent 60%)",
          animation: "shimmer 4s ease-in-out infinite",
        }}
      />
    </div>
  );
}

/* ── Countdown Timer ── */
function CountdownTimer({ targetDate }: { targetDate: string }) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const target = new Date(targetDate).getTime();
    const interval = setInterval(() => {
      const now = Date.now();
      const diff = Math.max(0, target - now);
      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  const { lang } = useI18n();
  const labels = lang === "ar"
    ? { days: "يوم", hours: "ساعة", minutes: "دقيقة", seconds: "ثانية" }
    : { days: "Days", hours: "Hours", minutes: "Min", seconds: "Sec" };

  return (
    <div className="flex gap-3 sm:gap-5 justify-center flex-wrap">
      {(["days", "hours", "minutes", "seconds"] as const).map((unit, i) => (
        <div key={unit} className="flex flex-col items-center group">
          <div className="relative">
            <div className="w-[72px] h-[72px] sm:w-[88px] sm:h-[88px] rounded-2xl bg-[#0B1E2D]/80 backdrop-blur-md border border-[#3ECFC0]/20 flex items-center justify-center shadow-[0_0_30px_rgba(62,207,192,0.08)] transition-all duration-500 group-hover:border-[#3ECFC0]/40 group-hover:shadow-[0_0_40px_rgba(62,207,192,0.15)]">
              <span className="text-3xl sm:text-4xl font-bold text-white tabular-nums tracking-tight">
                {String(timeLeft[unit]).padStart(2, "0")}
              </span>
            </div>
            {/* Subtle glow under each box */}
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-12 h-1 rounded-full bg-[#3ECFC0]/20 blur-sm" />
          </div>
          <span className="text-[11px] sm:text-xs text-white/40 mt-2.5 font-medium uppercase tracking-wider">{labels[unit]}</span>
          {/* Separator dots between units */}
          {i < 3 && (
            <div className="absolute hidden sm:flex flex-col gap-1.5 top-1/2 -translate-y-1/2" style={{ [lang === "ar" ? "left" : "right"]: "-8px" }}>
              <div className="w-1 h-1 rounded-full bg-[#C9A96E]/40" />
              <div className="w-1 h-1 rounded-full bg-[#C9A96E]/40" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Floating Orbs Background ── */
function FloatingOrbs() {
  const orbs = useMemo(() => [
    { x: 15, y: 20, size: 300, color: "#3ECFC0", opacity: 0.04, duration: 25 },
    { x: 75, y: 60, size: 400, color: "#C9A96E", opacity: 0.03, duration: 30 },
    { x: 50, y: 80, size: 250, color: "#3ECFC0", opacity: 0.05, duration: 20 },
    { x: 85, y: 15, size: 200, color: "#C9A96E", opacity: 0.04, duration: 22 },
  ], []);

  return (
    <>
      {orbs.map((orb, i) => (
        <div
          key={i}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: `${orb.x}%`,
            top: `${orb.y}%`,
            width: `${orb.size}px`,
            height: `${orb.size}px`,
            background: `radial-gradient(circle, ${orb.color} 0%, transparent 70%)`,
            opacity: orb.opacity,
            transform: "translate(-50%, -50%)",
            animation: `orb-drift-${i} ${orb.duration}s ease-in-out infinite alternate`,
          }}
        />
      ))}
    </>
  );
}

/* ── Main Component ── */
export default function MaintenanceMode() {
  const { get, getByLang } = useSiteSettings();
  const { lang, setLang } = useI18n();
  const isRtl = lang === "ar";
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const title = getByLang("maintenance.title", lang, lang === "ar" ? "قريباً... الانطلاق" : "Coming Soon");
  const subtitle = getByLang("maintenance.subtitle", lang, lang === "ar" ? "نعمل على تجهيز تجربة مميزة لكم" : "We're preparing an exceptional experience for you");
  const message = getByLang("maintenance.message", lang, lang === "ar" ? "ستكون رحلة مميزة معنا في عالم الإيجارات الشهرية. ترقبونا!" : "An exceptional journey awaits you in the world of monthly rentals. Stay tuned!");
  const imageUrl = get("maintenance.imageUrl");
  const countdownDate = get("maintenance.countdownDate");
  const showCountdown = get("maintenance.showCountdown") === "true" && countdownDate;
  const contactEmail = get("site.email") || get("social.email");

  const activeSocials = socialPlatforms.filter((p) => get(p.key));

  // Subtle parallax on mouse move
  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setMousePos({
        x: ((e.clientX - rect.left) / rect.width - 0.5) * 20,
        y: ((e.clientY - rect.top) / rect.height - 0.5) * 20,
      });
    };
    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`min-h-screen relative overflow-hidden ${isRtl ? "rtl" : "ltr"}`}
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* Deep dark background */}
      <div className="absolute inset-0 bg-[#060E15]" />

      {/* Subtle noise texture */}
      <div className="absolute inset-0 opacity-[0.015]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      }} />

      {/* Floating orbs */}
      <FloatingOrbs />

      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#3ECFC0]/30 to-transparent" />

      {/* Language toggle — top corner */}
      <button
        onClick={() => setLang(lang === "ar" ? "en" : "ar")}
        className="absolute top-6 z-20 flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/[0.03] backdrop-blur-md border border-white/[0.06] text-white/50 hover:text-white/80 hover:bg-white/[0.06] hover:border-white/[0.12] transition-all duration-300"
        style={{ [isRtl ? "left" : "right"]: "1.5rem" }}
      >
        <Globe className="w-3.5 h-3.5" />
        <span className="text-xs font-medium tracking-wide">{lang === "ar" ? "English" : "عربي"}</span>
      </button>

      {/* Main content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 py-16">

        {/* Logo with parallax and glow */}
        <div
          className="relative mb-10"
          style={{
            transform: `translate(${mousePos.x * 0.3}px, ${mousePos.y * 0.3}px)`,
            transition: "transform 0.3s ease-out",
          }}
        >
          {/* Outer glow ring */}
          <div className="absolute -inset-8 rounded-full bg-gradient-to-b from-[#3ECFC0]/[0.06] to-[#C9A96E]/[0.04] blur-2xl animate-pulse" />
          {/* Logo container */}
          <div className="relative w-32 h-32 sm:w-40 sm:h-40 flex items-center justify-center">
            <img
              src="/assets/brand/mk-logo-transparent.svg"
              alt="Monthly Key"
              className="w-full h-full object-contain drop-shadow-[0_0_40px_rgba(62,207,192,0.15)]"
            />
            <KeyShimmer />
          </div>
        </div>

        {/* Brand name — refined typography */}
        <div className="text-center mb-3">
          <span className="text-[11px] sm:text-xs font-semibold text-[#3ECFC0]/60 tracking-[0.35em] uppercase">
            {lang === "ar" ? "المفتاح الشهري" : "Monthly Key"}
          </span>
        </div>

        {/* Thin separator */}
        <div className="w-12 h-px bg-gradient-to-r from-transparent via-[#C9A96E]/40 to-transparent mb-8" />

        {/* Title — large, elegant */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white text-center mb-5 leading-[1.1] tracking-tight">
          {title}
        </h1>

        {/* Subtitle */}
        <p className="text-base sm:text-lg md:text-xl text-white/60 text-center max-w-xl mb-10 leading-relaxed font-light">
          {subtitle}
        </p>

        {/* Custom image from admin */}
        {imageUrl && (
          <div className="relative mb-10 max-w-md w-full">
            <div className="rounded-2xl overflow-hidden border border-white/[0.06] shadow-2xl">
              <img src={imageUrl} alt="" className="w-full h-auto object-cover" />
            </div>
            <div className="absolute -inset-3 rounded-3xl bg-gradient-to-b from-[#3ECFC0]/[0.06] to-[#C9A96E]/[0.04] -z-10 blur-2xl" />
          </div>
        )}

        {/* Countdown */}
        {showCountdown && (
          <div className="mb-12">
            <CountdownTimer targetDate={countdownDate} />
          </div>
        )}

        {/* Message card — glassmorphism */}
        <div className="max-w-lg mx-auto mb-12 w-full">
          <div className="relative px-8 py-7 rounded-2xl bg-white/[0.02] backdrop-blur-md border border-white/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
            <p className="text-sm sm:text-base text-white/60 text-center leading-relaxed">
              {message}
            </p>
            {/* Accent tag */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-[#C9A96E] to-[#B8943F] text-white text-[10px] font-bold uppercase tracking-wider shadow-lg">
              {lang === "ar" ? "رسالة" : "Notice"}
            </div>
          </div>
        </div>

        {/* Contact email if available */}
        {contactEmail && (
          <a
            href={`mailto:${contactEmail}`}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/[0.03] border border-white/[0.06] text-white/40 hover:text-white/70 hover:bg-white/[0.06] hover:border-white/[0.12] transition-all duration-300 mb-10 group"
          >
            <Mail className="w-3.5 h-3.5 group-hover:text-[#3ECFC0] transition-colors" />
            <span className="text-xs font-medium tracking-wide">{contactEmail}</span>
          </a>
        )}

        {/* Social Media Links */}
        {activeSocials.length > 0 && (
          <div className="mb-12">
            <p className="text-[10px] text-white/30 text-center mb-4 font-medium uppercase tracking-[0.2em]">
              {lang === "ar" ? "تابعنا" : "Follow Us"}
            </p>
            <div className="flex items-center justify-center gap-2.5 flex-wrap">
              {activeSocials.map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.key}
                    href={get(social.key)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={social.label}
                    className={`group relative w-11 h-11 rounded-xl bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] flex items-center justify-center text-white/30 transition-all duration-300 ${social.hoverColor} hover:border-transparent hover:scale-110 hover:shadow-[0_4px_20px_rgba(0,0,0,0.3)]`}
                  >
                    <Icon className="w-4 h-4 transition-transform duration-300 group-hover:scale-110" />
                    <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 text-[10px] text-white/40 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                      {social.label}
                    </span>
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {/* Decorative divider */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-20 h-px bg-gradient-to-r from-transparent to-[#3ECFC0]/20" />
          <Clock className="w-4 h-4 text-[#3ECFC0]/20" />
          <div className="w-20 h-px bg-gradient-to-l from-transparent to-[#3ECFC0]/20" />
        </div>

        {/* Footer */}
        <p className="text-xs text-white/25 text-center max-w-sm leading-relaxed">
          {lang === "ar"
            ? "نعمل بجد لتقديم أفضل تجربة إيجار شهري في المملكة العربية السعودية"
            : "Working hard to deliver the best monthly rental experience in Saudi Arabia"
          }
        </p>

        {/* Subtle admin login */}
        <a href="/login" className="mt-8 text-[10px] text-white/10 hover:text-white/30 transition-colors duration-500">
          {lang === "ar" ? "دخول الإدارة" : "Admin"}
        </a>
      </div>

      {/* Bottom accent line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#C9A96E]/20 to-transparent" />

      {/* CSS animations */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes orb-drift-0 {
          0% { transform: translate(-50%, -50%) scale(1); }
          100% { transform: translate(-45%, -55%) scale(1.1); }
        }
        @keyframes orb-drift-1 {
          0% { transform: translate(-50%, -50%) scale(1); }
          100% { transform: translate(-55%, -45%) scale(0.9); }
        }
        @keyframes orb-drift-2 {
          0% { transform: translate(-50%, -50%) scale(1); }
          100% { transform: translate(-48%, -52%) scale(1.15); }
        }
        @keyframes orb-drift-3 {
          0% { transform: translate(-50%, -50%) scale(1); }
          100% { transform: translate(-52%, -48%) scale(0.95); }
        }
      `}</style>
    </div>
  );
}
