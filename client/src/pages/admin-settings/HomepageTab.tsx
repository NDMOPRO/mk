import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, Home as HomeIcon } from "lucide-react";
import { SettingField, BilingualField } from "./fields";
import type { AdminSettingsCtx } from "./useAdminSettings";

export function HomepageTab({ ctx }: { ctx: AdminSettingsCtx }) {
  const { t, lang, isRtl, updateMutation, settings, saveSettings } = ctx;
  return (
    <>
    <div className="space-y-6">
      {/* How It Works */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HomeIcon className="h-5 w-5" />
            {lang === "ar" ? "كيف يعمل" : "How It Works"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="border rounded-lg p-4 space-y-4">
              <h3 className="font-semibold text-primary">
                {lang === "ar" ? `الخطوة ${i}` : `Step ${i}`}
              </h3>
              <BilingualField labelAr="العنوان" labelEn="Title" keyAr={`step.${i}.titleAr`} keyEn={`step.${i}.titleEn`} />
              <BilingualField labelAr="الوصف" labelEn="Description" keyAr={`step.${i}.descAr`} keyEn={`step.${i}.descEn`} type="textarea" />
            </div>
          ))}
          <Button onClick={saveSettings} disabled={updateMutation.isPending}>
            <Save className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
            {t("settings.save")}
          </Button>
        </CardContent>
      </Card>

      {/* Testimonials */}
      <Card>
        <CardHeader>
          <CardTitle>{lang === "ar" ? "آراء العملاء" : "Testimonials"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="border rounded-lg p-4 space-y-4">
              <h3 className="font-semibold text-primary">
                {lang === "ar" ? `الشهادة ${i}` : `Testimonial ${i}`}
              </h3>
              <BilingualField labelAr="النص" labelEn="Text" keyAr={`testimonial.${i}.textAr`} keyEn={`testimonial.${i}.textEn`} type="textarea" />
              <BilingualField labelAr="الاسم" labelEn="Name" keyAr={`testimonial.${i}.nameAr`} keyEn={`testimonial.${i}.nameEn`} />
              <BilingualField labelAr="الدور" labelEn="Role" keyAr={`testimonial.${i}.roleAr`} keyEn={`testimonial.${i}.roleEn`} />
              <SettingField label={lang === "ar" ? "التقييم (1-5)" : "Rating (1-5)"} settingKey={`testimonial.${i}.rating`} type="number" placeholder="5" />
            </div>
          ))}
          <Button onClick={saveSettings} disabled={updateMutation.isPending}>
            <Save className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
            {t("settings.save")}
          </Button>
        </CardContent>
      </Card>

      {/* CTA Section */}
      <Card>
        <CardHeader>
          <CardTitle>{lang === "ar" ? "قسم الدعوة للإجراء" : "Call to Action Section"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <BilingualField labelAr="عنوان CTA" labelEn="CTA Title" keyAr="cta.titleAr" keyEn="cta.titleEn" />
          <BilingualField labelAr="وصف CTA" labelEn="CTA Description" keyAr="cta.descAr" keyEn="cta.descEn" type="textarea" />
          <BilingualField labelAr="نص الزر" labelEn="Button Text" keyAr="cta.btnAr" keyEn="cta.btnEn" />
          <Button onClick={saveSettings} disabled={updateMutation.isPending}>
            <Save className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
            {t("settings.save")}
          </Button>
        </CardContent>
      </Card>
    </div>
    </>
  );
}
