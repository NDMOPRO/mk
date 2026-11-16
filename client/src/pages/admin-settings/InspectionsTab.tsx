import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, Save, Calendar, Clock } from "lucide-react";
import { SettingField, BilingualField } from "./fields";
import type { AdminSettingsCtx } from "./useAdminSettings";

export function InspectionsTab({ ctx }: { ctx: AdminSettingsCtx }) {
  const { t, lang, isRtl, updateMutation, settings, saveSettings } = ctx;
  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          {lang === "ar" ? "إدارة طلبات المعاينة" : "Inspection Requests"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Time Slots Configuration */}
        <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
          <h3 className="font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4" />
            {lang === "ar" ? "أوقات المعاينة المتاحة" : "Available Time Slots"}
          </h3>
          <SettingField 
            label={lang === "ar" ? "الأوقات (مفصولة بفواصل)" : "Time Slots (comma separated)"}
            settingKey="inspection.timeSlots"
            placeholder='["09:00-10:00","10:00-11:00","14:00-15:00","15:00-16:00"]'
          />
          <p className="text-xs text-muted-foreground">
            {lang === "ar" 
              ? 'أدخل الأوقات بصيغة JSON مثل: ["09:00-10:00","14:00-15:00"]' 
              : 'Enter time slots as JSON array: ["09:00-10:00","14:00-15:00"]'}
          </p>
        </div>

        {/* Inspection Settings */}
        <div className="border rounded-lg p-4 space-y-4">
          <h3 className="font-semibold">{lang === "ar" ? "إعدادات المعاينة" : "Inspection Settings"}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SettingField 
              label={lang === "ar" ? "الحد الأقصى للطلبات اليومية" : "Max Daily Requests"}
              settingKey="inspection.maxDaily" type="number" placeholder="10"
            />
            <SettingField 
              label={lang === "ar" ? "أيام الحجز المسبق المطلوبة" : "Advance Booking Days"}
              settingKey="inspection.advanceDays" type="number" placeholder="1"
            />
          </div>
          <BilingualField 
            labelAr={lang === "ar" ? "رسالة تأكيد المعاينة" : "Confirmation Message"}
            labelEn={lang === "ar" ? "رسالة تأكيد المعاينة" : "Confirmation Message"}
            keyAr="inspection.confirmMsgAr" keyEn="inspection.confirmMsgEn" type="textarea"
          />
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
