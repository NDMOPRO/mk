import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Image, Shield, Save, Upload } from "lucide-react";
import type { AdminSettingsCtx } from "./useAdminSettings";

export function MaintenanceTab({ ctx }: { ctx: AdminSettingsCtx }) {
  const { t, lang, dir, isRtl, updateMutation, settings, setSettings, updateSetting, saveSettings, handleFileUpload } = ctx;
  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-red-500" />
          {lang === "ar" ? "وضع الصيانة / قريباً" : "Maintenance / Coming Soon Mode"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Toggle */}
        <div className="flex items-center justify-between p-4 rounded-xl border-2 border-dashed" style={{ borderColor: settings["maintenance.enabled"] === "true" ? "#ef4444" : "#22c55e" }}>
          <div>
            <h3 className="font-bold text-lg">{lang === "ar" ? "تفعيل وضع الصيانة" : "Enable Maintenance Mode"}</h3>
            <p className="text-sm text-muted-foreground">
              {lang === "ar"
                ? settings["maintenance.enabled"] === "true" ? "✅ الموقع مغلق حالياً - يظهر صفحة قريباً للزوار (المدير يستطيع الوصول)" : "❌ الموقع مفتوح للجميع"
                : settings["maintenance.enabled"] === "true" ? "✅ Site is closed - visitors see coming soon page (admins can still access)" : "❌ Site is open to everyone"
              }
            </p>
          </div>
          <Button
            variant={settings["maintenance.enabled"] === "true" ? "default" : "destructive"}
            size="lg"
            disabled={updateMutation.isPending}
            onClick={() => {
              const newVal = settings["maintenance.enabled"] === "true" ? "false" : "true";
              setSettings(prev => ({ ...prev, "maintenance.enabled": newVal }));
              // Auto-save immediately — critical toggle should persist without manual save
              updateMutation.mutate({ settings: { ...settings, "maintenance.enabled": newVal } });
            }}
            className="min-w-[140px]"
          >
            {settings["maintenance.enabled"] === "true"
              ? (lang === "ar" ? "فتح الموقع" : "Open Site")
              : (lang === "ar" ? "إغلاق الموقع" : "Close Site")
            }
          </Button>
        </div>

        {/* Title AR */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>{lang === "ar" ? "العنوان (عربي)" : "Title (Arabic)"}</Label>
            <Input
              value={settings["maintenance.titleAr"] || ""}
              onChange={(e) => updateSetting("maintenance.titleAr", e.target.value)}
              placeholder="قريباً... الانطلاق"
              dir="rtl"
            />
          </div>
          <div>
            <Label>{lang === "ar" ? "العنوان (إنجليزي)" : "Title (English)"}</Label>
            <Input
              value={settings["maintenance.titleEn"] || ""}
              onChange={(e) => updateSetting("maintenance.titleEn", e.target.value)}
              placeholder="Coming Soon"
              dir="ltr"
            />
          </div>
        </div>

        {/* Subtitle AR/EN */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>{lang === "ar" ? "العنوان الفرعي (عربي)" : "Subtitle (Arabic)"}</Label>
            <Input
              value={settings["maintenance.subtitleAr"] || ""}
              onChange={(e) => updateSetting("maintenance.subtitleAr", e.target.value)}
              placeholder="نعمل على تجهيز تجربة مميزة لكم"
              dir="rtl"
            />
          </div>
          <div>
            <Label>{lang === "ar" ? "العنوان الفرعي (إنجليزي)" : "Subtitle (English)"}</Label>
            <Input
              value={settings["maintenance.subtitleEn"] || ""}
              onChange={(e) => updateSetting("maintenance.subtitleEn", e.target.value)}
              placeholder="We're preparing an exceptional experience"
              dir="ltr"
            />
          </div>
        </div>

        {/* Message AR/EN */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>{lang === "ar" ? "الرسالة (عربي)" : "Message (Arabic)"}</Label>
            <Textarea
              value={settings["maintenance.messageAr"] || ""}
              onChange={(e) => updateSetting("maintenance.messageAr", e.target.value)}
              placeholder="ستكون رحلة مميزة معنا..."
              dir="rtl"
              rows={3}
            />
          </div>
          <div>
            <Label>{lang === "ar" ? "الرسالة (إنجليزي)" : "Message (English)"}</Label>
            <Textarea
              value={settings["maintenance.messageEn"] || ""}
              onChange={(e) => updateSetting("maintenance.messageEn", e.target.value)}
              placeholder="An exceptional journey awaits..."
              dir="ltr"
              rows={3}
            />
          </div>
        </div>

        {/* Image Upload */}
        <div>
          <Label>{lang === "ar" ? "صورة الصفحة (اختياري)" : "Page Image (optional)"}</Label>
          <div className="mt-2 flex items-center gap-4">
            {settings["maintenance.imageUrl"] && (
              <div className="relative w-40 h-24 rounded-lg overflow-hidden border">
                <img loading="lazy" src={settings["maintenance.imageUrl"]} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => updateSetting("maintenance.imageUrl", "")}
                  className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                >
                  ×
                </button>
              </div>
            )}
            <Button variant="outline" onClick={() => handleFileUpload("maintenance.imageUrl")}>
              <Upload className="h-4 w-4 mr-2" />
              {lang === "ar" ? "رفع صورة" : "Upload Image"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {lang === "ar" ? "ارفع صورة مخصصة تظهر في صفحة الصيانة" : "Upload a custom image to display on the maintenance page"}
          </p>
        </div>

        {/* Countdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>{lang === "ar" ? "تاريخ العد التنازلي" : "Countdown Date"}</Label>
            <Input
              type="datetime-local"
              value={settings["maintenance.countdownDate"] || ""}
              onChange={(e) => updateSetting("maintenance.countdownDate", e.target.value)}
            />
          </div>
          <div className="flex items-end gap-3">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={settings["maintenance.showCountdown"] === "true"}
                onCheckedChange={(v) => updateSetting("maintenance.showCountdown", v ? "true" : "false")}
              />
              <Label>{lang === "ar" ? "إظهار العد التنازلي" : "Show Countdown"}</Label>
            </div>
          </div>
        </div>

        {/* Social Media Links */}
        <div className="space-y-4">
          <div>
            <h3 className="font-bold text-lg mb-1">{lang === "ar" ? "روابط التواصل الاجتماعي" : "Social Media Links"}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {lang === "ar" ? "أضف روابط حساباتك لتظهر في صفحة الصيانة وتبقي الزوار على تواصل معك" : "Add your social media URLs to display on the maintenance page and keep visitors engaged"}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="flex items-center gap-2">𝕏 Twitter / X</Label>
              <Input
                value={settings["social.twitter"] || ""}
                onChange={(e) => updateSetting("social.twitter", e.target.value)}
                placeholder="https://x.com/yourhandle"
                dir="ltr"
              />
            </div>
            <div>
              <Label className="flex items-center gap-2">📷 Instagram</Label>
              <Input
                value={settings["social.instagram"] || ""}
                onChange={(e) => updateSetting("social.instagram", e.target.value)}
                placeholder="https://instagram.com/yourhandle"
                dir="ltr"
              />
            </div>
            <div>
              <Label className="flex items-center gap-2">👻 Snapchat</Label>
              <Input
                value={settings["social.snapchat"] || ""}
                onChange={(e) => updateSetting("social.snapchat", e.target.value)}
                placeholder="https://snapchat.com/add/yourhandle"
                dir="ltr"
              />
            </div>
            <div>
              <Label className="flex items-center gap-2">🎵 TikTok</Label>
              <Input
                value={settings["social.tiktok"] || ""}
                onChange={(e) => updateSetting("social.tiktok", e.target.value)}
                placeholder="https://tiktok.com/@yourhandle"
                dir="ltr"
              />
            </div>
            <div>
              <Label className="flex items-center gap-2">💼 LinkedIn</Label>
              <Input
                value={settings["social.linkedin"] || ""}
                onChange={(e) => updateSetting("social.linkedin", e.target.value)}
                placeholder="https://linkedin.com/company/yourcompany"
                dir="ltr"
              />
            </div>
            <div>
              <Label className="flex items-center gap-2">▶️ YouTube</Label>
              <Input
                value={settings["social.youtube"] || ""}
                onChange={(e) => updateSetting("social.youtube", e.target.value)}
                placeholder="https://youtube.com/@yourchannel"
                dir="ltr"
              />
            </div>
          </div>
        </div>

        {/* Save button for other maintenance settings */}
        <Button onClick={saveSettings} disabled={updateMutation.isPending} className="w-full md:w-auto">
          <Save className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
          {t("settings.save")}
        </Button>

        {/* Preview hint */}
        <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            {lang === "ar"
              ? "ملاحظة: بصفتك مديراً، يمكنك الوصول للموقع حتى أثناء وضع الصيانة. الزوار سيرون صفحة قريباً فقط."
              : "Note: As an admin, you can access the site even during maintenance mode. Visitors will only see the coming soon page."
            }
          </p>
        </div>
      </CardContent>
    </Card>
    </>
  );
}
