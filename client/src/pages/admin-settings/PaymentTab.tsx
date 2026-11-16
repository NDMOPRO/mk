import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Link } from "wouter";
import { Settings, Image, Save, Upload, Building2, Trash2, CreditCard, Copy, Lock, Download, Share2 } from "lucide-react";
import { SettingField } from "./fields";
import { MoyasarStatusIndicator } from "./MoyasarStatusIndicator";
import type { AdminSettingsCtx } from "./useAdminSettings";

export function PaymentTab({ ctx }: { ctx: AdminSettingsCtx }) {
  const { t, lang, isRtl, updateMutation, settings, updateSetting, saveSettings, handleFileUpload, isCurrentUserRootAdmin, bankCardRef, bankCard2Ref } = ctx;
  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          {lang === "ar" ? "إعدادات الدفع" : "Payment Settings"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
            {lang === "ar" ? "PayPal الدفع عبر" : "PayPal Payment"}
          </h3>
          <p className="text-sm text-blue-700 dark:text-blue-300">
            {lang === "ar" 
              ? "قم بإدخال بيانات PayPal الخاصة بك لتفعيل الدفع الإلكتروني. يمكنك الحصول على البيانات من developer.paypal.com" 
              : "Enter your PayPal credentials to enable online payments. Get credentials from developer.paypal.com"}
          </p>
        </div>

        <SettingField 
          label={lang === "ar" ? "PayPal Client ID" : "PayPal Client ID"} 
          settingKey="payment.paypalClientId" 
          placeholder="AYSq3RDGsmBLJE-otTkBtM-jBRd1TCQwFf9RGfwddNXWz0uFU9ztymylOhRS" 
        />
        <SettingField 
          label={lang === "ar" ? "PayPal Secret Key" : "PayPal Secret Key"} 
          settingKey="payment.paypalSecret" 
          placeholder="EGnHDxD_qRPdaLdZz8iCr8N7_MzF-YHPTkjs6NKYQvQSBngp4PTTVWkPZRbL" 
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label>{lang === "ar" ? "الوضع" : "Mode"}</Label>
            <Select 
              value={settings["payment.paypalMode"] || "sandbox"} 
              onValueChange={(v) => updateSetting("payment.paypalMode", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sandbox">{lang === "ar" ? "تجريبي (Sandbox)" : "Sandbox (Testing)"}</SelectItem>
                <SelectItem value="live">{lang === "ar" ? "إنتاجي (Live)" : "Live (Production)"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <SettingField 
            label={lang === "ar" ? "العملة" : "Currency"} 
            settingKey="payment.currency" 
            placeholder="SAR" 
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label>{lang === "ar" ? "تفعيل الدفع الإلكتروني" : "Enable Online Payment"}</Label>
            <Select 
              value={settings["payment.enabled"] || "false"} 
              onValueChange={(v) => updateSetting("payment.enabled", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">{lang === "ar" ? "مفعل" : "Enabled"}</SelectItem>
                <SelectItem value="false">{lang === "ar" ? "معطل" : "Disabled"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{lang === "ar" ? "الدفع عند الاستلام" : "Cash on Delivery"}</Label>
            <Select 
              value={settings["payment.cashEnabled"] || "true"} 
              onValueChange={(v) => updateSetting("payment.cashEnabled", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">{lang === "ar" ? "مفعل" : "Enabled"}</SelectItem>
                <SelectItem value="false">{lang === "ar" ? "معطل" : "Disabled"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button onClick={saveSettings} disabled={updateMutation.isPending} className="w-full md:w-auto">
          <Save className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
          {t("settings.save")}
        </Button>

        {/* ─── Moyasar Payment Section ─── */}
        <div className="border-t border-border pt-6 mt-6" />
        <MoyasarStatusIndicator />
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4">
          <h3 className="font-semibold text-emerald-800 dark:text-emerald-200 mb-2">
            {lang === "ar" ? "الدفع عبر Moyasar" : "Moyasar Payment"}
          </h3>
          <p className="text-sm text-emerald-700 dark:text-emerald-300">
            {lang === "ar" 
              ? "بوابة الدفع الأساسية للسعودية: بطاقات مدى + Apple Pay + Google Pay. احصل على البيانات من dashboard.moyasar.com" 
              : "Primary payment gateway for KSA: mada cards + Apple Pay + Google Pay. Get credentials from dashboard.moyasar.com"}
          </p>
        </div>
        <SettingField 
          label={lang === "ar" ? "Moyasar Publishable Key" : "Moyasar Publishable Key"} 
          settingKey="moyasar.publishableKey" 
          placeholder="pk_test_..." 
        />
        <SettingField 
          label={lang === "ar" ? "Moyasar Secret Key" : "Moyasar Secret Key"} 
          settingKey="moyasar.secretKey" 
          placeholder="sk_test_..." 
        />
        <SettingField 
          label={lang === "ar" ? "Moyasar Webhook Secret" : "Moyasar Webhook Secret"} 
          settingKey="moyasar.webhookSecret" 
          placeholder="whsec_..." 
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label>{lang === "ar" ? "الوضع" : "Mode"}</Label>
            <Select 
              value={settings["moyasar.mode"] || "test"} 
              onValueChange={(v) => updateSetting("moyasar.mode", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="test">{lang === "ar" ? "تجريبي (Test)" : "Test (Sandbox)"}</SelectItem>
                <SelectItem value="live">{lang === "ar" ? "إنتاجي (Live)" : "Live (Production)"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{lang === "ar" ? "العملة" : "Currency"}</Label>
            <div className="flex items-center h-10 px-3 rounded-md border border-input bg-muted text-muted-foreground">
              SAR
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label>{lang === "ar" ? "تفعيل Moyasar" : "Enable Moyasar"}</Label>
            <Select 
              value={settings["moyasar.enabled"] || "false"} 
              onValueChange={(v) => updateSetting("moyasar.enabled", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">{lang === "ar" ? "مفعل" : "Enabled"}</SelectItem>
                <SelectItem value="false">{lang === "ar" ? "معطل" : "Disabled"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {/* Payment Method Toggles */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-4">
          <h4 className="font-medium text-sm">
            {lang === "ar" ? "طرق الدفع المتاحة" : "Available Payment Methods"}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{lang === "ar" ? "بطاقات مدى" : "mada Cards"}</Label>
              <Select 
                value={settings["moyasar.enableMadaCards"] || "true"} 
                onValueChange={(v) => updateSetting("moyasar.enableMadaCards", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">{lang === "ar" ? "مفعل" : "Enabled"}</SelectItem>
                  <SelectItem value="false">{lang === "ar" ? "معطل" : "Disabled"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Apple Pay</Label>
              <Select 
                value={settings["moyasar.enableApplePay"] || "false"} 
                onValueChange={(v) => updateSetting("moyasar.enableApplePay", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">{lang === "ar" ? "مفعل" : "Enabled"}</SelectItem>
                  <SelectItem value="false">{lang === "ar" ? "معطل" : "Disabled"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Google Pay</Label>
              <Select 
                value={settings["moyasar.enableGooglePay"] || "false"} 
                onValueChange={(v) => updateSetting("moyasar.enableGooglePay", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">{lang === "ar" ? "مفعل" : "Enabled"}</SelectItem>
                  <SelectItem value="false">{lang === "ar" ? "معطل" : "Disabled"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {lang === "ar" 
              ? "طرق الدفع تظهر فقط إذا كانت مفعلة ومفاتيح Moyasar مُعدّة. Tabby و Tamara سيتم إضافتهما في المرحلة الثانية." 
              : "Payment methods appear only if enabled AND Moyasar keys are configured. Tabby & Tamara will be added in Phase 2."}
          </p>
        </div>

        {/* ─── Bank Transfer Info Section ─── */}
        <div className="border-t border-border pt-6 mt-6" />
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <h3 className="font-semibold text-amber-800 dark:text-amber-200 mb-2 flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {lang === "ar" ? "معلومات الحساب البنكي للتحويل" : "Bank Transfer Information"}
            {!isCurrentUserRootAdmin && (
              <Badge variant="secondary" className="gap-1"><Lock className="h-3 w-3" />{lang === "ar" ? "للقراءة فقط" : "Read Only"}</Badge>
            )}
          </h3>
          <p className="text-sm text-amber-700 dark:text-amber-300">
            {lang === "ar" 
              ? isCurrentUserRootAdmin 
                ? "أدخل معلومات حسابك البنكي لإرسالها للعملاء عند اختيار التحويل البنكي. يمكنك مشاركة بطاقة البنك مع العملاء." 
                : "فقط المدير الرئيسي يمكنه تعديل معلومات البنك. يمكنك مشاركة البطاقة فقط."
              : isCurrentUserRootAdmin
                ? "Enter your bank account details to share with clients who choose bank transfer."
                : "Only the root admin can edit bank details. You can share the card only."}
          </p>
        </div>

        {/* ─── Bank Account 1 ─── */}
        <h4 className="text-sm font-semibold mt-4 flex items-center gap-2">
          <CreditCard className="h-4 w-4" />
          {lang === "ar" ? "الحساب البنكي الأول" : "Bank Account 1"}
        </h4>
        <SettingField 
          label={lang === "ar" ? "اسم البنك (عربي)" : "Bank Name (Arabic)"} 
          settingKey="bank.nameAr" 
          placeholder={lang === "ar" ? "مثال: البنك الأهلي السعودي" : "e.g. Al Ahli Bank"}
          disabled={!isCurrentUserRootAdmin}
        />
        <SettingField 
          label={lang === "ar" ? "اسم البنك (إنجليزي)" : "Bank Name (English)"} 
          settingKey="bank.nameEn" 
          placeholder={lang === "ar" ? "مثال: Saudi National Bank" : "e.g. Saudi National Bank"}
          disabled={!isCurrentUserRootAdmin}
        />
        <SettingField 
          label={lang === "ar" ? "اسم صاحب الحساب" : "Account Holder Name"} 
          settingKey="bank.accountHolder" 
          placeholder={lang === "ar" ? "الاسم كما يظهر في الحساب البنكي" : "Name as it appears on the bank account"}
          disabled={!isCurrentUserRootAdmin}
        />
        <SettingField 
          label={lang === "ar" ? "رقم الآيبان (IBAN)" : "IBAN Number"} 
          settingKey="bank.iban" 
          placeholder="SA0000000000000000000000"
          disabled={!isCurrentUserRootAdmin}
        />
        <SettingField 
          label={lang === "ar" ? "رقم الحساب" : "Account Number"} 
          settingKey="bank.accountNumber" 
          placeholder={lang === "ar" ? "رقم الحساب البنكي" : "Bank account number"}
          disabled={!isCurrentUserRootAdmin}
        />
        <SettingField 
          label={lang === "ar" ? "رمز السويفت (SWIFT)" : "SWIFT Code"} 
          settingKey="bank.swiftCode" 
          placeholder="NCBKSAJE"
          disabled={!isCurrentUserRootAdmin}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label>{lang === "ar" ? "تفعيل التحويل البنكي" : "Enable Bank Transfer"}</Label>
            <Select 
              value={settings["bank.transferEnabled"] || "false"} 
              onValueChange={(v) => updateSetting("bank.transferEnabled", v)}
              disabled={!isCurrentUserRootAdmin}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">{lang === "ar" ? "مفعل" : "Enabled"}</SelectItem>
                <SelectItem value="false">{lang === "ar" ? "معطل" : "Disabled"}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Bank Page Image */}
          <div className="space-y-2">
            <Label>{lang === "ar" ? "صورة صفحة البنك" : "Bank Page Image"}</Label>
            <p className="text-xs text-muted-foreground">
              {lang === "ar" ? "الصورة التي تظهر في صفحة مشاركة البنك (monthlykey.com/bank)" : "Image shown on the bank share page (monthlykey.com/bank)"}
            </p>
            <div className="flex items-center gap-4">
              {settings["bank.pageImage"] && (
                <img loading="lazy" src={settings["bank.pageImage"]} alt="Bank Page" className="h-16 w-16 object-contain rounded-xl border border-border" />
              )}
              <Button variant="outline" onClick={() => handleFileUpload("bank.pageImage")} disabled={!isCurrentUserRootAdmin}>
                <Upload className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
                {lang === "ar" ? "رفع صورة" : "Upload Image"}
              </Button>
              {settings["bank.pageImage"] && isCurrentUserRootAdmin && (
                <Button variant="ghost" size="sm" onClick={() => updateSetting("bank.pageImage", "")}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Bank Card 1 Preview */}
        {settings["bank.iban"] && (
          <div className="mt-4">
            <h4 className="text-sm font-medium mb-3">
              {lang === "ar" ? "معاينة بطاقة البنك الأول" : "Bank Card 1 Preview"}
            </h4>
            <div ref={bankCardRef} className="max-w-md mx-auto bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 rounded-2xl p-4 sm:p-6 text-white shadow-xl border border-slate-700/50 overflow-hidden">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="#fbbf24" strokeWidth="2"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="#fbbf24" strokeWidth="2"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="#fbbf24" strokeWidth="2"/><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="#fbbf24" strokeWidth="2"/></svg>
                  <span className="text-xs text-slate-400 uppercase tracking-wider">
                    {lang === "ar" ? "معلومات التحويل البنكي" : "Bank Transfer Details"}
                  </span>
                </div>
                <div className="text-xs text-slate-500">Monthly Key</div>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
                    {lang === "ar" ? "البنك" : "Bank"}
                  </div>
                  <div className="text-xs sm:text-sm font-semibold break-words">
                    {(lang === "ar" ? settings["bank.nameAr"] : settings["bank.nameEn"]) || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
                    {lang === "ar" ? "اسم المستفيد" : "Beneficiary"}
                  </div>
                  <div className="text-xs sm:text-sm font-semibold break-words">
                    {settings["bank.accountHolder"] || "—"}
                  </div>
                </div>
                <div className="group/iban cursor-pointer" onClick={() => { navigator.clipboard.writeText(settings["bank.iban"] || ""); toast.success(lang === "ar" ? "تم نسخ الآيبان" : "IBAN copied"); }}>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">IBAN <Copy className="h-3 w-3 opacity-0 group-hover/iban:opacity-100 transition-opacity" /></div>
                  <div className="text-xs sm:text-sm font-mono tracking-wider text-amber-300 break-all">
                    {settings["bank.iban"] || "—"}
                  </div>
                </div>
                {settings["bank.accountNumber"] && (
                  <div className="group/acc cursor-pointer" onClick={() => { navigator.clipboard.writeText(settings["bank.accountNumber"] || ""); toast.success(lang === "ar" ? "تم نسخ رقم الحساب" : "Account number copied"); }}>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                      {lang === "ar" ? "رقم الحساب" : "Account No."} <Copy className="h-3 w-3 opacity-0 group-hover/acc:opacity-100 transition-opacity" />
                    </div>
                    <div className="text-xs sm:text-sm font-mono break-all">{settings["bank.accountNumber"]}</div>
                  </div>
                )}
                {settings["bank.swiftCode"] && (
                  <div className="group/swift cursor-pointer" onClick={() => { navigator.clipboard.writeText(settings["bank.swiftCode"] || ""); toast.success(lang === "ar" ? "تم نسخ رمز السويفت" : "SWIFT code copied"); }}>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">SWIFT <Copy className="h-3 w-3 opacity-0 group-hover/swift:opacity-100 transition-opacity" /></div>
                    <div className="text-sm font-mono">{settings["bank.swiftCode"]}</div>
                  </div>
                )}
              </div>
              <div className="mt-6 pt-4 border-t border-slate-700/50 flex items-center justify-between">
                <span className="text-[10px] text-slate-500">
                  {lang === "ar" ? "يرجى التحويل ثم إرسال إيصال الدفع" : "Please transfer then send payment receipt"}
                </span>
              </div>
            </div>
            <div className="flex justify-center gap-2 mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const bankText = [
                    `${lang === "ar" ? "البنك" : "Bank"}: ${(lang === "ar" ? settings["bank.nameAr"] : settings["bank.nameEn"]) || ""}`,
                    `${lang === "ar" ? "اسم المستفيد" : "Beneficiary"}: ${settings["bank.accountHolder"] || ""}`,
                    `IBAN: ${settings["bank.iban"] || ""}`,
                    settings["bank.accountNumber"] ? `${lang === "ar" ? "رقم الحساب" : "Account No."}: ${settings["bank.accountNumber"]}` : "",
                    settings["bank.swiftCode"] ? `SWIFT: ${settings["bank.swiftCode"]}` : "",
                    "",
                    lang === "ar" ? "يرجى التحويل ثم إرسال إيصال الدفع" : "Please transfer then send payment receipt",
                  ].filter(Boolean).join("\n");
                  navigator.clipboard.writeText(bankText);
                  toast.success(lang === "ar" ? "تم نسخ معلومات البنك" : "Bank info copied to clipboard");
                }}
              >
                <Copy className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
                {lang === "ar" ? "نسخ كنص" : "Copy as Text"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  try {
                    const canvas = document.createElement("canvas");
                    const scale = 2;
                    const w = 500; const h = 380;
                    canvas.width = w * scale; canvas.height = h * scale;
                    const ctx = canvas.getContext("2d");
                    if (!ctx) return;
                    ctx.scale(scale, scale);
                    // Background gradient
                    const grad = ctx.createLinearGradient(0, 0, w, h);
                    grad.addColorStop(0, "#1e293b"); grad.addColorStop(0.5, "#0f172a"); grad.addColorStop(1, "#020617");
                    ctx.fillStyle = grad;
                    ctx.beginPath();
                    ctx.roundRect(0, 0, w, h, 16);
                    ctx.fill();
                    // Border
                    ctx.strokeStyle = "rgba(51,65,85,0.5)"; ctx.lineWidth = 1;
                    ctx.beginPath(); ctx.roundRect(0, 0, w, h, 16); ctx.stroke();
                    // Header
                    ctx.fillStyle = "#fbbf24"; ctx.font = "bold 14px sans-serif";
                    ctx.textAlign = "left";
                    ctx.fillText("\u25A0 " + (lang === "ar" ? "\u0645\u0639\u0644\u0648\u0645\u0627\u062a \u0627\u0644\u062a\u062d\u0648\u064a\u0644 \u0627\u0644\u0628\u0646\u0643\u064a" : "Bank Transfer Details"), 24, 36);
                    ctx.fillStyle = "#475569"; ctx.font = "11px sans-serif";
                    ctx.textAlign = "right";
                    ctx.fillText("Monthly Key", w - 24, 36);
                    ctx.textAlign = "left";
                    let y = 70;
                    const drawField = (label: string, value: string, color = "#ffffff") => {
                      ctx.fillStyle = "#64748b"; ctx.font = "10px sans-serif";
                      ctx.fillText(label.toUpperCase(), 24, y); y += 16;
                      ctx.fillStyle = color; ctx.font = "bold 14px monospace";
                      ctx.fillText(value, 24, y); y += 30;
                    };
                    drawField(lang === "ar" ? "\u0627\u0644\u0628\u0646\u0643" : "Bank", (lang === "ar" ? settings["bank.nameAr"] : settings["bank.nameEn"]) || "\u2014");
                    drawField(lang === "ar" ? "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062a\u0641\u064a\u062f" : "Beneficiary", settings["bank.accountHolder"] || "\u2014");
                    drawField("IBAN", settings["bank.iban"] || "\u2014", "#fcd34d");
                    if (settings["bank.accountNumber"]) drawField(lang === "ar" ? "\u0631\u0642\u0645 \u0627\u0644\u062d\u0633\u0627\u0628" : "Account No.", settings["bank.accountNumber"]);
                    if (settings["bank.swiftCode"]) drawField("SWIFT", settings["bank.swiftCode"]);
                    // Footer line
                    ctx.strokeStyle = "rgba(51,65,85,0.5)"; ctx.lineWidth = 1;
                    ctx.beginPath(); ctx.moveTo(24, h - 40); ctx.lineTo(w - 24, h - 40); ctx.stroke();
                    ctx.fillStyle = "#475569"; ctx.font = "10px sans-serif";
                    ctx.fillText(lang === "ar" ? "\u064a\u0631\u062c\u0649 \u0627\u0644\u062a\u062d\u0648\u064a\u0644 \u062b\u0645 \u0625\u0631\u0633\u0627\u0644 \u0625\u064a\u0635\u0627\u0644 \u0627\u0644\u062f\u0641\u0639" : "Please transfer then send payment receipt", 24, h - 18);
                    // Download
                    const a = document.createElement("a");
                    a.href = canvas.toDataURL("image/png");
                    a.download = "bank-card.png";
                    document.body.appendChild(a); a.click(); document.body.removeChild(a);
                    toast.success(lang === "ar" ? "\u062a\u0645 \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0628\u0637\u0627\u0642\u0629 \u0643\u0635\u0648\u0631\u0629" : "Card downloaded as image");
                  } catch (err) {
                    console.error("Canvas error:", err);
                    toast.error(lang === "ar" ? "\u0641\u0634\u0644 \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0635\u0648\u0631\u0629" : "Failed to download image");
                  }
                }}
              >
                <Download className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
                {lang === "ar" ? "\u062a\u062d\u0645\u064a\u0644 \u0643\u0635\u0648\u0631\u0629" : "Download as Image"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const url = window.location.origin + "/bank";
                  navigator.clipboard.writeText(url);
                  toast.success(lang === "ar" ? "تم نسخ رابط المشاركة" : "Share link copied");
                }}
              >
                <Share2 className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
                {lang === "ar" ? "نسخ رابط المشاركة" : "Copy Share Link"}
              </Button>
            </div>
          </div>
        )}

        {/* ─── Bank Account 2 ─── */}
        <div className="border-t border-border pt-6 mt-6" />
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <CreditCard className="h-4 w-4" />
          {lang === "ar" ? "الحساب البنكي الثاني (اختياري)" : "Bank Account 2 (Optional)"}
        </h4>
        <SettingField 
          label={lang === "ar" ? "اسم البنك (عربي)" : "Bank Name (Arabic)"} 
          settingKey="bank2.nameAr" 
          placeholder={lang === "ar" ? "مثال: بنك الراجحي" : "e.g. Al Rajhi Bank"}
          disabled={!isCurrentUserRootAdmin}
        />
        <SettingField 
          label={lang === "ar" ? "اسم البنك (إنجليزي)" : "Bank Name (English)"} 
          settingKey="bank2.nameEn" 
          placeholder={lang === "ar" ? "مثال: Al Rajhi Bank" : "e.g. Al Rajhi Bank"}
          disabled={!isCurrentUserRootAdmin}
        />
        <SettingField 
          label={lang === "ar" ? "اسم صاحب الحساب" : "Account Holder Name"} 
          settingKey="bank2.accountHolder" 
          placeholder={lang === "ar" ? "الاسم كما يظهر في الحساب البنكي" : "Name as it appears on the bank account"}
          disabled={!isCurrentUserRootAdmin}
        />
        <SettingField 
          label={lang === "ar" ? "رقم الآيبان (IBAN)" : "IBAN Number"} 
          settingKey="bank2.iban" 
          placeholder="SA0000000000000000000000"
          disabled={!isCurrentUserRootAdmin}
        />
        <SettingField 
          label={lang === "ar" ? "رقم الحساب" : "Account Number"} 
          settingKey="bank2.accountNumber" 
          placeholder={lang === "ar" ? "رقم الحساب البنكي" : "Bank account number"}
          disabled={!isCurrentUserRootAdmin}
        />
        <SettingField 
          label={lang === "ar" ? "رمز السويفت (SWIFT)" : "SWIFT Code"} 
          settingKey="bank2.swiftCode" 
          placeholder="RJHISARI"
          disabled={!isCurrentUserRootAdmin}
        />

        {/* Bank Card 2 Preview */}
        {settings["bank2.iban"] && (
          <div className="mt-4">
            <h4 className="text-sm font-medium mb-3">
              {lang === "ar" ? "معاينة بطاقة البنك الثاني" : "Bank Card 2 Preview"}
            </h4>
            <div ref={bankCard2Ref} className="max-w-md mx-auto bg-gradient-to-br from-emerald-800 via-emerald-900 to-emerald-950 rounded-2xl p-4 sm:p-6 text-white shadow-xl border border-emerald-700/50 overflow-hidden">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="#34d399" strokeWidth="2"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="#34d399" strokeWidth="2"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="#34d399" strokeWidth="2"/><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="#34d399" strokeWidth="2"/></svg>
                  <span className="text-xs text-emerald-400 uppercase tracking-wider">
                    {lang === "ar" ? "معلومات التحويل البنكي" : "Bank Transfer Details"}
                  </span>
                </div>
                <div className="text-xs text-emerald-500">Monthly Key</div>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="text-[10px] text-emerald-500 uppercase tracking-wider mb-1">
                    {lang === "ar" ? "البنك" : "Bank"}
                  </div>
                  <div className="text-xs sm:text-sm font-semibold break-words">
                    {(lang === "ar" ? settings["bank2.nameAr"] : settings["bank2.nameEn"]) || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-emerald-500 uppercase tracking-wider mb-1">
                    {lang === "ar" ? "اسم المستفيد" : "Beneficiary"}
                  </div>
                  <div className="text-xs sm:text-sm font-semibold break-words">
                    {settings["bank2.accountHolder"] || "—"}
                  </div>
                </div>
                <div className="group/iban2 cursor-pointer" onClick={() => { navigator.clipboard.writeText(settings["bank2.iban"] || ""); toast.success(lang === "ar" ? "تم نسخ الآيبان" : "IBAN copied"); }}>
                  <div className="text-[10px] text-emerald-500 uppercase tracking-wider mb-1 flex items-center gap-1">IBAN <Copy className="h-3 w-3 opacity-0 group-hover/iban2:opacity-100 transition-opacity" /></div>
                  <div className="text-xs sm:text-sm font-mono tracking-wider text-emerald-300 break-all">
                    {settings["bank2.iban"] || "—"}
                  </div>
                </div>
                {settings["bank2.accountNumber"] && (
                  <div className="group/acc2 cursor-pointer" onClick={() => { navigator.clipboard.writeText(settings["bank2.accountNumber"] || ""); toast.success(lang === "ar" ? "تم نسخ رقم الحساب" : "Account number copied"); }}>
                    <div className="text-[10px] text-emerald-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                      {lang === "ar" ? "رقم الحساب" : "Account No."} <Copy className="h-3 w-3 opacity-0 group-hover/acc2:opacity-100 transition-opacity" />
                    </div>
                    <div className="text-xs sm:text-sm font-mono break-all">{settings["bank2.accountNumber"]}</div>
                  </div>
                )}
                {settings["bank2.swiftCode"] && (
                  <div className="group/swift2 cursor-pointer" onClick={() => { navigator.clipboard.writeText(settings["bank2.swiftCode"] || ""); toast.success(lang === "ar" ? "تم نسخ رمز السويفت" : "SWIFT code copied"); }}>
                    <div className="text-[10px] text-emerald-500 uppercase tracking-wider mb-1 flex items-center gap-1">SWIFT <Copy className="h-3 w-3 opacity-0 group-hover/swift2:opacity-100 transition-opacity" /></div>
                    <div className="text-sm font-mono">{settings["bank2.swiftCode"]}</div>
                  </div>
                )}
              </div>
              <div className="mt-6 pt-4 border-t border-emerald-700/50 flex items-center justify-between">
                <span className="text-[10px] text-emerald-500">
                  {lang === "ar" ? "يرجى التحويل ثم إرسال إيصال الدفع" : "Please transfer then send payment receipt"}
                </span>
              </div>
            </div>
            <div className="flex justify-center gap-2 mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const bankText = [
                    `${lang === "ar" ? "البنك" : "Bank"}: ${(lang === "ar" ? settings["bank2.nameAr"] : settings["bank2.nameEn"]) || ""}`,
                    `${lang === "ar" ? "اسم المستفيد" : "Beneficiary"}: ${settings["bank2.accountHolder"] || ""}`,
                    `IBAN: ${settings["bank2.iban"] || ""}`,
                    settings["bank2.accountNumber"] ? `${lang === "ar" ? "رقم الحساب" : "Account No."}: ${settings["bank2.accountNumber"]}` : "",
                    settings["bank2.swiftCode"] ? `SWIFT: ${settings["bank2.swiftCode"]}` : "",
                    "",
                    lang === "ar" ? "يرجى التحويل ثم إرسال إيصال الدفع" : "Please transfer then send payment receipt",
                  ].filter(Boolean).join("\n");
                  navigator.clipboard.writeText(bankText);
                  toast.success(lang === "ar" ? "تم نسخ معلومات البنك" : "Bank info copied to clipboard");
                }}
              >
                <Copy className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
                {lang === "ar" ? "نسخ كنص" : "Copy as Text"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  try {
                    const canvas = document.createElement("canvas");
                    const scale = 2;
                    const w = 500; const h = 380;
                    canvas.width = w * scale; canvas.height = h * scale;
                    const ctx = canvas.getContext("2d");
                    if (!ctx) return;
                    ctx.scale(scale, scale);
                    const grad = ctx.createLinearGradient(0, 0, w, h);
                    grad.addColorStop(0, "#064e3b"); grad.addColorStop(0.5, "#022c22"); grad.addColorStop(1, "#0f172a");
                    ctx.fillStyle = grad;
                    ctx.beginPath(); ctx.roundRect(0, 0, w, h, 16); ctx.fill();
                    ctx.strokeStyle = "rgba(6,95,70,0.5)"; ctx.lineWidth = 1;
                    ctx.beginPath(); ctx.roundRect(0, 0, w, h, 16); ctx.stroke();
                    ctx.fillStyle = "#34d399"; ctx.font = "bold 14px sans-serif";
                    ctx.textAlign = "left";
                    ctx.fillText("\u25A0 " + (lang === "ar" ? "\u0645\u0639\u0644\u0648\u0645\u0627\u062a \u0627\u0644\u062a\u062d\u0648\u064a\u0644 \u0627\u0644\u0628\u0646\u0643\u064a" : "Bank Transfer Details"), 24, 36);
                    ctx.fillStyle = "#065f46"; ctx.font = "11px sans-serif";
                    ctx.textAlign = "right";
                    ctx.fillText("Monthly Key", w - 24, 36);
                    ctx.textAlign = "left";
                    let y = 70;
                    const drawField = (label: string, value: string, color = "#ffffff") => {
                      ctx.fillStyle = "#34d399"; ctx.font = "10px sans-serif";
                      ctx.fillText(label.toUpperCase(), 24, y); y += 16;
                      ctx.fillStyle = color; ctx.font = "bold 14px monospace";
                      ctx.fillText(value, 24, y); y += 30;
                    };
                    drawField(lang === "ar" ? "\u0627\u0644\u0628\u0646\u0643" : "Bank", (lang === "ar" ? settings["bank2.nameAr"] : settings["bank2.nameEn"]) || "\u2014");
                    drawField(lang === "ar" ? "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062a\u0641\u064a\u062f" : "Beneficiary", settings["bank2.accountHolder"] || "\u2014");
                    drawField("IBAN", settings["bank2.iban"] || "\u2014", "#6ee7b7");
                    if (settings["bank2.accountNumber"]) drawField(lang === "ar" ? "\u0631\u0642\u0645 \u0627\u0644\u062d\u0633\u0627\u0628" : "Account No.", settings["bank2.accountNumber"]);
                    if (settings["bank2.swiftCode"]) drawField("SWIFT", settings["bank2.swiftCode"]);
                    ctx.strokeStyle = "rgba(6,95,70,0.5)"; ctx.lineWidth = 1;
                    ctx.beginPath(); ctx.moveTo(24, h - 40); ctx.lineTo(w - 24, h - 40); ctx.stroke();
                    ctx.fillStyle = "#065f46"; ctx.font = "10px sans-serif";
                    ctx.fillText(lang === "ar" ? "\u064a\u0631\u062c\u0649 \u0627\u0644\u062a\u062d\u0648\u064a\u0644 \u062b\u0645 \u0625\u0631\u0633\u0627\u0644 \u0625\u064a\u0635\u0627\u0644 \u0627\u0644\u062f\u0641\u0639" : "Please transfer then send payment receipt", 24, h - 18);
                    const a = document.createElement("a");
                    a.href = canvas.toDataURL("image/png");
                    a.download = "bank-card-2.png";
                    document.body.appendChild(a); a.click(); document.body.removeChild(a);
                    toast.success(lang === "ar" ? "\u062a\u0645 \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0628\u0637\u0627\u0642\u0629 \u0643\u0635\u0648\u0631\u0629" : "Card downloaded as image");
                  } catch (err) {
                    console.error("Canvas error:", err);
                    toast.error(lang === "ar" ? "\u0641\u0634\u0644 \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0635\u0648\u0631\u0629" : "Failed to download image");
                  }
                }}
              >
                <Download className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
                {lang === "ar" ? "\u062a\u062d\u0645\u064a\u0644 \u0643\u0635\u0648\u0631\u0629" : "Download as Image"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const url = window.location.origin + "/bank";
                  navigator.clipboard.writeText(url);
                  toast.success(lang === "ar" ? "تم نسخ رابط المشاركة" : "Share link copied");
                }}
              >
                <Share2 className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
                {lang === "ar" ? "نسخ رابط المشاركة" : "Copy Share Link"}
              </Button>
            </div>
          </div>
        )}

        {isCurrentUserRootAdmin && (
          <Button onClick={saveSettings} disabled={updateMutation.isPending} className="w-full md:w-auto mt-4">
            <Save className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
            {t("settings.save")}
          </Button>
        )}
      </CardContent>
    </Card>
    </>
  );
}
