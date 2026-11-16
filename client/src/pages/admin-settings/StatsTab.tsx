import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Save } from "lucide-react";
import { SettingField } from "./fields";
import type { AdminSettingsCtx } from "./useAdminSettings";

export function StatsTab({ ctx }: { ctx: AdminSettingsCtx }) {
  const { t, isRtl, updateMutation, settings, saveSettings } = ctx;
  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          {t("settings.stats")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {[
          { key: "properties", label: t("settings.properties") },
          { key: "tenants", label: t("settings.tenants") },
          { key: "cities", label: t("settings.cities") },
          { key: "satisfaction", label: t("settings.satisfaction") },
        ].map(stat => (
          <div key={stat.key} className="border rounded-lg p-4 space-y-4">
            <h3 className="font-semibold">{stat.label}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <SettingField label={t("settings.value")} settingKey={`stats.${stat.key}`} type="number" />
              <SettingField label={`${t("settings.label")} (${t("settings.arabic")})`} settingKey={`stats.${stat.key}LabelAr`} />
              <SettingField label={`${t("settings.label")} (${t("settings.english")})`} settingKey={`stats.${stat.key}LabelEn`} />
            </div>
          </div>
        ))}

        <Button onClick={saveSettings} disabled={updateMutation.isPending}>
          <Save className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
          {t("settings.save")}
        </Button>
      </CardContent>
    </Card>
    </>
  );
}
