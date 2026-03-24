import SEOHead from "@/components/SEOHead";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";
import {
  ArrowRight,
  Building2,
  CalendarCheck,
  CreditCard,
  Plug,
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
            <Button variant="outline" onClick={() => (window.location.href = "/admin/integrations")}>
              <Plug className="me-2 h-4 w-4" />
              {isAr ? "إعدادات التكاملات" : "Integration Settings"}
            </Button>
            <Button onClick={() => (window.location.href = "/admin/payments")}>
              <CreditCard className="me-2 h-4 w-4" />
              {isAr ? "المدفوعات والسجل المالي" : "Payments & Ledger"}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{isAr ? "الحالة المعمارية" : "Architecture Mode"}</CardDescription>
              <CardTitle className="text-base">{isAr ? "Monthly Key هو المصدر الرئيسي" : "Monthly Key is source of truth"}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              {isAr ? "الحجوزات والمدفوعات والصيانة الرسمية تبقى في النظام الحالي." : "Bookings, payments, and the official maintenance record stay in the current system."}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{isAr ? "التشغيل" : "Operations Layer"}</CardDescription>
              <CardTitle className="text-base">{isAr ? "Base44 كمساحة عمل" : "Base44 as workspace"}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              {isAr ? "تجميع المتابعة اليومية، التحصيل، والمهام التشغيلية في واجهة واحدة." : "Daily follow-up, collections, and ops tasks are grouped into one workspace."}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{isAr ? "نوع المزامنة" : "Sync Strategy"}</CardDescription>
              <CardTitle className="text-base">{isAr ? "أحادي الاتجاه أولاً" : "One-way first"}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              {isAr ? "ندفع البيانات إلى Base44 أولاً ثم نفتح كتابة محدودة للصيانة فقط." : "Data is pushed to Base44 first, then limited write-back is opened for maintenance only."}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{isAr ? "الأمان" : "Safety Rule"}</CardDescription>
              <CardTitle className="text-base">{isAr ? "لا دفع ولا تأكيد حجز من Base44" : "No payments or booking confirmation from Base44"}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              {isAr ? "يبقى الدفع والمنطق المالي داخل Monthly Key فقط." : "Payment and financial truth remain inside Monthly Key only."}
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
              <CardTitle>{isAr ? "روابط سريعة" : "Quick Links"}</CardTitle>
              <CardDescription>
                {isAr ? "الصفحات الأساسية التي سيعتمد عليها مركز العمليات عند الربط." : "Core screens this operations hub will rely on during the rollout."}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
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
                    ? "إضافة مفاتيح Base44 داخل صفحة التكاملات ثم تفعيل جدول مزامنة خارجي وربط الواجهات الخلفية للبيانات الأساسية."
                    : "Add Base44 credentials in Integrations, then enable an external sync map and wire the backend data flows for the core entities."}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
