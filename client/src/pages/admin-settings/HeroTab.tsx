import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Image, Save, Upload, Video } from "lucide-react";
import { BilingualField } from "./fields";
import type { AdminSettingsCtx } from "./useAdminSettings";

export function HeroTab({ ctx }: { ctx: AdminSettingsCtx }) {
  const { t, lang, dir, isRtl, updateMutation, settings, updateSetting, saveSettings, handleFileUpload } = ctx;
  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Image className="h-5 w-5" />
          {t("settings.hero")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <BilingualField labelAr={t("settings.heroTitle")} labelEn={t("settings.heroTitle")} keyAr="hero.titleAr" keyEn="hero.titleEn" />
        <BilingualField labelAr={t("settings.heroSubtitle")} labelEn={t("settings.heroSubtitle")} keyAr="hero.subtitleAr" keyEn="hero.subtitleEn" type="textarea" />

        {/* Hero Background Type */}
        <div className="space-y-3">
          <Label>{lang === "ar" ? "نوع خلفية الهيرو" : "Hero Background Type"}</Label>
          <Select value={settings["hero.bgType"] || "image"} onValueChange={(v) => updateSetting("hero.bgType", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="image">{lang === "ar" ? "صورة" : "Image"}</SelectItem>
              <SelectItem value="video">{lang === "ar" ? "فيديو" : "Video"}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {(settings["hero.bgType"] || "image") === "image" ? (
          <div className="space-y-3">
            <Label>{t("settings.heroBgImage")}</Label>
            <div className="flex items-center gap-4">
              {settings["hero.bgImage"] && (
                <img loading="lazy" src={settings["hero.bgImage"]} alt="Hero BG" className="h-24 w-40 object-cover rounded border" />
              )}
              <Button variant="outline" onClick={() => handleFileUpload("hero.bgImage")}>
                <Upload className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
                {t("settings.uploadBg")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Label>{lang === "ar" ? "رابط الفيديو" : "Video URL"}</Label>
            <Input
              value={settings["hero.bgVideo"] || ""}
              onChange={(e) => updateSetting("hero.bgVideo", e.target.value)}
              placeholder="https://example.com/video.mp4"
              dir="ltr"
            />
            <p className="text-xs text-muted-foreground">
              {lang === "ar" ? "أدخل رابط فيديو MP4 مباشر. يمكنك رفع الفيديو عبر S3 أو استخدام رابط خارجي" : "Enter a direct MP4 video URL. Upload via S3 or use an external link."}
            </p>
            {settings["hero.bgVideo"] && (
              <video src={settings["hero.bgVideo"]} className="h-32 w-56 object-cover rounded border" muted autoPlay loop />
            )}
            {/* Poster / Fallback Image for Video */}
            <div className="mt-4 space-y-2">
              <Label>{lang === "ar" ? "صورة البوستر (تظهر أثناء تحميل الفيديو)" : "Poster Image (shown while video loads)"}</Label>
              <div className="flex items-center gap-4">
                {settings["hero.bgImage"] && (
                  <img loading="lazy" src={settings["hero.bgImage"]} alt="Poster" className="h-20 w-36 object-cover rounded border" />
                )}
                <Button variant="outline" size="sm" onClick={() => handleFileUpload("hero.bgImage")}>
                  <Upload className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
                  {lang === "ar" ? "رفع صورة بوستر" : "Upload Poster"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Seasonal Theme Presets */}
        <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
          <Label className="flex items-center gap-2">
            <Video className="h-4 w-4" />
            {lang === "ar" ? "قوالب موسمية جاهزة" : "Seasonal Presets"}
          </Label>
          <p className="text-xs text-muted-foreground">
            {lang === "ar" ? "اختر قالب موسمي لتطبيقه على الهيرو بضغطة واحدة" : "Choose a seasonal preset to apply to the hero section"}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                id: "default",
                emoji: "🏙️",
                labelAr: "الرياض (افتراضي)",
                labelEn: "Riyadh (Default)",
                titleAr: "خبير الإيجار الشهري — الآن في السعودية",
                titleEn: "Monthly Rental Expert — Now in Saudi Arabia",
                subtitleAr: "إدارة إيجارات شهرية متميزة | الرياض",
                subtitleEn: "Premium monthly rental management | Riyadh",
                bgImage: "https://d2xsxph8kpxj0f.cloudfront.net/310519663340926600/SVjftMwJXeVbFV32MvDGSY/city-riyadh-crHAsSyPKDbbHqpiKFQyPb.png",
                overlayOpacity: "40",
              },
              {
                id: "riyadh-season",
                emoji: "🎉",
                labelAr: "موسم الرياض",
                labelEn: "Riyadh Season",
                titleAr: "موسم الرياض — احجز إقامتك الشهرية",
                titleEn: "Riyadh Season — Book Your Monthly Stay",
                subtitleAr: "عروض حصرية لموسم الرياض | شقق وفلل مفروشة",
                subtitleEn: "Exclusive Riyadh Season offers | Furnished apartments & villas",
                bgImage: "https://d2xsxph8kpxj0f.cloudfront.net/310519663340926600/SVjftMwJXeVbFV32MvDGSY/riyadh-season-hero-dghiP7dbg9qJ7wMhv8ZKke.png",
                overlayOpacity: "30",
              },
              {
                id: "ramadan",
                emoji: "🌙",
                labelAr: "رمضان",
                labelEn: "Ramadan",
                titleAr: "رمضان كريم — إيجارك الشهري بأفضل الأسعار",
                titleEn: "Ramadan Kareem — Best Monthly Rental Deals",
                subtitleAr: "عروض رمضان الحصرية | الرياض",
                subtitleEn: "Exclusive Ramadan Offers | Riyadh",
                bgImage: "https://d2xsxph8kpxj0f.cloudfront.net/310519663340926600/SVjftMwJXeVbFV32MvDGSY/ramadan-hero-46fiPSfUNcQjDW4JoZqJZr.png",
                overlayOpacity: "35",
              },
              {
                id: "eid-al-fitr",
                emoji: "✨",
                labelAr: "عيد الفطر",
                labelEn: "Eid Al Fitr",
                titleAr: "عيد فطر مبارك — إقامتك الشهرية بأفضل العروض",
                titleEn: "Eid Mubarak — Best Monthly Stay Deals",
                subtitleAr: "احتفل بالعيد في أرقى العقارات | الرياض",
                subtitleEn: "Celebrate Eid in premium properties | Riyadh",
                bgImage: "https://d2xsxph8kpxj0f.cloudfront.net/310519663340926600/SVjftMwJXeVbFV32MvDGSY/eid-al-fitr-hero-3GkXiKgkYxsaZXTy2HGSe4.png",
                overlayOpacity: "30",
              },
              {
                id: "eid-al-adha",
                emoji: "🕋",
                labelAr: "عيد الأضحى",
                labelEn: "Eid Al Adha",
                titleAr: "عيد أضحى مبارك — إقامة شهرية مميزة",
                titleEn: "Eid Al Adha Mubarak — Premium Monthly Stays",
                subtitleAr: "احتفل بعيد الأضحى في أفضل العقارات | الرياض",
                subtitleEn: "Celebrate Eid Al Adha in the finest properties | Riyadh",
                bgImage: "https://d2xsxph8kpxj0f.cloudfront.net/310519663340926600/SVjftMwJXeVbFV32MvDGSY/eid-al-adha-hero-huTRkuFTD4Njg2Tec9zFiq.png",
                overlayOpacity: "30",
              },
              {
                id: "national-day",
                emoji: "🇸🇦",
                labelAr: "اليوم الوطني",
                labelEn: "National Day",
                titleAr: "اليوم الوطني السعودي — عروض حصرية",
                titleEn: "Saudi National Day — Exclusive Offers",
                subtitleAr: "احتفل باليوم الوطني مع أفضل الإيجارات الشهرية",
                subtitleEn: "Celebrate National Day with the best monthly rentals",
                bgImage: "https://d2xsxph8kpxj0f.cloudfront.net/310519663340926600/SVjftMwJXeVbFV32MvDGSY/national-day-hero-RwPuYjSu9VJ28Q6JMB42m4.png",
                overlayOpacity: "30",
              },
              {
                id: "founding-day",
                emoji: "🏰",
                labelAr: "يوم التأسيس",
                labelEn: "Founding Day",
                titleAr: "يوم التأسيس — إقامة شهرية بروح التراث",
                titleEn: "Founding Day — Monthly Stay with Heritage Spirit",
                subtitleAr: "احتفل بيوم التأسيس في أرقى العقارات | الرياض",
                subtitleEn: "Celebrate Founding Day in premium properties | Riyadh",
                bgImage: "https://d2xsxph8kpxj0f.cloudfront.net/310519663340926600/SVjftMwJXeVbFV32MvDGSY/founding-day-hero-A5uqE2DCV8i4CK8joSxCa8.png",
                overlayOpacity: "30",
              },
            ].map((preset) => {
              const isActive = settings["hero.bgImage"] === preset.bgImage
                && settings["hero.titleAr"] === preset.titleAr;
              return (
                <button
                  key={preset.id}
                  onClick={() => {
                    updateSetting("hero.titleAr", preset.titleAr);
                    updateSetting("hero.titleEn", preset.titleEn);
                    updateSetting("hero.subtitleAr", preset.subtitleAr);
                    updateSetting("hero.subtitleEn", preset.subtitleEn);
                    updateSetting("hero.bgType", "image");
                    updateSetting("hero.bgImage", preset.bgImage);
                    updateSetting("hero.bgVideo", "");
                    updateSetting("hero.overlayOpacity", preset.overlayOpacity);
                    toast.info(lang === "ar"
                      ? `تم تطبيق قالب ${preset.labelAr} — اضغط حفظ`
                      : `${preset.labelEn} preset applied — click Save`);
                  }}
                  className={`relative group rounded-lg overflow-hidden border-2 transition-all hover:shadow-lg ${
                    isActive
                      ? "border-[#3ECFC0] ring-2 ring-[#3ECFC0]/30"
                      : "border-border hover:border-muted-foreground/30"
                  }`}
                >
                  {/* Preview image */}
                  <div className="relative h-28 w-full">
                    <img
                      src={preset.bgImage}
                      alt={lang === "ar" ? preset.labelAr : preset.labelEn}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-0" style={{ backgroundColor: `rgba(0,0,0,${Number(preset.overlayOpacity) / 100})` }} />
                    {/* Preview text overlay */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white px-2">
                      <p className="text-[10px] font-bold text-center leading-tight line-clamp-2 drop-shadow-md">
                        {lang === "ar" ? preset.titleAr : preset.titleEn}
                      </p>
                      <p className="text-[8px] text-white/70 mt-0.5 text-center line-clamp-1">
                        {lang === "ar" ? preset.subtitleAr : preset.subtitleEn}
                      </p>
                    </div>
                    {/* Active badge */}
                    {isActive && (
                      <div className="absolute top-1.5 end-1.5 bg-[#3ECFC0] text-[#0B1E2D] text-[9px] font-bold px-1.5 py-0.5 rounded">
                        {lang === "ar" ? "نشط" : "Active"}
                      </div>
                    )}
                  </div>
                  {/* Label bar */}
                  <div className="px-2 py-1.5 bg-card text-card-foreground text-xs font-medium text-center">
                    {preset.emoji} {lang === "ar" ? preset.labelAr : preset.labelEn}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Hero Overlay Opacity */}
        <div className="space-y-2">
          <Label>{lang === "ar" ? "شفافية التعتيم" : "Overlay Opacity"}</Label>
          <div className="flex items-center gap-3">
            <input
              type="range" min="0" max="100" step="5"
              value={settings["hero.overlayOpacity"] || "60"}
              onChange={(e) => updateSetting("hero.overlayOpacity", e.target.value)}
              className="flex-1"
            />
            <span className="text-sm font-mono w-12">{settings["hero.overlayOpacity"] || "60"}%</span>
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
