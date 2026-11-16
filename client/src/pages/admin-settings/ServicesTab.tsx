import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, LayoutGrid } from "lucide-react";
import { SettingField, BilingualField } from "./fields";
import type { AdminSettingsCtx } from "./useAdminSettings";

export function ServicesTab({ ctx }: { ctx: AdminSettingsCtx }) {
  const { t, lang, isRtl, updateMutation, settings, saveSettings } = ctx;
  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LayoutGrid className="h-5 w-5" />
          {lang === "ar" ? "إدارة الخدمات" : "Services Management"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <BilingualField labelAr="عنوان قسم الخدمات" labelEn="Services Section Title" keyAr="services.titleAr" keyEn="services.titleEn" />
        <BilingualField labelAr="وصف قسم الخدمات" labelEn="Services Section Description" keyAr="services.descAr" keyEn="services.descEn" type="textarea" />
        
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="border rounded-lg p-4 space-y-4">
            <h3 className="font-semibold text-primary">
              {lang === "ar" ? `الخدمة ${i}` : `Service ${i}`}
            </h3>
            <BilingualField labelAr="اسم الخدمة" labelEn="Service Name" keyAr={`service.${i}.titleAr`} keyEn={`service.${i}.titleEn`} />
            <BilingualField labelAr="وصف الخدمة" labelEn="Service Description" keyAr={`service.${i}.descAr`} keyEn={`service.${i}.descEn`} type="textarea" />
            <SettingField label={lang === "ar" ? "أيقونة (lucide icon name)" : "Icon (lucide icon name)"} settingKey={`service.${i}.icon`} placeholder="building-2" />
          </div>
        ))}

        <Button onClick={saveSettings} disabled={updateMutation.isPending} className="w-full md:w-auto">
          <Save className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
          {t("settings.save")}
        </Button>
      </CardContent>
    </Card>
    </>
  );
}
