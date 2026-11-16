import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, Globe } from "lucide-react";
import { SettingField, BilingualField } from "./fields";
import type { AdminSettingsCtx } from "./useAdminSettings";

export function FooterTab({ ctx }: { ctx: AdminSettingsCtx }) {
  const { t, isRtl, updateMutation, settings, saveSettings } = ctx;
  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          {t("settings.footer")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <BilingualField labelAr={t("settings.aboutText")} labelEn={t("settings.aboutText")} keyAr="footer.aboutAr" keyEn="footer.aboutEn" type="textarea" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SettingField label={t("settings.email")} settingKey="footer.email" placeholder="info@monthlykey.sa" />
          <SettingField label={t("settings.phone")} settingKey="footer.phone" placeholder="+966500000000" />
        </div>
        <BilingualField labelAr={t("settings.address")} labelEn={t("settings.address")} keyAr="footer.addressAr" keyEn="footer.addressEn" />

        <h3 className="font-semibold pt-4 border-t">{t("settings.social")}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SettingField label="Twitter / X" settingKey="footer.twitter" placeholder="https://twitter.com/..." />
          <SettingField label="Instagram" settingKey="footer.instagram" placeholder="https://instagram.com/..." />
          <SettingField label="LinkedIn" settingKey="footer.linkedin" placeholder="https://linkedin.com/..." />
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
