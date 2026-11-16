import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Settings, Save, Upload } from "lucide-react";
import { SettingField, BilingualField } from "./fields";
import type { AdminSettingsCtx } from "./useAdminSettings";

export function GeneralTab({ ctx }: { ctx: AdminSettingsCtx }) {
  const { t, isRtl, updateMutation, settings, saveSettings, handleFileUpload } = ctx;
  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          {t("settings.general")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <BilingualField labelAr={t("settings.siteName")} labelEn={t("settings.siteName")} keyAr="site.nameAr" keyEn="site.nameEn" />
        <BilingualField labelAr={t("settings.siteDescription")} labelEn={t("settings.siteDescription")} keyAr="site.descriptionAr" keyEn="site.descriptionEn" type="textarea" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Logo */}
          <div className="space-y-3">
            <Label>{t("settings.logo")}</Label>
            <div className="flex items-center gap-4">
              {settings["site.logoUrl"] && (
                <img loading="lazy" src={settings["site.logoUrl"]} alt="Logo" className="h-16 w-16 object-contain rounded border" />
              )}
              <Button variant="outline" onClick={() => handleFileUpload("site.logoUrl")}>
                <Upload className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
                {t("settings.uploadLogo")}
              </Button>
            </div>
          </div>

          {/* Favicon */}
          <div className="space-y-3">
            <Label>{t("settings.favicon")}</Label>
            <div className="flex items-center gap-4">
              {settings["site.faviconUrl"] && (
                <img loading="lazy" src={settings["site.faviconUrl"]} alt="Favicon" className="h-10 w-10 object-contain rounded border" />
              )}
              <Button variant="outline" onClick={() => handleFileUpload("site.faviconUrl")}>
                <Upload className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
                {t("settings.uploadFavicon")}
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SettingField label={t("settings.primaryColor")} settingKey="site.primaryColor" type="color" />
          <SettingField label={t("settings.accentColor")} settingKey="site.accentColor" type="color" />
        </div>

        <Button onClick={saveSettings} disabled={updateMutation.isPending} className="w-full md:w-auto">
          <Save className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
          {t("settings.save")}
        </Button>
      </CardContent>
    </Card>
    </>
  );
}
