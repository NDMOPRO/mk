/*
 * Home Page - Monthly Key (المفتاح الشهري)
 * Telegram Mini App - Smart redirect/launcher for monthlykey.com
 *
 * Strategy:
 * - Inside Telegram: use Telegram.WebApp.openLink() to open monthlykey.com in browser
 * - Outside Telegram: auto-redirect via window.location.href after 2s, or on button click
 * - Shows a beautiful branded splash while the redirect happens
 */
import { useTelegramWebApp } from "@/hooks/useTelegramWebApp";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const TARGET_URL = "https://monthlykey.com";

export default function Home() {
  const { isReady, isTelegram, webApp } = useTelegramWebApp();
  const [countdown, setCountdown] = useState(3);
  const [redirected, setRedirected] = useState(false);

  // Handle the actual redirect/open logic
  const openSite = () => {
    if (isTelegram && webApp) {
      // Inside Telegram: use openLink to open in the system browser
      webApp.openLink(TARGET_URL);
    } else {
      // Outside Telegram: direct navigation
      window.location.href = TARGET_URL;
    }
    setRedirected(true);
  };

  // Auto-redirect countdown
  useEffect(() => {
    if (!isReady) return;
    if (countdown <= 0) {
      openSite();
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, countdown]);

  return (
    <div
      dir="rtl"
      style={{
        minHeight: "100vh",
        background: "linear-gradient(160deg, #0A1628 0%, #0E4D5E 50%, #0E7490 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        fontFamily: "'Cairo', 'Tajawal', sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Decorative background circles */}
      <div style={{
        position: "absolute", top: "-80px", right: "-80px",
        width: 300, height: 300, borderRadius: "50%",
        background: "rgba(255,255,255,0.04)", pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", bottom: "-60px", left: "-60px",
        width: 240, height: 240, borderRadius: "50%",
        background: "rgba(249,115,22,0.08)", pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", top: "40%", left: "-40px",
        width: 160, height: 160, borderRadius: "50%",
        background: "rgba(255,255,255,0.03)", pointerEvents: "none",
      }} />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          maxWidth: 380,
          width: "100%",
          zIndex: 1,
        }}
      >
        {/* Logo Icon */}
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.6, type: "spring", stiffness: 200 }}
          style={{
            width: 88,
            height: 88,
            borderRadius: 24,
            background: "linear-gradient(135deg, #0E7490, #06B6D4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 24,
            boxShadow: "0 20px 60px rgba(14,116,144,0.5), 0 0 0 1px rgba(255,255,255,0.1)",
          }}
        >
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
          </svg>
        </motion.div>

        {/* Brand Name */}
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.5 }}
          style={{
            fontSize: 34,
            fontWeight: 800,
            color: "#FFFFFF",
            marginBottom: 6,
            letterSpacing: "-0.5px",
            fontFamily: "'Cairo', sans-serif",
          }}
        >
          المفتاح الشهري
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.5 }}
          style={{
            fontSize: 14,
            color: "rgba(255,255,255,0.65)",
            marginBottom: 8,
            fontFamily: "'DM Sans', 'Inter', sans-serif",
            letterSpacing: "0.3px",
          }}
        >
          Monthly Key
        </motion.p>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.5 }}
          style={{
            fontSize: 15,
            color: "rgba(255,255,255,0.75)",
            marginBottom: 36,
            lineHeight: 1.7,
            fontFamily: "'Tajawal', sans-serif",
            maxWidth: 300,
          }}
        >
          خبير الإيجار الشهري الآن في المملكة العربية السعودية
        </motion.p>

        {/* Main CTA Button */}
        <motion.button
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.55, duration: 0.5, type: "spring" }}
          onClick={openSite}
          whileTap={{ scale: 0.97 }}
          style={{
            width: "100%",
            padding: "16px 24px",
            borderRadius: 16,
            background: "linear-gradient(135deg, #F97316, #EA580C)",
            border: "none",
            color: "#FFFFFF",
            fontSize: 17,
            fontWeight: 700,
            fontFamily: "'Cairo', sans-serif",
            cursor: "pointer",
            boxShadow: "0 12px 40px rgba(249,115,22,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            marginBottom: 16,
            letterSpacing: "0.2px",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
          فتح الموقع الرسمي
        </motion.button>

        {/* Secondary English button */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.65, duration: 0.5 }}
          onClick={openSite}
          whileTap={{ scale: 0.97 }}
          style={{
            width: "100%",
            padding: "13px 24px",
            borderRadius: 14,
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.18)",
            color: "rgba(255,255,255,0.85)",
            fontSize: 14,
            fontWeight: 600,
            fontFamily: "'DM Sans', 'Inter', sans-serif",
            cursor: "pointer",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            marginBottom: 32,
          }}
        >
          Open Monthly Key Website
        </motion.button>

        {/* Auto-redirect notice */}
        <AnimatePresence>
          {!redirected && countdown > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: "rgba(255,255,255,0.45)",
                fontSize: 12,
                fontFamily: "'Tajawal', 'Inter', sans-serif",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              سيتم التوجيه تلقائياً خلال {countdown} ثوانٍ
            </motion.div>
          )}
          {redirected && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: "rgba(134,239,172,0.9)",
                fontSize: 13,
                fontFamily: "'Tajawal', sans-serif",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              جاري فتح الموقع...
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          style={{
            display: "flex",
            gap: 0,
            marginTop: 40,
            width: "100%",
            background: "rgba(255,255,255,0.06)",
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.1)",
            overflow: "hidden",
          }}
        >
          {[
            { valueAr: "+٥٠٠", labelAr: "عقار", valueEn: "500+", labelEn: "Properties" },
            { valueAr: "+٩", labelAr: "مدينة", valueEn: "9+", labelEn: "Cities" },
            { valueAr: "٢٤/٧", labelAr: "دعم", valueEn: "24/7", labelEn: "Support" },
          ].map((stat, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                padding: "14px 8px",
                textAlign: "center",
                borderRight: i < 2 ? "1px solid rgba(255,255,255,0.08)" : "none",
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 800, color: "#FFFFFF", fontFamily: "'Cairo', sans-serif" }}>
                {stat.valueAr}
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2, fontFamily: "'Tajawal', sans-serif" }}>
                {stat.labelAr}
              </div>
            </div>
          ))}
        </motion.div>

        {/* URL display */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.5 }}
          style={{
            marginTop: 20,
            fontSize: 11,
            color: "rgba(255,255,255,0.3)",
            fontFamily: "'Inter', sans-serif",
            direction: "ltr",
          }}
        >
          monthlykey.com
        </motion.p>
      </motion.div>
    </div>
  );
}
