import SEOHead from "@/components/SEOHead";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Landmark, CheckCircle2, XCircle, AlertTriangle, Clock,
  Loader2, RefreshCw, Send, RotateCcw, ArrowDownToLine,
  ArrowUpFromLine, Users, Shield, FileText, ChevronDown,
  ChevronUp, ExternalLink, Search, Filter,
} from "lucide-react";

const STATUS_BADGES: Record<string, { label: string; labelAr: string; color: string; icon: typeof CheckCircle2 }> = {
  pending:   { label: "Pending",   labelAr: "قيد الانتظار", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400", icon: Clock },
  submitted: { label: "Submitted", labelAr: "تم الإرسال",   color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",     icon: Send },
  accepted:  { label: "Accepted",  labelAr: "مقبول",         color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",  icon: CheckCircle2 },
  rejected:  { label: "Rejected",  labelAr: "مرفوض",         color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",          icon: XCircle },
  failed:    { label: "Failed",    labelAr: "فشل",           color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",          icon: AlertTriangle },
};

const TYPE_LABELS: Record<string, { label: string; labelAr: string; icon: typeof Send }> = {
  check_in:  { label: "Check-in",  labelAr: "تسجيل وصول",   icon: ArrowDownToLine },
  check_out: { label: "Check-out", labelAr: "تسجيل مغادرة", icon: ArrowUpFromLine },
  companion: { label: "Companion", labelAr: "مرافق",         icon: Users },
  update:    { label: "Update",    labelAr: "تحديث",         icon: RefreshCw },
};

export default function AdminShomoos() {
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [bookingIdFilter, setBookingIdFilter] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [manualBookingId, setManualBookingId] = useState("");

  // Queries
  const enabledQuery = trpc.integration.shomoos.isEnabled.useQuery();
  const statsQuery = trpc.integration.shomoos.stats.useQuery();
  const submissionsQuery = trpc.integration.shomoos.submissions.useQuery({
    status: statusFilter !== "all" ? statusFilter : undefined,
    submissionType: typeFilter !== "all" ? typeFilter : undefined,
    bookingId: bookingIdFilter ? parseInt(bookingIdFilter) : undefined,
    limit: 50,
  } as any);

  // Mutations
  const checkInMut = trpc.integration.shomoos.checkIn.useMutation({
    onSuccess: (r) => {
      if (r.success) {
        toast.success(isAr ? `تم إرسال تسجيل الوصول بنجاح. المرجع: ${r.shomoosRefId || "—"}` : `Check-in submitted successfully. Ref: ${r.shomoosRefId || "—"}`);
      } else {
        toast.error(r.error || (isAr ? "فشل إرسال تسجيل الوصول" : "Check-in submission failed"));
      }
      submissionsQuery.refetch();
      statsQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const checkOutMut = trpc.integration.shomoos.checkOut.useMutation({
    onSuccess: (r) => {
      if (r.success) {
        toast.success(isAr ? "تم إرسال تسجيل المغادرة بنجاح" : "Check-out submitted successfully");
      } else {
        toast.error(r.error || (isAr ? "فشل إرسال تسجيل المغادرة" : "Check-out submission failed"));
      }
      submissionsQuery.refetch();
      statsQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const retryMut = trpc.integration.shomoos.retry.useMutation({
    onSuccess: (r) => {
      if (r.success) {
        toast.success(isAr ? "تمت إعادة المحاولة بنجاح" : "Retry successful");
      } else {
        toast.error(r.error || (isAr ? "فشلت إعادة المحاولة" : "Retry failed"));
      }
      submissionsQuery.refetch();
      statsQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const isEnabled = enabledQuery.data?.enabled ?? false;
  const stats = statsQuery.data || {};
  const submissions = submissionsQuery.data || [];

  const handleManualCheckIn = () => {
    const id = parseInt(manualBookingId);
    if (!id || isNaN(id)) {
      toast.error(isAr ? "يرجى إدخال رقم حجز صحيح" : "Please enter a valid booking ID");
      return;
    }
    checkInMut.mutate({ bookingId: id });
    setManualBookingId("");
  };

  return (
    <DashboardLayout>
      <SEOHead title="Shomoos Integration | المفتاح الشهري - Monthly Key" />
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Landmark className="h-6 w-6" />
              {isAr ? "شموس — وزارة الداخلية" : "Shomoos (شموس) — Ministry of Interior"}
            </h1>
            <p className="text-muted-foreground mt-1">
              {isAr
                ? "شبكة المعلومات الوطنية السياحية — تسجيل النزلاء والمستأجرين"
                : "National Tourism Information Network — Guest & Tenant Registration"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="https://shomoos.gov.sa/Portal/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {isAr ? "بوابة شموس" : "Shomoos Portal"}
            </a>
            <Button variant="outline" size="sm" onClick={() => { submissionsQuery.refetch(); statsQuery.refetch(); }}>
              <RefreshCw className="h-4 w-4" /> {isAr ? "تحديث" : "Refresh"}
            </Button>
          </div>
        </div>

        {/* Status Banner */}
        {!isEnabled && (
          <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-amber-800 dark:text-amber-300">
                  {isAr ? "شموس غير مُفعّل" : "Shomoos Not Enabled"}
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                  {isAr
                    ? "لتفعيل شموس، اذهب إلى إعدادات التكاملات وأدخل بيانات الاعتماد (رابط API، مفتاح API، رقم المنشأة، رقم الترخيص، السجل التجاري) ثم فعّل التكامل."
                    : "To enable Shomoos, go to Integration Settings and enter your credentials (API URL, API Key, Facility ID, License Number, Commercial Registration) then enable the integration."}
                </p>
                <a href="/admin/integrations" className="inline-flex items-center gap-1 text-sm font-medium text-amber-800 dark:text-amber-300 hover:underline mt-2">
                  {isAr ? "الذهاب إلى إعدادات التكاملات" : "Go to Integration Settings"} →
                </a>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="text-center p-4">
            <div className="text-2xl font-bold">{Object.values(stats).reduce((a: number, b: number) => a + b, 0)}</div>
            <div className="text-xs text-muted-foreground">{isAr ? "إجمالي الإرسالات" : "Total Submissions"}</div>
          </Card>
          <Card className="text-center p-4">
            <div className="text-2xl font-bold text-yellow-600">{stats.pending || 0}</div>
            <div className="text-xs text-muted-foreground">{isAr ? "قيد الانتظار" : "Pending"}</div>
          </Card>
          <Card className="text-center p-4">
            <div className="text-2xl font-bold text-blue-600">{stats.submitted || 0}</div>
            <div className="text-xs text-muted-foreground">{isAr ? "تم الإرسال" : "Submitted"}</div>
          </Card>
          <Card className="text-center p-4">
            <div className="text-2xl font-bold text-green-600">{stats.accepted || 0}</div>
            <div className="text-xs text-muted-foreground">{isAr ? "مقبول" : "Accepted"}</div>
          </Card>
          <Card className="text-center p-4">
            <div className="text-2xl font-bold text-red-600">{(stats.failed || 0) + (stats.rejected || 0)}</div>
            <div className="text-xs text-muted-foreground">{isAr ? "فاشل / مرفوض" : "Failed / Rejected"}</div>
          </Card>
        </div>

        {/* Manual Check-in */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Send className="h-4 w-4 text-blue-500" />
              {isAr ? "إرسال يدوي لتسجيل وصول" : "Manual Check-in Submission"}
            </CardTitle>
            <CardDescription>
              {isAr
                ? "أدخل رقم الحجز لإرسال بيانات النزيل إلى شموس يدوياً. يجب أن يكون النزيل قد أكمل التحقق من الهوية."
                : "Enter a booking ID to manually submit guest data to Shomoos. The tenant must have completed identity verification."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 items-end">
              <div className="flex-1 max-w-xs">
                <Label className="text-sm">{isAr ? "رقم الحجز" : "Booking ID"}</Label>
                <Input
                  type="number"
                  placeholder={isAr ? "مثال: 1234" : "e.g. 1234"}
                  value={manualBookingId}
                  onChange={(e) => setManualBookingId(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleManualCheckIn()}
                />
              </div>
              <Button
                onClick={handleManualCheckIn}
                disabled={checkInMut.isPending || !isEnabled}
              >
                {checkInMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {isAr ? "إرسال تسجيل وصول" : "Submit Check-in"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{isAr ? "تصفية" : "Filter"}</span>
              </div>
              <div className="w-40">
                <Label className="text-xs">{isAr ? "الحالة" : "Status"}</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{isAr ? "الكل" : "All"}</SelectItem>
                    <SelectItem value="pending">{isAr ? "قيد الانتظار" : "Pending"}</SelectItem>
                    <SelectItem value="submitted">{isAr ? "تم الإرسال" : "Submitted"}</SelectItem>
                    <SelectItem value="accepted">{isAr ? "مقبول" : "Accepted"}</SelectItem>
                    <SelectItem value="rejected">{isAr ? "مرفوض" : "Rejected"}</SelectItem>
                    <SelectItem value="failed">{isAr ? "فشل" : "Failed"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-40">
                <Label className="text-xs">{isAr ? "النوع" : "Type"}</Label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{isAr ? "الكل" : "All"}</SelectItem>
                    <SelectItem value="check_in">{isAr ? "تسجيل وصول" : "Check-in"}</SelectItem>
                    <SelectItem value="check_out">{isAr ? "تسجيل مغادرة" : "Check-out"}</SelectItem>
                    <SelectItem value="companion">{isAr ? "مرافق" : "Companion"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-36">
                <Label className="text-xs">{isAr ? "رقم الحجز" : "Booking ID"}</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    type="number"
                    placeholder="#"
                    value={bookingIdFilter}
                    onChange={(e) => setBookingIdFilter(e.target.value)}
                    className="h-9 pl-8"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submissions List */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {isAr ? "سجل الإرسالات" : "Submission Log"}
            <Badge variant="secondary" className="text-xs">{submissions.length}</Badge>
          </h2>

          {submissionsQuery.isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : submissions.length === 0 ? (
            <Card className="text-center p-8">
              <Landmark className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-muted-foreground text-sm">
                {isAr ? "لا توجد إرسالات بعد" : "No submissions yet"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {isAr
                  ? "ستظهر هنا عند إرسال بيانات النزلاء إلى شموس"
                  : "Submissions will appear here when guest data is sent to Shomoos"}
              </p>
            </Card>
          ) : (
            <div className="space-y-2">
              {submissions.map((sub: any) => {
                const statusConf = STATUS_BADGES[sub.status] || STATUS_BADGES.pending;
                const StatusIcon = statusConf.icon;
                const typeConf = TYPE_LABELS[sub.submissionType] || TYPE_LABELS.check_in;
                const TypeIcon = typeConf.icon;
                const isExpanded = expandedId === sub.id;

                // Parse request payload for display
                let guestName = "";
                let idNumber = "";
                try {
                  const payload = typeof sub.requestPayload === "string" ? JSON.parse(sub.requestPayload) : sub.requestPayload;
                  if (payload?.guest) {
                    guestName = payload.guest.fullNameAr || payload.guest.fullNameEn || "";
                    idNumber = payload.guest.identityNumber || "";
                  }
                  if (payload?.companion) {
                    guestName = payload.companion.fullNameAr || payload.companion.fullNameEn || "";
                    idNumber = payload.companion.identityNumber || "";
                  }
                } catch { /* ignore */ }

                return (
                  <Card key={sub.id} className={`transition-all hover:shadow-sm ${sub.status === "failed" ? "border-l-4 border-l-red-400" : sub.status === "accepted" ? "border-l-4 border-l-green-400" : ""}`}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <TypeIcon className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">
                                #{sub.id} — {isAr ? typeConf.labelAr : typeConf.label}
                              </span>
                              {sub.bookingId && (
                                <span className="text-xs text-muted-foreground">
                                  {isAr ? "حجز" : "Booking"} #{sub.bookingId}
                                </span>
                              )}
                            </div>
                            {guestName && (
                              <span className="text-xs text-muted-foreground">
                                {guestName} {idNumber ? `(${idNumber.substring(0, 4)}****)` : ""}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={statusConf.color}>
                            <StatusIcon className="h-3 w-3 mx-0.5" />
                            {isAr ? statusConf.labelAr : statusConf.label}
                          </Badge>
                          {sub.shomoosRefId && (
                            <span className="text-xs font-mono text-muted-foreground">
                              Ref: {sub.shomoosRefId}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(sub.createdAt).toLocaleString(isAr ? "ar-SA" : "en-US", {
                              month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                            })}
                          </span>
                          {/* Actions */}
                          {sub.status === "failed" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => retryMut.mutate({ submissionId: sub.id })}
                              disabled={retryMut.isPending}
                            >
                              {retryMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                              {isAr ? "إعادة" : "Retry"}
                            </Button>
                          )}
                          {sub.status === "submitted" && sub.submissionType === "check_in" && sub.shomoosRefId && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => {
                                const today = new Date().toISOString().split("T")[0];
                                checkOutMut.mutate({ submissionId: sub.id, checkOutDate: today });
                              }}
                              disabled={checkOutMut.isPending}
                            >
                              {checkOutMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowUpFromLine className="h-3 w-3" />}
                              {isAr ? "تسجيل مغادرة" : "Check-out"}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => setExpandedId(isExpanded ? null : sub.id)}
                          >
                            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      </div>

                      {/* Error message */}
                      {sub.errorMessage && (
                        <p className="text-xs text-red-500 mt-1">{sub.errorMessage}</p>
                      )}

                      {/* Expanded details */}
                      {isExpanded && (
                        <div className="mt-3 space-y-2">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                            <div>
                              <span className="text-muted-foreground">{isAr ? "النوع" : "Type"}:</span>
                              <span className="font-medium mx-1">{isAr ? typeConf.labelAr : typeConf.label}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">{isAr ? "المحاولات" : "Retries"}:</span>
                              <span className="font-medium mx-1">{sub.retryCount}</span>
                            </div>
                            {sub.submittedByName && (
                              <div>
                                <span className="text-muted-foreground">{isAr ? "بواسطة" : "By"}:</span>
                                <span className="font-medium mx-1">{sub.submittedByName}</span>
                              </div>
                            )}
                            {sub.tenantId && (
                              <div>
                                <span className="text-muted-foreground">{isAr ? "المستأجر" : "Tenant"}:</span>
                                <span className="font-medium mx-1">#{sub.tenantId}</span>
                              </div>
                            )}
                          </div>

                          {sub.requestPayload && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-1">{isAr ? "البيانات المرسلة" : "Request Payload"}:</p>
                              <pre className="p-2 bg-muted/50 rounded text-xs font-mono overflow-x-auto max-h-40 whitespace-pre-wrap">
                                {typeof sub.requestPayload === "string"
                                  ? JSON.stringify(JSON.parse(sub.requestPayload), null, 2)
                                  : JSON.stringify(sub.requestPayload, null, 2)}
                              </pre>
                            </div>
                          )}

                          {sub.responsePayload && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-1">{isAr ? "استجابة شموس" : "Shomoos Response"}:</p>
                              <pre className="p-2 bg-muted/50 rounded text-xs font-mono overflow-x-auto max-h-40 whitespace-pre-wrap">
                                {typeof sub.responsePayload === "string"
                                  ? JSON.stringify(JSON.parse(sub.responsePayload), null, 2)
                                  : JSON.stringify(sub.responsePayload, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Info Card */}
        <Card className="bg-muted/30">
          <CardContent className="p-4">
            <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-500" />
              {isAr ? "عن نظام شموس" : "About Shomoos System"}
            </h3>
            <div className="text-xs text-muted-foreground space-y-1.5">
              <p>
                {isAr
                  ? "شموس هو نظام شبكة المعلومات الوطنية السياحية التابع لوزارة الداخلية في المملكة العربية السعودية. يُلزم جميع المنشآت الإيوائية بتسجيل بيانات النزلاء عند الوصول والمغادرة."
                  : "Shomoos is the National Tourism Information Network operated by the Ministry of Interior, KSA. All accommodation facilities are required to register guest data on check-in and check-out."}
              </p>
              <p>
                {isAr
                  ? "البيانات المطلوبة: الاسم الكامل، نوع الهوية (وطنية/إقامة/جواز)، رقم الهوية، الجنسية، تاريخ الميلاد، تاريخ الوصول والمغادرة، رقم الوحدة."
                  : "Required data: Full name, ID type (National ID/Iqama/Passport), ID number, nationality, date of birth, check-in/out dates, unit number."}
              </p>
              <p>
                {isAr
                  ? "للتسجيل في شموس والحصول على بيانات الاعتماد، قم بزيارة بوابة شموس: shomoos.gov.sa"
                  : "To register with Shomoos and obtain API credentials, visit the Shomoos portal: shomoos.gov.sa"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
