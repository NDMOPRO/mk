import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { Copy, Check, Building2, CreditCard } from "lucide-react";

function CopyableField({ label, value, accent = "gold" }: { label: string; value: string; accent?: "gold" | "emerald" }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(label + " copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      toast.success(label + " copied");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const styles = accent === "gold"
    ? {
        bg: "hover:bg-amber-900/20",
        label: "text-amber-500/70",
        value: "text-amber-100",
        iconBg: "bg-amber-500/10 group-hover:bg-amber-500/20",
        icon: "text-amber-400",
        border: "border-amber-500/10",
      }
    : {
        bg: "hover:bg-emerald-900/20",
        label: "text-emerald-500/70",
        value: "text-emerald-100",
        iconBg: "bg-emerald-500/10 group-hover:bg-emerald-500/20",
        icon: "text-emerald-400",
        border: "border-emerald-500/10",
      };

  return (
    <div
      onClick={handleCopy}
      className={`flex items-center justify-between px-5 py-3.5 cursor-pointer transition-all duration-300 ${styles.bg} group active:scale-[0.99] border-b ${styles.border} last:border-b-0`}
    >
      <div className="flex-1 min-w-0">
        <div className={`text-[10px] ${styles.label} uppercase tracking-[0.2em] mb-1.5 font-medium`}>{label}</div>
        <div className={`text-sm sm:text-base font-mono tracking-wider ${styles.value} break-all select-all`}>
          {value}
        </div>
      </div>
      <div className={`flex-shrink-0 ml-3 p-2.5 rounded-xl ${styles.iconBg} transition-all duration-300`}>
        {copied ? (
          <Check className={`h-4 w-4 ${styles.icon}`} />
        ) : (
          <Copy className="h-4 w-4 text-slate-500 group-hover:text-white transition-colors duration-300" />
        )}
      </div>
    </div>
  );
}

function BankCard({
  prefix,
  accent = "gold",
  lang,
  settings
}: {
  prefix: string;
  accent?: "gold" | "emerald";
  lang: string;
  settings: Record<string, string>;
}) {
  const bankNameAr = settings[`${prefix}.nameAr`];
  const bankNameEn = settings[`${prefix}.nameEn`];
  const accountHolder = settings[`${prefix}.accountHolder`];
  const iban = settings[`${prefix}.iban`];
  const accountNumber = settings[`${prefix}.accountNumber`];
  const swiftCode = settings[`${prefix}.swiftCode`];

  if (!iban) return null;

  const isGold = accent === "gold";
  const cardGradient = isGold
    ? "from-[#1a1a2e] via-[#16213e] to-[#0f0f23]"
    : "from-[#0a1f1a] via-[#0d2818] to-[#0a1a2e]";
  const borderColor = isGold ? "border-amber-500/20" : "border-emerald-500/20";
  const headerBg = isGold ? "bg-gradient-to-r from-amber-500/5 to-transparent" : "bg-gradient-to-r from-emerald-500/5 to-transparent";
  const accentColor = isGold ? "text-amber-400" : "text-emerald-400";
  const dotColor = isGold ? "bg-amber-400" : "bg-emerald-400";
  const footerBg = isGold ? "bg-amber-500/5" : "bg-emerald-500/5";
  const footerBorder = isGold ? "border-amber-500/10" : "border-emerald-500/10";

  return (
    <div className="mb-8">
      <div className={`bg-gradient-to-br ${cardGradient} rounded-3xl overflow-hidden shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] border ${borderColor} backdrop-blur-xl`}>
        <div className={`h-[2px] bg-gradient-to-r ${isGold ? "from-transparent via-amber-500/50 to-transparent" : "from-transparent via-emerald-500/50 to-transparent"}`} />
        <div className={`px-6 pt-6 pb-4 ${headerBg}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl ${isGold ? "bg-amber-500/15 ring-1 ring-amber-500/20" : "bg-emerald-500/15 ring-1 ring-emerald-500/20"} flex items-center justify-center`}>
                <Building2 className={`h-5 w-5 ${accentColor}`} />
              </div>
              <div>
                <div className={`text-[10px] ${isGold ? "text-amber-500/60" : "text-emerald-500/60"} uppercase tracking-[0.2em] font-medium`}>
                  {lang === "ar" ? "البنك" : "Bank"}
                </div>
                <div className="text-base font-bold text-white mt-0.5">
                  {(lang === "ar" ? bankNameAr : bankNameEn) || "—"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${dotColor} animate-pulse`} />
              <CreditCard className={`h-4 w-4 ${isGold ? "text-amber-500/40" : "text-emerald-500/40"}`} />
            </div>
          </div>
        </div>
        <div className="px-6 pb-4">
          <div className={`text-[10px] ${isGold ? "text-amber-500/50" : "text-emerald-500/50"} uppercase tracking-[0.2em] mb-1 font-medium`}>
            {lang === "ar" ? "اسم المستفيد" : "Beneficiary"}
          </div>
          <div className="text-sm font-semibold text-white/90 break-words">
            {accountHolder || "—"}
          </div>
        </div>
        <div className={`mx-6 h-px ${isGold ? "bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" : "bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent"}`} />
        <div className="py-2">
          {iban && <CopyableField label="IBAN" value={iban} accent={accent} />}
          {accountNumber && (
            <CopyableField
              label={lang === "ar" ? "رقم الحساب" : "Account No."}
              value={accountNumber}
              accent={accent}
            />
          )}
          {swiftCode && <CopyableField label="SWIFT / BIC" value={swiftCode} accent={accent} />}
        </div>
        <div className={`px-6 py-4 ${footerBg} border-t ${footerBorder}`}>
          <p className={`text-[11px] ${isGold ? "text-amber-500/50" : "text-emerald-500/50"} text-center font-medium tracking-wide`}>
            {lang === "ar" ? "يرجى التحويل ثم إرسال إيصال الدفع" : "Please transfer then send payment receipt"}
          </p>
        </div>
      </div>
    </div>
  );
}

// Lightweight data fetcher — only fetches bank-related settings
function useBankSettings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/trpc/siteSettings.getAll")
      .then(res => res.json())
      .then(data => {
        // tRPC response format: { result: { data: { json: { key: value, ... } } } }
        const json = data?.result?.data?.json;
        if (json && typeof json === "object") {
          setSettings(json as Record<string, string>);
        }
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, []);

  return { settings, isLoading };
}

export default function BankInfo() {
  const { lang } = useI18n();
  const { settings, isLoading } = useBankSettings();
  const dir = lang === "ar" ? "rtl" : "ltr";

  const hasBank1 = !!settings["bank.iban"];
  const hasBank2 = !!settings["bank2.iban"];
  const bankEnabled = settings["bank.transferEnabled"] === "true";
  const logoUrl = settings["site.logoUrl"];
  const bankPageImage = settings["bank.pageImage"];
  const displayImage = bankPageImage || logoUrl;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0c1524]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-400 rounded-full animate-spin" />
          <div className="text-sm text-slate-500 animate-pulse">
            {lang === "ar" ? "جاري التحميل..." : "Loading..."}
          </div>
        </div>
      </div>
    );
  }

  if (!hasBank1 && !hasBank2) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0c1524]">
        <p className="text-slate-500">
          {lang === "ar" ? "التحويل البنكي غير متاح حالياً" : "Bank transfer is not available at this time"}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0c1524] relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-gradient-radial from-amber-500/[0.04] to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-gradient-radial from-blue-500/[0.02] to-transparent rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 py-10 px-4">
        <div className="max-w-lg mx-auto">

          {/* Premium Header: Logo + Arabic + English */}
          <div className="text-center mb-10">
            <div className="flex flex-col items-center gap-4 mb-6">
              {displayImage && (
                <div className="relative">
                  <div className="absolute inset-0 bg-amber-500/10 rounded-3xl blur-3xl scale-150" />
                  <img
                    src={displayImage}
                    alt="Monthly Key"
                    className="relative h-24 w-24 sm:h-28 sm:w-28 object-contain drop-shadow-[0_0_30px_rgba(217,170,60,0.15)]"
                  />
                </div>
              )}
              <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-tight" style={{ fontFamily: "'Tajawal', 'Cairo', sans-serif" }}>
                المفتاح الشهري
              </h1>
              <p className="text-sm sm:text-base text-amber-400/70 font-semibold tracking-[0.25em] uppercase">
                Monthly Key
              </p>
            </div>

            <p className="text-sm text-slate-500 mb-6 font-medium">
              {lang === "ar"
                ? "منصة التأجير الشهري الرائدة في السعودية"
                : "Premium Monthly Rentals in Saudi Arabia"}
            </p>

            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="h-px w-16 bg-gradient-to-r from-transparent to-amber-500/30" />
              <div className="flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-amber-500/30" />
                <div className="w-2 h-2 rounded-full bg-amber-400/50 ring-2 ring-amber-400/20" />
                <div className="w-1 h-1 rounded-full bg-amber-500/30" />
              </div>
              <div className="h-px w-16 bg-gradient-to-l from-transparent to-amber-500/30" />
            </div>

            <div className="inline-flex items-center gap-2.5 bg-white/[0.03] border border-white/[0.06] rounded-full px-6 py-3 backdrop-blur-sm">
              <Building2 className="h-4 w-4 text-amber-400/80" />
              <span className="text-xs text-slate-400 font-medium tracking-wider uppercase">
                {lang === "ar" ? "معلومات التحويل البنكي" : "Bank Transfer Details"}
              </span>
            </div>

            <p className="text-xs text-slate-600 mt-5 tracking-wide">
              {lang === "ar" ? "اضغط على أي رقم لنسخه تلقائياً" : "Tap any number to copy it instantly"}
            </p>
          </div>

          {/* Bank Cards */}
          {hasBank1 && <BankCard prefix="bank" accent="gold" lang={lang} settings={settings} />}
          {hasBank2 && <BankCard prefix="bank2" accent="emerald" lang={lang} settings={settings} />}

          {/* Bottom watermark */}
          <div className="text-center mt-4 mb-8">
            <p className="text-[10px] text-slate-700 tracking-[0.3em] uppercase font-medium">
              monthlykey.com
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
