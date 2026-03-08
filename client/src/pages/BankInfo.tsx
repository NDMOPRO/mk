import { useState } from "react";
import SEOHead from "@/components/SEOHead";
import { useI18n } from "@/lib/i18n";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { toast } from "sonner";
import { Copy, Check, Building2 } from "lucide-react";

function CopyableField({ label, value, accent = "amber" }: { label: string; value: string; accent?: "amber" | "emerald" }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(label + " copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
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

  const accentColors = accent === "amber" 
    ? { label: "text-slate-400", value: "text-amber-300", hover: "hover:bg-slate-700/50", icon: "text-amber-400" }
    : { label: "text-emerald-400", value: "text-emerald-300", hover: "hover:bg-emerald-800/30", icon: "text-emerald-400" };

  return (
    <div
      onClick={handleCopy}
      className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all duration-200 ${accentColors.hover} group active:scale-[0.98]`}
    >
      <div className="flex-1 min-w-0">
        <div className={`text-[10px] ${accentColors.label} uppercase tracking-wider mb-1`}>{label}</div>
        <div className={`text-sm sm:text-base font-mono tracking-wide ${accentColors.value} break-all select-all`}>
          {value}
        </div>
      </div>
      <div className="flex-shrink-0 ml-3 p-2 rounded-lg bg-white/5 transition-all duration-200 group-hover:bg-white/10">
        {copied ? (
          <Check className={`h-4 w-4 ${accentColors.icon}`} />
        ) : (
          <Copy className="h-4 w-4 text-slate-400 group-hover:text-white transition-colors" />
        )}
      </div>
    </div>
  );
}

export default function BankInfo() {
  const { t, lang, dir } = useI18n();
  const { settings, isLoading } = useSiteSettings();
  const isRtl = dir === "rtl";

  const hasBank1 = !!settings["bank.iban"];
  const hasBank2 = !!settings["bank2.iban"];
  const bankEnabled = settings["bank.transferEnabled"] === "true";

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="animate-pulse text-slate-400">Loading...</div>
      </div>
    );
  }

  if (!bankEnabled && !hasBank1 && !hasBank2) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen flex items-center justify-center bg-background">
          <p className="text-muted-foreground">
            {lang === "ar" ? "التحويل البنكي غير متاح حالياً" : "Bank transfer is not available at this time"}
          </p>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <SEOHead
        title={lang === "ar" ? "معلومات التحويل البنكي | المفتاح الشهري" : "Bank Transfer Info | Monthly Key"}
        description={lang === "ar" ? "معلومات الحساب البنكي للتحويل - المفتاح الشهري" : "Bank account details for transfer - Monthly Key"}
      />
      <Navbar />
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 py-12 px-4" dir={dir}>
        <div className="max-w-lg mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-4 py-2 mb-4">
              <Building2 className="h-4 w-4 text-amber-400" />
              <span className="text-sm text-amber-300 font-medium">
                {lang === "ar" ? "معلومات التحويل البنكي" : "Bank Transfer Details"}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
              {lang === "ar" ? "المفتاح الشهري" : "Monthly Key"}
            </h1>
            <p className="text-sm text-slate-400">
              {lang === "ar" ? "اضغط على أي رقم لنسخه" : "Tap any number to copy it"}
            </p>
          </div>

          {/* Bank Card 1 */}
          {hasBank1 && (
            <div className="mb-6">
              <div className="bg-gradient-to-br from-slate-800 via-slate-850 to-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-700/50">
                {/* Card Header */}
                <div className="px-5 pt-5 pb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                      <Building2 className="h-4 w-4 text-amber-400" />
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 uppercase tracking-wider">
                        {lang === "ar" ? "البنك" : "Bank"}
                      </div>
                      <div className="text-sm font-semibold text-white">
                        {(lang === "ar" ? settings["bank.nameAr"] : settings["bank.nameEn"]) || "—"}
                      </div>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-600 font-mono">Monthly Key</div>
                </div>

                {/* Beneficiary */}
                <div className="px-5 pb-2">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
                    {lang === "ar" ? "اسم المستفيد" : "Beneficiary"}
                  </div>
                  <div className="text-sm font-semibold text-white break-words">
                    {settings["bank.accountHolder"] || "—"}
                  </div>
                </div>

                {/* Divider */}
                <div className="mx-5 border-t border-slate-700/50 my-2" />

                {/* Copyable Fields */}
                <div className="px-2 pb-2 space-y-1">
                  {settings["bank.iban"] && (
                    <CopyableField label="IBAN" value={settings["bank.iban"]} accent="amber" />
                  )}
                  {settings["bank.accountNumber"] && (
                    <CopyableField
                      label={lang === "ar" ? "رقم الحساب" : "Account No."}
                      value={settings["bank.accountNumber"]}
                      accent="amber"
                    />
                  )}
                  {settings["bank.swiftCode"] && (
                    <CopyableField label="SWIFT" value={settings["bank.swiftCode"]} accent="amber" />
                  )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 bg-slate-900/50 border-t border-slate-700/30">
                  <p className="text-[10px] text-slate-500 text-center">
                    {lang === "ar" ? "يرجى التحويل ثم إرسال إيصال الدفع" : "Please transfer then send payment receipt"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Bank Card 2 */}
          {hasBank2 && (
            <div className="mb-6">
              <div className="bg-gradient-to-br from-emerald-900 via-emerald-950 to-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-emerald-700/50">
                {/* Card Header */}
                <div className="px-5 pt-5 pb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                      <Building2 className="h-4 w-4 text-emerald-400" />
                    </div>
                    <div>
                      <div className="text-xs text-emerald-500 uppercase tracking-wider">
                        {lang === "ar" ? "البنك" : "Bank"}
                      </div>
                      <div className="text-sm font-semibold text-white">
                        {(lang === "ar" ? settings["bank2.nameAr"] : settings["bank2.nameEn"]) || "—"}
                      </div>
                    </div>
                  </div>
                  <div className="text-[10px] text-emerald-600 font-mono">Monthly Key</div>
                </div>

                {/* Beneficiary */}
                <div className="px-5 pb-2">
                  <div className="text-[10px] text-emerald-500 uppercase tracking-wider mb-1">
                    {lang === "ar" ? "اسم المستفيد" : "Beneficiary"}
                  </div>
                  <div className="text-sm font-semibold text-white break-words">
                    {settings["bank2.accountHolder"] || "—"}
                  </div>
                </div>

                {/* Divider */}
                <div className="mx-5 border-t border-emerald-700/50 my-2" />

                {/* Copyable Fields */}
                <div className="px-2 pb-2 space-y-1">
                  {settings["bank2.iban"] && (
                    <CopyableField label="IBAN" value={settings["bank2.iban"]} accent="emerald" />
                  )}
                  {settings["bank2.accountNumber"] && (
                    <CopyableField
                      label={lang === "ar" ? "رقم الحساب" : "Account No."}
                      value={settings["bank2.accountNumber"]}
                      accent="emerald"
                    />
                  )}
                  {settings["bank2.swiftCode"] && (
                    <CopyableField label="SWIFT" value={settings["bank2.swiftCode"]} accent="emerald" />
                  )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 bg-emerald-950/50 border-t border-emerald-700/30">
                  <p className="text-[10px] text-emerald-500 text-center">
                    {lang === "ar" ? "يرجى التحويل ثم إرسال إيصال الدفع" : "Please transfer then send payment receipt"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Instruction */}
          <div className="text-center mt-6">
            <p className="text-xs text-slate-500">
              {lang === "ar" 
                ? "💡 اضغط على أي حقل لنسخ الرقم تلقائياً" 
                : "💡 Tap any field to automatically copy the number"}
            </p>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
