import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Settings, DollarSign, Shield, Save } from "lucide-react";
import { SettingField } from "./fields";
import type { AdminSettingsCtx } from "./useAdminSettings";

export function FeesTab({ ctx }: { ctx: AdminSettingsCtx }) {
  const { t, lang, dir, isRtl, updateMutation, settings, updateSetting, saveSettings } = ctx;
  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          {t("settings.fees")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SettingField label={t("settings.serviceFee")} settingKey="fees.serviceFeePercent" type="number" placeholder="5" />
          <SettingField label={t("settings.vatPercent")} settingKey="fees.vatPercent" type="number" placeholder="15" />
          <SettingField label={`${t("settings.minRent")} (SAR)`} settingKey="fees.minRent" type="number" placeholder="500" />
          <SettingField label={`${t("settings.maxRent")} (SAR)`} settingKey="fees.maxRent" type="number" placeholder="100000" />
        </div>

        {/* Rental Duration Limits */}
        <div className="border-t pt-6 mt-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            {lang === "ar" ? "حدود مدة الإيجار" : "Rental Duration Limits"}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {lang === "ar" ? "تحديد الحد الأدنى والأقصى لمدة الإيجار المسموح بها على المنصة (بالأشهر)" : "Set the minimum and maximum rental duration allowed on the platform (in months)"}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SettingField label={lang === "ar" ? "الحد الأدنى (أشهر)" : "Minimum Duration (months)"} settingKey="rental.minMonths" type="number" placeholder="1" />
            <SettingField label={lang === "ar" ? "الحد الأقصى (أشهر)" : "Maximum Duration (months)"} settingKey="rental.maxMonths" type="number" placeholder="2" />
          </div>
        </div>

        {/* Calculator Config */}
        <div className="border-t pt-6 mt-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            {lang === "ar" ? "إعدادات حاسبة التكاليف" : "Cost Calculator Settings"}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {lang === "ar" ? "تحكم في المدد المسموحة والتسميات وطريقة احتساب التأمين" : "Control allowed durations, labels, and insurance calculation method"}
          </p>
          <div className="space-y-4">
            {/* Insurance Configuration — Admin-only controls */}
            <div className="p-4 rounded-lg border-2 border-amber-500/30 bg-amber-500/5 space-y-4">
              <h4 className="text-sm font-bold flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <Shield className="h-4 w-4" />
                {lang === "ar" ? "⚙️ إعدادات التأمين (مرئي للأدمن فقط)" : "⚙️ Insurance Settings (Admin-only)"}
              </h4>
              <p className="text-xs text-muted-foreground">
                {lang === "ar"
                  ? "عند تفعيل إخفاء التأمين، سيتم دمج مبلغ التأمين في سعر الإيجار الظاهر للمستأجر. الإجمالي يبقى نفسه."
                  : "When hidden, insurance amount is merged into the displayed rent total. Grand total stays the same."}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Insurance Mode: percentage or fixed */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    {lang === "ar" ? "طريقة احتساب التأمين" : "Insurance Calculation Mode"}
                  </Label>
                  <select
                    value={settings["calculator.insuranceMode"] || "percentage"}
                    onChange={(e) => updateSetting("calculator.insuranceMode", e.target.value)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="percentage">{lang === "ar" ? "نسبة مئوية (%)" : "Percentage (%)"}</option>
                    <option value="fixed">{lang === "ar" ? "مبلغ ثابت (SAR)" : "Fixed Amount (SAR)"}</option>
                  </select>
                </div>
                {/* Conditional: show % field or fixed amount field */}
                {(settings["calculator.insuranceMode"] || "percentage") === "percentage" ? (
                  <SettingField
                    label={lang === "ar" ? "نسبة التأمين %" : "Insurance Rate %"}
                    settingKey="fees.depositPercent"
                    type="number"
                    placeholder="10"
                  />
                ) : (
                  <SettingField
                    label={lang === "ar" ? "مبلغ التأمين الثابت (SAR)" : "Fixed Insurance Amount (SAR)"}
                    settingKey="calculator.insuranceFixedAmount"
                    type="number"
                    placeholder="1000"
                  />
                )}
              </div>
              {/* Hide insurance from tenant toggle */}
              <div className="flex items-center justify-between p-3 rounded-md border bg-background">
                <div>
                  <Label className="text-sm font-medium">
                    {lang === "ar" ? "إخفاء التأمين عن المستأجر" : "Hide Insurance from Tenant"}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {lang === "ar"
                      ? "يدمج التأمين في سعر الإيجار بدون علم المستأجر"
                      : "Merges insurance into rent price without tenant knowing"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => updateSetting(
                    "calculator.hideInsuranceFromTenant",
                    settings["calculator.hideInsuranceFromTenant"] === "true" ? "false" : "true"
                  )}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings["calculator.hideInsuranceFromTenant"] === "true"
                      ? "bg-amber-500"
                      : "bg-gray-300 dark:bg-gray-600"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings["calculator.hideInsuranceFromTenant"] === "true"
                        ? (dir === "rtl" ? "-translate-x-6" : "translate-x-6")
                        : (dir === "rtl" ? "-translate-x-1" : "translate-x-1")
                    }`}
                  />
                </button>
              </div>
            </div>

            <SettingField
              label={lang === "ar" ? "المدد المسموحة (JSON array بالأشهر)" : "Allowed Months (JSON array)"}
              settingKey="calculator.allowedMonths"
              placeholder='[1,2]'
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SettingField label={lang === "ar" ? "تسمية التأمين (عربي)" : "Insurance Label (Arabic)"} settingKey="calculator.insuranceLabelAr" placeholder="التأمين" />
              <SettingField label={lang === "ar" ? "تسمية التأمين (إنجليزي)" : "Insurance Label (English)"} settingKey="calculator.insuranceLabelEn" placeholder="Insurance/Deposit" />
              <SettingField label={lang === "ar" ? "تسمية رسوم الخدمة (عربي)" : "Service Fee Label (Arabic)"} settingKey="calculator.serviceFeeLabelAr" placeholder="رسوم الخدمة" />
              <SettingField label={lang === "ar" ? "تسمية رسوم الخدمة (إنجليزي)" : "Service Fee Label (English)"} settingKey="calculator.serviceFeeLabelEn" placeholder="Service Fee" />
              <SettingField label={lang === "ar" ? "تسمية الضريبة (عربي)" : "VAT Label (Arabic)"} settingKey="calculator.vatLabelAr" placeholder="ضريبة القيمة المضافة" />
              <SettingField label={lang === "ar" ? "تسمية الضريبة (إنجليزي)" : "VAT Label (English)"} settingKey="calculator.vatLabelEn" placeholder="VAT" />
            </div>
            <h4 className="text-sm font-medium text-muted-foreground pt-2">{lang === "ar" ? "نصوص التوضيح (Tooltips)" : "Tooltip Texts"}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SettingField label={lang === "ar" ? "توضيح التأمين (عربي)" : "Insurance Tooltip (AR)"} settingKey="calculator.insuranceTooltipAr" placeholder="مبلغ تأمين قابل للاسترداد" />
              <SettingField label={lang === "ar" ? "توضيح التأمين (إنجليزي)" : "Insurance Tooltip (EN)"} settingKey="calculator.insuranceTooltipEn" placeholder="Refundable security deposit" />
              <SettingField label={lang === "ar" ? "توضيح رسوم الخدمة (عربي)" : "Service Fee Tooltip (AR)"} settingKey="calculator.serviceFeeTooltipAr" placeholder="رسوم إدارة المنصة" />
              <SettingField label={lang === "ar" ? "توضيح رسوم الخدمة (إنجليزي)" : "Service Fee Tooltip (EN)"} settingKey="calculator.serviceFeeTooltipEn" placeholder="Platform management fee" />
              <SettingField label={lang === "ar" ? "توضيح الضريبة (عربي)" : "VAT Tooltip (AR)"} settingKey="calculator.vatTooltipAr" placeholder="ضريبة القيمة المضافة وفقاً لنظام هيئة الزكاة" />
              <SettingField label={lang === "ar" ? "توضيح الضريبة (إنجليزي)" : "VAT Tooltip (EN)"} settingKey="calculator.vatTooltipEn" placeholder="Value Added Tax as per ZATCA" />
            </div>
          </div>
        </div>

        <Button onClick={saveSettings} disabled={updateMutation.isPending}>
          <Save className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
          {t("settings.save")}
        </Button>
      </CardContent>
    </Card>
    </>
  );
}
