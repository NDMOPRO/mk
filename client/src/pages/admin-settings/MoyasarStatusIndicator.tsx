import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";

export function MoyasarStatusIndicator() {
  const { lang } = useI18n();
  const statusQuery = trpc.finance.moyasarPayment.getConfigStatus.useQuery(
    undefined,
    { staleTime: 30_000, refetchOnWindowFocus: true }
  );

  if (statusQuery.isLoading) {
    return (
      <div className="rounded-lg border border-border p-4 animate-pulse">
        <div className="h-4 bg-muted rounded w-48" />
      </div>
    );
  }

  const data = statusQuery.data;
  if (!data) return null;

  const statusColors: Record<string, { bg: string; text: string; dot: string; border: string }> = {
    NOT_CONFIGURED: {
      bg: "bg-red-50 dark:bg-red-950/30",
      text: "text-red-700 dark:text-red-300",
      dot: "bg-red-500",
      border: "border-red-200 dark:border-red-800",
    },
    CONFIGURED: {
      bg: "bg-amber-50 dark:bg-amber-950/30",
      text: "text-amber-700 dark:text-amber-300",
      dot: "bg-amber-500",
      border: "border-amber-200 dark:border-amber-800",
    },
    LIVE: {
      bg: "bg-green-50 dark:bg-green-950/30",
      text: "text-green-700 dark:text-green-300",
      dot: "bg-green-500",
      border: "border-green-200 dark:border-green-800",
    },
  };

  const colors = statusColors[data.status] || statusColors.NOT_CONFIGURED;
  const statusLabel = lang === "ar" ? data.statusAr : data.statusEn;

  return (
    <div className={`rounded-lg border ${colors.border} ${colors.bg} p-4`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${colors.dot} animate-pulse`} />
          <div>
            <h4 className={`font-semibold text-sm ${colors.text}`}>
              {lang === "ar" ? "حالة Moyasar" : "Moyasar Status"}
            </h4>
            <p className={`text-xs ${colors.text} opacity-80`}>{statusLabel}</p>
          </div>
        </div>
        <div className="text-end">
          <Badge variant={data.status === "LIVE" ? "default" : data.status === "CONFIGURED" ? "secondary" : "destructive"}
            className="text-[10px] px-2 py-0.5">
            {data.status === "LIVE" ? (lang === "ar" ? "مباشر" : "LIVE")
              : data.status === "CONFIGURED" ? (lang === "ar" ? "تجريبي" : "TEST")
              : (lang === "ar" ? "غير مُعد" : "OFF")}
          </Badge>
        </div>
      </div>
      {data.status !== "NOT_CONFIGURED" && (
        <div className={`mt-3 pt-3 border-t ${colors.border} text-xs ${colors.text} opacity-70 space-y-1`}>
          <p>
            <span className="font-medium">{lang === "ar" ? "Webhook URL:" : "Webhook URL:"}</span>{" "}
            <code className="bg-black/5 dark:bg-white/5 px-1.5 py-0.5 rounded text-[10px]">https://monthlykey.com{data.webhookUrl}</code>
          </p>
          <p>
            <span className="font-medium">{lang === "ar" ? "الوضع:" : "Mode:"}</span>{" "}
            {data.mode === "live" ? (lang === "ar" ? "إنتاجي" : "Production") : (lang === "ar" ? "تجريبي" : "Sandbox")}
          </p>
        </div>
      )}
      {data.status === "NOT_CONFIGURED" && (
        <p className={`mt-2 text-xs ${colors.text} opacity-70`}>
          {lang === "ar"
            ? "أدخل مفاتيح Moyasar أدناه لتفعيل الدفع الإلكتروني. شعارات الدفع تظهر حالياً ك\u0640 \"\u0642\u0631\u064a\u0628\u0627\u064b\"."
            : 'Enter your Moyasar keys below to enable online payments. Payment badges currently show as "Coming Soon".'}
        </p>
      )}
    </div>
  );
}
