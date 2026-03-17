import SEOHead from "@/components/SEOHead";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ToggleLeft, Loader2, AlertTriangle, Shield, Info } from "lucide-react";

const FLAG_DESCRIPTIONS: Record<string, { en: string; ar: string; category: string }> = {
  "USE_DB_INTEGRATIONS": { en: "Master switch: use DB-stored credentials instead of env vars", ar: "المفتاح الرئيسي: استخدام بيانات الاعتماد المخزنة في قاعدة البيانات", category: "Infrastructure" },
  "ENABLE_INTEGRATION_PANEL_WRITE": { en: "Allow editing integration credentials in admin panel", ar: "السماح بتعديل بيانات التكامل في لوحة الإدارة", category: "Infrastructure" },
  "SMS_ENABLED": { en: "Kill switch for all SMS sending", ar: "مفتاح إيقاف إرسال الرسائل النصية", category: "Channels" },
  "EMAIL_OTP_ENABLED": { en: "Kill switch for all email OTP sending", ar: "مفتاح إيقاف إرسال رمز البريد الإلكتروني", category: "Channels" },
  "WHATSAPP_ENABLED": { en: "Kill switch for all WhatsApp sending", ar: "مفتاح إيقاف إرسال واتساب", category: "Channels" },
  "WHATSAPP_OTP_EXPERIMENT": { en: "Reserved: WhatsApp OTP experiment (not implemented)", ar: "محجوز: تجربة رمز واتساب (غير مفعل)", category: "Channels" },
  "TAQNYAT_SMS_ENABLED": { en: "Enable Taqnyat SMS provider integration", ar: "تفعيل تكامل مزود الرسائل النصية تقنيات", category: "Channels" },
  "TAQNYAT_WHATSAPP_ENABLED": { en: "Enable Taqnyat WhatsApp provider integration (webhook + sending)", ar: "تفعيل تكامل واتساب تقنيات (الويب هوك + الإرسال)", category: "Channels" },
  "verification.requireForInstantBook": { en: "Require email+phone verification for Instant Book", ar: "طلب التحقق من البريد والهاتف للحجز الفوري", category: "Verification" },
  "verification.requireForPayment": { en: "Require email+phone verification before payment", ar: "طلب التحقق من البريد والهاتف قبل الدفع", category: "Verification" },
  "verification.smsRoutingEnabled": { en: "Smart SMS routing: +966→Unifonic, others→Twilio", ar: "توجيه ذكي: +966→يونيفونك، غيرها→تويليو", category: "Verification" },
  "kyc.enableGating": { en: "Require KYC verification for certain actions", ar: "طلب التحقق من الهوية لبعض الإجراءات", category: "KYC" },
  "kyc.enableSubmission": { en: "Allow users to submit KYC documents", ar: "السماح للمستخدمين بتقديم وثائق الهوية", category: "KYC" },
};

const CATEGORY_ORDER = ["Infrastructure", "Channels", "Verification", "KYC"];

export default function AdminFeatureFlags() {
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const [updating, setUpdating] = useState<string | null>(null);

  const { data: flags, isLoading, refetch } = trpc.integration.flags.list.useQuery();
  const updateMutation = trpc.integration.flags.update.useMutation({
    onSuccess: () => {
      toast.success(isAr ? "تم تحديث العلم" : "Flag updated");
      refetch();
    },
    onError: (err) => toast.error(err.message),
    onSettled: () => setUpdating(null),
  });

  const handleToggle = (key: string, currentValue: string) => {
    const newValue = currentValue === "true" ? "false" : "true";
    setUpdating(key);
    updateMutation.mutate({ key, value: newValue });
  };

  if (isLoading) {
    return (
      <DashboardLayout>
      <SEOHead title="Feature Flags | المفتاح الشهري - Monthly Key" />
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  const flagEntries = flags ? Object.entries(flags) : [];
  const grouped: Record<string, [string, { value: string; source: string }][]> = {};
  for (const [key, val] of flagEntries) {
    const cat = FLAG_DESCRIPTIONS[key]?.category || "Other";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push([key, val as { value: string; source: string }]);
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-3">
          <ToggleLeft className="w-7 h-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">{isAr ? "أعلام الميزات" : "Feature Flags"}</h1>
            <p className="text-muted-foreground text-sm">
              {isAr ? "تحكم في ميزات النظام. جميع الأعلام معطلة افتراضياً." : "Control system features. All flags default to OFF."}
            </p>
          </div>
        </div>

        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-sm text-amber-800 dark:text-amber-200">
              <p className="font-medium">{isAr ? "تحذير" : "Warning"}</p>
              <p>{isAr
                ? "تغيير الأعلام يؤثر فوراً على سلوك النظام. المسؤولون الجذريون ومسؤولو الطوارئ يتجاوزون جميع البوابات دائماً."
                : "Changing flags immediately affects system behavior. Root admins and break-glass admins always bypass all gates."
              }</p>
            </div>
          </CardContent>
        </Card>

        {CATEGORY_ORDER.map(cat => {
          const items = grouped[cat];
          if (!items || items.length === 0) return null;
          return (
            <Card key={cat}>
              <CardHeader>
                <CardTitle className="text-lg">{cat}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {items.map(([key, val]) => {
                  const desc = FLAG_DESCRIPTIONS[key];
                  const isOn = val.value === "true";
                  const isUpdating = updating === key;
                  return (
                    <div key={key} className="flex items-center justify-between py-3 border-b last:border-b-0">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{key}</code>
                          <Badge variant={val.source === "db" ? "default" : "secondary"} className="text-[10px]">
                            {val.source === "db" ? "DB" : "Default"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {isAr ? desc?.ar : desc?.en || key}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className={`text-xs font-medium ${isOn ? "text-green-600" : "text-muted-foreground"}`}>
                          {isOn ? "ON" : "OFF"}
                        </span>
                        <Switch
                          checked={isOn}
                          onCheckedChange={() => handleToggle(key, val.value)}
                          disabled={isUpdating}
                        />
                        {isUpdating && <Loader2 className="w-4 h-4 animate-spin" />}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}

        <Card>
          <CardContent className="flex items-start gap-3 p-4">
            <Shield className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground">{isAr ? "تجاوز الطوارئ" : "Break-Glass Bypass"}</p>
              <p>{isAr
                ? "يتم التحكم في تجاوز الطوارئ عبر متغيرات البيئة (BREAKGLASS_ADMIN_EMAILS / BREAKGLASS_ADMIN_USER_IDS) ولا يمكن تعديلها من هنا."
                : "Break-glass bypass is controlled via environment variables (BREAKGLASS_ADMIN_EMAILS / BREAKGLASS_ADMIN_USER_IDS) and cannot be modified from this panel."
              }</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
