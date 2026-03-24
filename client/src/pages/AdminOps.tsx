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
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Eye,
  Loader2,
  Play,
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

  const healthQuery = trpc.base44.getSyncHealth.useQuery(undefined, { retry: false });
  const workspaceQuery = trpc.base44.openWorkspace.useQuery(undefined, { retry: false });
  const queueQuery = trpc.base44.listSyncQueue.useQuery({ limit: 8 }, { retry: false });

  const refreshAll = async () => {
    await Promise.all([healthQuery.refetch(), workspaceQuery.refetch(), queueQuery.refetch()]);
  };

  const manualSyncMutation = trpc.base44.runManualSync.useMutation({
    onSuccess: async (result) => {
      toast.success(result.message);
      await refreshAll();
    },
    onError: (error) => toast.error(error.message),
  });

  const prepareMutation = trpc.base44.preparePendingSync.useMutation({
    onSuccess: async (result) => {
      toast.success(isAr ? `تم تجهيز ${result.prepared.length} سجل` : `Prepared ${result.prepared.length} row(s)`);
      await refreshAll();
    },
    onError: (error) => toast.error(error.message),
  });

  const executeMutation = trpc.base44.executePreparedSync.useMutation({
    onSuccess: async (result) => {
      const synced = result.results.filter((r) => r.status === "synced").length;
      const failed = result.results.filter((r) => r.status === "failed").length;
      toast.success(isAr ? `تمت مزامنة ${synced} وفشل ${failed}` : `Synced ${synced}, failed ${failed}`);
      await refreshAll();
    },
    onError: (error) => toast.error(error.message),
  });

  const previewMutation = trpc.base44.preparePendingSync.useMutation({
    onSuccess: (result) => {
      const first = result.previews[0];
      if (!first) {
        toast.message(isAr ? "لا توجد سجلات معلقة" : "No pending rows");
        return;
      }
      console.log("Base44 payload preview", first);
      toast.success(isAr ? "تمت طباعة أول حمولة في console" : "First payload logged to console");
    },
    onError: (error) => toast.error(error.message),
  });

  const integration = healthQuery.data?.integration;
  const sourceCounts = healthQuery.data?.sourceCounts;
  const syncQueue = healthQuery.data?.syncQueue;
  const workspace = workspaceQuery.data;
  const queueRows = queueQuery.data || [];

  const isBusy = manualSyncMutation.isPending || prepareMutation.isPending || executeMutation.isPending || previewMutation.isPending;

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
            <Button variant="outline" onClick={refreshAll} disabled={healthQuery.isFetching || queueQuery.isFetching}>
              {(healthQuery.isFetching || queueQuery.isFetching) ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <RefreshCw className="me-2 h-4 w-4" />}
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

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{isAr ? "معلق" : "Pending"}</CardDescription>
              <CardTitle className="text-base">{syncQueue?.pending ?? 0}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">{isAr ? "بانتظار التحضير أو التنفيذ." : "Waiting to be prepared or executed."}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{isAr ? "تمت مزامنته" : "Synced"}</CardDescription>
              <CardTitle className="text-base">{syncQueue?.synced ?? 0}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">{isAr ? "نجحت في الوصول إلى Base44." : "Reached Base44 successfully."}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{isAr ? "فشل" : "Failed"}</CardDescription>
              <CardTitle className="text-base">{syncQueue?.failed ?? 0}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">{isAr ? "تحتاج مراجعة أو إعادة محاولة." : "Needs review or retry."}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{isAr ? "الدالة" : "Function"}</CardDescription>
              <CardTitle className="text-base">{integration?.syncFunctionUrl ? (isAr ? "مضبوطة" : "Configured") : (isAr ? "مفقودة" : "Missing")}</CardTitle>
            </CardHeader>
            <CardContent className="truncate text-xs text-muted-foreground">{integration?.syncFunctionUrl || (isAr ? "أضف Sync Function URL داخل التكاملات." : "Add Sync Function URL in Integrations.")}</CardContent>
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
                {isAr ? "الآن يمكن تنفيذ الدورة من نفس الصفحة." : "You can now run the cycle from this page."}
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
              <Button variant="outline" className="justify-between" onClick={() => manualSyncMutation.mutate({ entities: ["units", "bookings", "payments", "maintenance"] })} disabled={isBusy}>
                <span className="inline-flex items-center gap-2">{manualSyncMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}{isAr ? "1) إنشاء صفوف المزامنة" : "1) Queue Sync Rows"}</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" className="justify-between" onClick={() => prepareMutation.mutate({ limit: 10 })} disabled={isBusy}>
                <span className="inline-flex items-center gap-2">{prepareMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{isAr ? "2) تجهيز الحمولة" : "2) Prepare Payloads"}</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" className="justify-between" onClick={() => executeMutation.mutate({ limit: 10 })} disabled={isBusy || !integration?.syncFunctionUrl}>
                <span className="inline-flex items-center gap-2">{executeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}{isAr ? "3) تنفيذ الإرسال" : "3) Execute Send"}</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" className="justify-between" onClick={() => previewMutation.mutate({ limit: 1 })} disabled={isBusy}>
                <span className="inline-flex items-center gap-2">{previewMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}{isAr ? "معاينة أول حمولة" : "Preview First Payload"}</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
              <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                <div className="mb-2 inline-flex items-center gap-2 font-medium text-foreground">
                  <Shield className="h-4 w-4 text-[#3ECFC0]" />
                  {isAr ? "ما تبقى" : "What remains"}
                </div>
                <p>
                  {isAr
                    ? "بعد تأكيد عمل الدالة في Base44، الخطوة التالية هي إعادة المحاولة التلقائية والكتابة العكسية للصيانة."
                    : "Once the Base44 function is confirmed working, the next step is automatic retry and maintenance write-back."}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{isAr ? "آخر صفوف المزامنة" : "Recent Sync Queue Rows"}</CardTitle>
            <CardDescription>{isAr ? "عرض سريع لآخر السجلات المعلقة أو المنفذة." : "Quick visibility into the latest queued or executed rows."}</CardDescription>
          </CardHeader>
          <CardContent>
            {queueQuery.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{isAr ? "جاري تحميل الصفوف..." : "Loading queue rows..."}</div>
            ) : queueRows.length === 0 ? (
              <div className="text-sm text-muted-foreground">{isAr ? "لا توجد صفوف مزامنة بعد." : "No sync rows yet."}</div>
            ) : (
              <div className="space-y-3">
                {queueRows.map((row: any) => (
                  <div key={row.id} className="rounded-xl border p-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">#{row.id}</span>
                          <Badge variant="outline">{row.entityType}</Badge>
                          <Badge variant={row.syncStatus === "failed" ? "destructive" : row.syncStatus === "synced" ? "secondary" : "outline"}>{row.syncStatus}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {isAr ? "المعرف المحلي" : "Local ID"}: {row.localId}
                          {" • "}
                          {isAr ? "الاتجاه" : "Direction"}: {row.syncDirection}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {row.syncStatus === "synced" ? <CheckCircle2 className="h-4 w-4" /> : null}
                        {row.syncStatus === "failed" ? <Wrench className="h-4 w-4" /> : null}
                        <span>{row.externalId || (isAr ? "بدون معرف خارجي" : "No external ID")}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
