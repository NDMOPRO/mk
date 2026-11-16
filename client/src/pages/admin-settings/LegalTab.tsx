import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Shield, Save } from "lucide-react";
import { SettingField, BilingualField } from "./fields";
import type { AdminSettingsCtx } from "./useAdminSettings";

export function LegalTab({ ctx }: { ctx: AdminSettingsCtx }) {
  const { t, lang, isRtl, updateMutation, settings, saveSettings } = ctx;
  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          {t("settings.legal")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Licence & Registration Numbers */}
        <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
          <h3 className="font-semibold text-primary flex items-center gap-2">
            <Shield className="h-4 w-4" />
            {lang === "ar" ? "التراخيص والتسجيل" : "Licences & Registration"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {lang === "ar" ? "أرقام التراخيص والتسجيل المطلوبة حسب الأنظمة السعودية — تظهر في أسفل الموقع" : "Required licence and registration numbers per Saudi regulations — displayed in the website footer"}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SettingField label={lang === "ar" ? "رقم ترخيص وزارة السياحة" : "Tourism Licence Number (MoT)"} settingKey="legal.tourismLicence" placeholder={lang === "ar" ? "أدخل رقم الترخيص السياحي" : "Enter tourism licence number"} />
            <SettingField label={lang === "ar" ? "رقم السجل التجاري" : "Commercial Registration (CR)"} settingKey="legal.crNumber" placeholder={lang === "ar" ? "أدخل رقم السجل التجاري" : "Enter CR number"} />
            <SettingField label={lang === "ar" ? "الرقم الضريبي (ضريبة القيمة المضافة)" : "VAT Registration Number"} settingKey="legal.vatNumber" placeholder={lang === "ar" ? "أدخل الرقم الضريبي" : "Enter VAT number"} />
            <SettingField label={lang === "ar" ? "رقم ترخيص إيجار" : "Ejar Licence Number"} settingKey="legal.ejarLicence" placeholder={lang === "ar" ? "أدخل رقم ترخيص إيجار" : "Enter Ejar licence number"} />
          </div>
        </div>

        {/* Terms & Privacy Content */}
        <BilingualField labelAr={t("settings.terms")} labelEn={t("settings.terms")} keyAr="terms.contentAr" keyEn="terms.contentEn" type="textarea" />
        <BilingualField labelAr={t("settings.privacy")} labelEn={t("settings.privacy")} keyAr="privacy.contentAr" keyEn="privacy.contentEn" type="textarea" />

        <Button onClick={saveSettings} disabled={updateMutation.isPending}>
          <Save className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
          {t("settings.save")}
        </Button>
      </CardContent>
    </Card>
    </>
  );
}
