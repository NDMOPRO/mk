import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, Save, Search, MessageCircle } from "lucide-react";
import { SettingField } from "./fields";
import type { AdminSettingsCtx } from "./useAdminSettings";

export function WhatsAppTab({ ctx }: { ctx: AdminSettingsCtx }) {
  const { t, lang, isRtl, updateMutation, settings, setSettings, setDirty, saveSettings } = ctx;
  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-[#25D366]" />
          {lang === "ar" ? "إعدادات واتساب" : "WhatsApp Settings"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-sm text-muted-foreground">
          {lang === "ar" ? "تحكم في زر واتساب العائم والرسالة الافتراضية" : "Control the floating WhatsApp button and default message"}
        </p>
        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between p-4 rounded-xl border-2 border-dashed" style={{ borderColor: settings["whatsapp.enabled"] === "true" ? "#25D366" : "#94a3b8" }}>
          <div>
            <h3 className="font-bold text-lg">{lang === "ar" ? "تفعيل زر واتساب" : "Enable WhatsApp Button"}</h3>
            <p className="text-sm text-muted-foreground">
              {lang === "ar"
                ? settings["whatsapp.enabled"] === "true" ? "✅ زر واتساب مفعّل ويظهر للزوار" : "❌ زر واتساب معطّل ولا يظهر للزوار"
                : settings["whatsapp.enabled"] === "true" ? "✅ WhatsApp button is active and visible to visitors" : "❌ WhatsApp button is disabled and hidden"
              }
            </p>
          </div>
          <Button
            variant={settings["whatsapp.enabled"] === "true" ? "default" : "outline"}
            size="lg"
            disabled={updateMutation.isPending}
            onClick={() => {
              const newVal = settings["whatsapp.enabled"] === "true" ? "false" : "true";
              setSettings(prev => ({ ...prev, "whatsapp.enabled": newVal }));
              updateMutation.mutate({ settings: { ...settings, "whatsapp.enabled": newVal } });
            }}
            className="min-w-[140px]"
            style={settings["whatsapp.enabled"] === "true" ? { backgroundColor: "#25D366", color: "white" } : {}}
          >
            {settings["whatsapp.enabled"] === "true"
              ? (lang === "ar" ? "تعطيل" : "Disable")
              : (lang === "ar" ? "تفعيل" : "Enable")
            }
          </Button>
        </div>
        {/* ── Basic Config ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SettingField label={lang === "ar" ? "رقم واتساب (E.164 مع رمز الدولة)" : "WhatsApp Number (E.164 with country code)"} settingKey="whatsapp.number" placeholder="+966504466528" />
          <SettingField label={lang === "ar" ? "اسم العلامة التجارية (عربي)" : "Brand Name (Arabic)"} settingKey="whatsapp.brandNameAr" placeholder="واتساب" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SettingField label={lang === "ar" ? "نص الزر (عربي)" : "Button Text (Arabic)"} settingKey="whatsapp.textAr" placeholder="تواصل معنا" />
          <SettingField label={lang === "ar" ? "نص الزر (إنجليزي)" : "Button Text (English)"} settingKey="whatsapp.textEn" placeholder="Chat with us" />
        </div>

        {/* ── Visibility per Route ── */}
        <div className="border rounded-xl p-4 space-y-3">
          <h4 className="font-semibold text-sm">{lang === "ar" ? "إظهار الزر حسب الصفحة" : "Show Button per Page"}</h4>
          <p className="text-xs text-muted-foreground">{lang === "ar" ? "الزر مخفي دائماً في صفحات تسجيل الدخول والتسجيل ولوحة الإدارة" : "Button is always hidden on login, register, OTP, auth, and admin pages"}</p>
          {[
            { key: "whatsapp.showOnHome", labelAr: "الصفحة الرئيسية", labelEn: "Home Page" },
            { key: "whatsapp.showOnSearch", labelAr: "صفحة البحث", labelEn: "Search Page" },
            { key: "whatsapp.showOnPropertyDetail", labelAr: "تفاصيل العقار", labelEn: "Property Detail" },
          ].map(({ key, labelAr, labelEn }) => (
            <label key={key} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 accent-[#25D366]"
                checked={settings[key] === "true"}
                onChange={() => {
                  const newVal = settings[key] === "true" ? "false" : "true";
                  setSettings(prev => ({ ...prev, [key]: newVal }));
                  setDirty(true);
                }}
              />
              <span className="text-sm">{lang === "ar" ? labelAr : labelEn}</span>
            </label>
          ))}
        </div>

        {/* ── Per-Context Message Templates ── */}
        <div className="border rounded-xl p-4 space-y-4">
          <h4 className="font-semibold text-sm">{lang === "ar" ? "قوالب الرسائل حسب السياق" : "Message Templates per Context"}</h4>
          <p className="text-xs text-muted-foreground">{lang === "ar" ? "رسالة مختلفة لكل صفحة. إذا تُركت فارغة، تُستخدم الرسالة الافتراضية." : "Different message per page. If left empty, the default message is used."}</p>

          <SettingField label={lang === "ar" ? "رسالة افتراضية (عربي)" : "Default Message (Arabic)"} settingKey="whatsapp.defaultMessageAr" placeholder="مرحباً، أحتاج مساعدة بخصوص الإيجار الشهري" />
          <SettingField label={lang === "ar" ? "رسالة افتراضية (إنجليزي)" : "Default Message (English)"} settingKey="whatsapp.defaultMessageEn" placeholder="Hello, I need help regarding monthly rental" />

          <hr className="border-dashed" />
          <SettingField label={lang === "ar" ? "رسالة الصفحة الرئيسية (عربي)" : "Home Page Message (Arabic)"} settingKey="whatsapp.homeMessageTemplateAr" placeholder="مرحباً، أبحث عن شقة للإيجار الشهري." />
          <SettingField label={lang === "ar" ? "رسالة الصفحة الرئيسية (إنجليزي)" : "Home Page Message (English)"} settingKey="whatsapp.homeMessageTemplateEn" placeholder="Hello, I'm looking for a monthly rental." />

          <hr className="border-dashed" />
          <SettingField label={lang === "ar" ? "رسالة صفحة البحث (عربي)" : "Search Page Message (Arabic)"} settingKey="whatsapp.searchMessageTemplateAr" placeholder="مرحباً، أبحث عن عقار للإيجار الشهري." />
          <SettingField label={lang === "ar" ? "رسالة صفحة البحث (إنجليزي)" : "Search Page Message (English)"} settingKey="whatsapp.searchMessageTemplateEn" placeholder="Hello, I'm searching for a monthly rental." />

          <hr className="border-dashed" />
          <p className="text-xs text-muted-foreground">{lang === "ar" ? "المتغيرات المتاحة لصفحة العقار: {{property_title}} {{property_id}} {{city}} {{url}}" : "Available placeholders for property page: {{property_title}} {{property_id}} {{city}} {{url}}"}</p>
          <SettingField label={lang === "ar" ? "رسالة تفاصيل العقار (عربي)" : "Property Detail Message (Arabic)"} settingKey="whatsapp.propertyMessageTemplateAr" placeholder="مرحباً، أنا مهتم بالعقار: {{property_title}} في {{city}}" />
          <SettingField label={lang === "ar" ? "رسالة تفاصيل العقار (إنجليزي)" : "Property Detail Message (English)"} settingKey="whatsapp.propertyMessageTemplateEn" placeholder="Hello, I'm interested in: {{property_title}} in {{city}}" />
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
