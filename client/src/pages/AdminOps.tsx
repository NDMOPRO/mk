import SEOHead from "@/components/SEOHead";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  ArrowRight,
  Building2,
  CalendarCheck,
  CreditCard,
  ExternalLink,
  Loader2,
  Plug,
  RefreshCw,
  Shield,
  Wrench,
  Workflow,
} from "lucide-react";

const syncPhases = [
  {
    key: "units",
    title: "Units & Buildings",
    description: "Sync building, unit, readiness, and occupancy data from Monthly Key into the operations workspace.",
    owner: "Monthly Key → Base44",
    status: "Phase 1",
  },
  {
    key: "bookings",
    title: "Bookings",
    description: "Push booking status, dates, and booking references into the operations command center.",
    owner: "Monthly Key → Base44",
    status: "Phase 1",
  },
  {
    key: "payments",
    title: "Payments & Collections",
    description: "Expose payment summaries and overdue collections while keeping payment truth in Monthly Key.",
    owner: "Monthly Key → Base44",
    status: "Phase 1",
  },
  {
    key: "maintenance",
    title: "Maintenance",
    description: "Push maintenance tickets into Base44 first, then allow limited write-back for status and notes.",
    owner: "Limited two-way",
    status: "Phase 2",
  },
];

export default function AdminOps() {
  const { lang } = useI18n();
  const isAr = lang === "ar";

  const healthQuery = trpc.base44.getSyncHealth.useQuery(undefined, {
    retry: false,
  });
  const workspaceQuery = trpc.base44.openWorkspace.useQuery(undefined, {
    retry: false,
  });
  const manualSyncMutation = trpc.base44.runManualSync.useMutation({
    onSuccess: (result) => {
      toast.success(result.message);
      healthQuery.refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const integration = healthQuery.data?.integration;
  const sourceCounts = healthQuery.data?.sourceCounts;
  const workspace = workspaceQuery.data;

  const openUrl = (url?: string | null) => {
    if (!url) {
      toast.error(isAr ? "الرابط غير مضبوط بعد داخل التكاملات" : "URL is not configured yet in Integrations");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <DashboardLayout>
      <SEOHead title="Operations Hub | المفتاح الشهري - Monthly Key" />
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <Workflow className="h-6 w-6 text-[#3ECFC0]" />
              {isAr ? "مركز العمليات والتكامل" : "Operations & Sync Hub"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isAr
                ? "هذه الصفحة هي نقطة الربط بين لوحة إدارة Monthly Key الحالية ومساحة العمليات في Base44."
                : "This page is the connection point between the current Monthly Key admin and the Base44 operations workspace."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => healthQuery.refetch()} disabled={healthQuery.isFetching}>
              {healthQuery.isFetching ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <RefreshCw className="me-2 h-4 w-4" />}
              {isAr ? "تحديث الحالة" : "Refresh Health"}
            </Button>
            <Button variant="outline" onClick={() => (window.location.href = "/admin/integrations")}>
              <Plug className="me-2 h-4 w-4" />
              {isAr ? "إعدادات التكاملات" : "Integration Settings"}
            </Button>
            <Button onClick={() => openUrl(workspace?.editorUrl || workspace?.previewUrl)}>
              <ExternalLink className="me-2 h-4 w-4" />
              {isAr ? "فتح مساحة Base44" : "Open Base44 Workspace"}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{isAr ? "حالة التكامل" : "Integration Status"}</CardDescription>
              <CardTitle className="text-base">{integration?.status || (isAr ? "غير مُهيأ" : "Not configured")}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              {integration?.enabled ? (isAr ? "التكامل مفعّل ويمكن طلب المزامنة اليدوية." : "Integration is enabled and ready for manual sync requests.") : (isAr ? "فعّل Base44 من صفحة التكاملات أولاً." : "Enable Base44 from Integrations first.")}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{isAr ? "الوحدات والمباني" : "Units & Buildings"}</CardDescription>
              <CardTitle className="text-base">{sourceCounts ? `${sourceCounts.units} / ${sourceCounts.buildings}` : "—"}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              {isAr ? "عدد الوحدات / عدد المباني داخل Monthly Key حالياً." : "Current unit count / building count inside Monthly Key."}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{isAr ? "الحجوزات والمدفوعات" : "Bookings & Ledger"}</CardDescription>
              <CardTitle className="text-base">{sourceCounts ? `${sourceCounts.bookings} / ${sourceCounts.paymentLedgerEntries}` : "—"}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              {isAr ? "الحجوزات / قيود السجل المالي المتاحة للمزامنة." : "Bookings / ledger entries available for sync."}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{isAr ? "الصيانة" : "Maintenance"}</CardDescription>
              <CardTitle className="text-base">{sourceCounts ? sourceCounts.maintenanceRequests : "—"}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              {isAr ? "طلبات الصيانة الحالية التي يمكن عرضها في مساحة العمليات." : "Current maintenance requests available for the ops workspace."}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <Card>
            <CardHeader>
              <CardTitle>{isAr ? "مراحل الربط" : "Connection Phases"}</CardTitle>
              <CardDescription>
                {isAr ? "أول موجة ربط عملية وآمنة قبل فتح أي مزامنة ثنائية الاتجاه." : "The first safe, practical wave before opening any wider bidirectional sync."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {syncPhases.map((phase) => (
                <div key={phase.key} className="rounded-xl border p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="font-medium">{phase.title}</div>
                      <p className="mt-1 text-sm text-muted-foreground">{phase.description}</p>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="secondary">{phase.status}</Badge>
                      <Badge variant="outline">{phase.owner}</Badge>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{isAr ? "أوامر التشغيل" : "Operations Actions"}</CardTitle>
              <CardDescription>
                {isAr ? "إجراءات أولية آمنة قبل تفعيل المزامنة الفعلية للكيانات." : "Safe first actions before live entity push is enabled."}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Button variant="outline" className="justify-between" onClick={() => openUrl(workspace?.editorUrl)}>
                <span className="inline-flex items-center gap-2"><ExternalLink className="h-4 w-4" />{isAr ? "فتح المحرر" : "Open Editor"}</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" className="justify-between" onClick={() => openUrl(workspace?.previewUrl)}>
                <span className="inline-flex items-center gap-2"><ExternalLink className="h-4 w-4" />{isAr ? "فتح المعاينة" : "Open Preview"}</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="justify-between"
                onClick={() => manualSyncMutation.mutate({ entities: ["units", "bookings", "payments", "maintenance"] })}
                disabled={manualSyncMutation.isPending}
              >
                <span className="inline-flex items-center gap-2">
                  {manualSyncMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  {isAr ? "طلب مزامنة يدوية" : "Request Manual Sync"}
                </span>
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" className="justify-between" onClick={() => (window.location.href = "/admin/buildings")}>
                <span className="inline-flex items-center gap-2"><Building2 className="h-4 w-4" />{isAr ? "المباني والوحدات" : "Buildings & Units"}</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" className="justify-between" onClick={() => (window.location.href = "/admin/bookings")}>
                <span className="inline-flex items-center gap-2"><CalendarCheck className="h-4 w-4" />{isAr ? "الحجوزات" : "Bookings"}</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" className="justify-between" onClick={() => (window.location.href = "/admin/payments")}>
                <span className="inline-flex items-center gap-2"><CreditCard className="h-4 w-4" />{isAr ? "المدفوعات" : "Payments"}</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" className="justify-between" onClick={() => (window.location.href = "/admin/emergency-maintenance")}>
                <span className="inline-flex items-center gap-2"><Wrench className="h-4 w-4" />{isAr ? "الصيانة" : "Maintenance"}</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
              <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                <div className="mb-2 inline-flex items-center gap-2 font-medium text-foreground">
                  <Shield className="h-4 w-4 text-[#3ECFC0]" />
                  {isAr ? "الخطوة التالية" : "Next build step"}
                </div>
                <p>
                  {isAr
                    ? "إضافة جدول externalSyncMap وربط طلب المزامنة اليدوية بسجل مزامنة فعلي لكل وحدة/حجز/دفعة/طلب صيانة."
                    : "Add the externalSyncMap table and connect manual sync requests to real per-entity sync records for units, bookings, payments, and maintenance."}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
