import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Trash2, Plus, HelpCircle } from "lucide-react";
import type { AdminSettingsCtx } from "./useAdminSettings";

export function FaqTab({ ctx }: { ctx: AdminSettingsCtx }) {
  const { t, lang, dir, isRtl, updateMutation, settings, updateSetting, saveSettings } = ctx;
  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HelpCircle className="h-5 w-5" />
          {lang === "ar" ? "إدارة الأسئلة الشائعة" : "FAQ Management"}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {lang === "ar" ? "أضف وعدّل الأسئلة الشائعة التي تظهر في صفحة FAQ. اتركها فارغة لاستخدام الأسئلة الافتراضية." : "Add and edit FAQ items shown on the FAQ page. Leave empty to use defaults."}
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {(() => {
          let faqItems: Array<{questionAr: string; questionEn: string; answerAr: string; answerEn: string; category: string}> = [];
          try { faqItems = JSON.parse(settings["faq.items"] || "[]"); } catch { faqItems = []; }
          if (!Array.isArray(faqItems)) faqItems = [];
          const updateFaqItems = (items: typeof faqItems) => updateSetting("faq.items", JSON.stringify(items));
          return (
            <>
              {faqItems.map((item, idx) => (
                <div key={idx} className="border rounded-lg p-4 space-y-3 relative">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline">#{idx + 1}</Badge>
                    <div className="flex gap-2">
                      <Select value={item.category || "general"} onValueChange={(v) => { const next = [...faqItems]; next[idx] = {...item, category: v}; updateFaqItems(next); }}>
                        <SelectTrigger className="w-[120px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="general">{lang === "ar" ? "عام" : "General"}</SelectItem>
                          <SelectItem value="booking">{lang === "ar" ? "الحجز" : "Booking"}</SelectItem>
                          <SelectItem value="payment">{lang === "ar" ? "الدفع" : "Payment"}</SelectItem>
                          <SelectItem value="rental">{lang === "ar" ? "الإيجار" : "Rental"}</SelectItem>
                          <SelectItem value="landlord">{lang === "ar" ? "الملاك" : "Landlords"}</SelectItem>
                          <SelectItem value="legal">{lang === "ar" ? "قانوني" : "Legal"}</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { const next = faqItems.filter((_, i) => i !== idx); updateFaqItems(next); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">{lang === "ar" ? "السؤال (عربي)" : "Question (Arabic)"}</Label>
                      <Input value={item.questionAr} dir="rtl" onChange={(e) => { const next = [...faqItems]; next[idx] = {...item, questionAr: e.target.value}; updateFaqItems(next); }} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{lang === "ar" ? "السؤال (إنجليزي)" : "Question (English)"}</Label>
                      <Input value={item.questionEn} dir="ltr" onChange={(e) => { const next = [...faqItems]; next[idx] = {...item, questionEn: e.target.value}; updateFaqItems(next); }} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{lang === "ar" ? "الإجابة (عربي)" : "Answer (Arabic)"}</Label>
                      <Textarea value={item.answerAr} dir="rtl" className="min-h-[80px]" onChange={(e) => { const next = [...faqItems]; next[idx] = {...item, answerAr: e.target.value}; updateFaqItems(next); }} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{lang === "ar" ? "الإجابة (إنجليزي)" : "Answer (English)"}</Label>
                      <Textarea value={item.answerEn} dir="ltr" className="min-h-[80px]" onChange={(e) => { const next = [...faqItems]; next[idx] = {...item, answerEn: e.target.value}; updateFaqItems(next); }} />
                    </div>
                  </div>
                </div>
              ))}
              <Button variant="outline" className="w-full" onClick={() => { updateFaqItems([...faqItems, { questionAr: "", questionEn: "", answerAr: "", answerEn: "", category: "general" }]); }}>
                <Plus className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
                {lang === "ar" ? "إضافة سؤال جديد" : "Add New Question"}
              </Button>
              <div className="flex justify-end">
                <Button onClick={saveSettings} disabled={updateMutation.isPending}>
                  <Save className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
                  {t("settings.save")}
                </Button>
              </div>
            </>
          );
        })()}
      </CardContent>
    </Card>
    </>
  );
}
