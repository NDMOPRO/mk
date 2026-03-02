import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Fingerprint, Loader2, CheckCircle2, XCircle, Clock,
  AlertTriangle, Eye, FileText, User, Shield,
} from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; labelAr: string; color: string; icon: typeof CheckCircle2 }> = {
  pending: { label: "Pending Review", labelAr: "بانتظار المراجعة", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  submitted: { label: "Submitted", labelAr: "تم التقديم", color: "bg-blue-100 text-blue-700", icon: FileText },
  verified: { label: "Verified", labelAr: "تم التحقق", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  rejected: { label: "Rejected", labelAr: "مرفوض", color: "bg-red-100 text-red-700", icon: XCircle },
  expired: { label: "Expired", labelAr: "منتهي", color: "bg-gray-100 text-gray-600", icon: AlertTriangle },
};

export default function AdminKYC() {
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [reviewDialog, setReviewDialog] = useState<{ open: boolean; requestId: number | null; action: "approve" | "reject" }>({ open: false, requestId: null, action: "approve" });
  const [reviewNotes, setReviewNotes] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  const { data: requests, isLoading, refetch } = trpc.integration.kyc.list.useQuery(
    statusFilter === "all" ? undefined : { status: statusFilter }
  );

  const approveMutation = trpc.integration.kyc.approve.useMutation({
    onSuccess: () => {
      toast.success(isAr ? "تمت الموافقة على الطلب" : "Request approved");
      setReviewDialog({ open: false, requestId: null, action: "approve" });
      setReviewNotes("");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const rejectMutation = trpc.integration.kyc.reject.useMutation({
    onSuccess: () => {
      toast.success(isAr ? "تم رفض الطلب" : "Request rejected");
      setReviewDialog({ open: false, requestId: null, action: "approve" });
      setRejectReason("");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleApprove = () => {
    if (!reviewDialog.requestId) return;
    approveMutation.mutate({ requestId: reviewDialog.requestId, notes: reviewNotes || undefined });
  };

  const handleReject = () => {
    if (!reviewDialog.requestId || !rejectReason.trim()) {
      toast.error(isAr ? "سبب الرفض مطلوب" : "Rejection reason is required");
      return;
    }
    rejectMutation.mutate({ requestId: reviewDialog.requestId, reason: rejectReason });
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  const requestList = Array.isArray(requests) ? requests : [];

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-3">
          <Fingerprint className="w-7 h-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">{isAr ? "التحقق من الهوية (KYC)" : "Identity Verification (KYC)"}</h1>
            <p className="text-muted-foreground text-sm">
              {isAr ? "مراجعة طلبات التحقق من الهوية والموافقة عليها أو رفضها" : "Review, approve, or reject identity verification requests"}
            </p>
          </div>
        </div>

        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
          <CardContent className="flex items-start gap-3 p-4">
            <Shield className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p>{isAr
                ? "حالياً يتم التحقق يدوياً فقط. لم يتم ربط مزود KYC خارجي. بوابات KYC معطلة افتراضياً ويمكن تفعيلها من أعلام الميزات."
                : "Currently manual review only. No external KYC provider is connected. KYC gates are OFF by default and can be enabled from Feature Flags."
              }</p>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center gap-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder={isAr ? "فلترة حسب الحالة" : "Filter by status"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isAr ? "الكل" : "All"}</SelectItem>
              <SelectItem value="pending">{isAr ? "بانتظار المراجعة" : "Pending"}</SelectItem>
              <SelectItem value="submitted">{isAr ? "تم التقديم" : "Submitted"}</SelectItem>
              <SelectItem value="verified">{isAr ? "تم التحقق" : "Verified"}</SelectItem>
              <SelectItem value="rejected">{isAr ? "مرفوض" : "Rejected"}</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="outline" className="text-sm">
            {requestList.length} {isAr ? "طلب" : "requests"}
          </Badge>
        </div>

        {requestList.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Fingerprint className="w-12 h-12 text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">
                {isAr ? "لا توجد طلبات تحقق" : "No verification requests found"}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                {isAr ? "ستظهر الطلبات هنا عندما يقدم المستخدمون وثائقهم" : "Requests will appear here when users submit their documents"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {requestList.map((req: any) => {
              const statusConf = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
              const StatusIcon = statusConf.icon;
              return (
                <Card key={req.id}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        <User className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">{req.userName || `User #${req.userId}`}</p>
                        <p className="text-xs text-muted-foreground">
                          {isAr ? "نوع الوثيقة:" : "Document:"} {req.documentType || "national_id"} | {isAr ? "تاريخ التقديم:" : "Submitted:"} {req.createdAt ? new Date(req.createdAt).toLocaleDateString() : "N/A"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={statusConf.color}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {isAr ? statusConf.labelAr : statusConf.label}
                      </Badge>
                      {(req.status === "pending" || req.status === "submitted") && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-600 border-green-200 hover:bg-green-50"
                            onClick={() => setReviewDialog({ open: true, requestId: req.id, action: "approve" })}
                          >
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            {isAr ? "موافقة" : "Approve"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 border-red-200 hover:bg-red-50"
                            onClick={() => { setReviewDialog({ open: true, requestId: req.id, action: "reject" }); setRejectReason(""); }}
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            {isAr ? "رفض" : "Reject"}
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={reviewDialog.open} onOpenChange={(open) => { if (!open) setReviewDialog({ open: false, requestId: null, action: "approve" }); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewDialog.action === "approve"
                ? (isAr ? "الموافقة على التحقق" : "Approve Verification")
                : (isAr ? "رفض التحقق" : "Reject Verification")
              }
            </DialogTitle>
            <DialogDescription>
              {reviewDialog.action === "approve"
                ? (isAr ? "سيتم تحديث حالة المستخدم إلى 'تم التحقق'" : "User status will be updated to 'Verified'")
                : (isAr ? "يرجى تقديم سبب الرفض" : "Please provide a reason for rejection")
              }
            </DialogDescription>
          </DialogHeader>
          {reviewDialog.action === "approve" ? (
            <div className="space-y-3">
              <label className="text-sm font-medium">{isAr ? "ملاحظات (اختياري)" : "Notes (optional)"}</label>
              <Textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} placeholder={isAr ? "ملاحظات المراجعة..." : "Review notes..."} />
            </div>
          ) : (
            <div className="space-y-3">
              <label className="text-sm font-medium">{isAr ? "سبب الرفض (مطلوب)" : "Rejection reason (required)"}</label>
              <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder={isAr ? "سبب الرفض..." : "Reason for rejection..."} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialog({ open: false, requestId: null, action: "approve" })}>
              {isAr ? "إلغاء" : "Cancel"}
            </Button>
            {reviewDialog.action === "approve" ? (
              <Button onClick={handleApprove} disabled={approveMutation.isPending} className="bg-green-600 hover:bg-green-700">
                {approveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isAr ? "تأكيد الموافقة" : "Confirm Approve"}
              </Button>
            ) : (
              <Button onClick={handleReject} disabled={rejectMutation.isPending} variant="destructive">
                {rejectMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isAr ? "تأكيد الرفض" : "Confirm Reject"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
