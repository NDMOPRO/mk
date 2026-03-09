import SEOHead from "@/components/SEOHead";
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { normalizeImageUrl, BROKEN_IMAGE_PLACEHOLDER } from "@/lib/image-utils";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { SendWhatsAppDialog } from "./AdminWhatsApp";
import {
  Search, Loader2, Eye, Phone, Mail, MapPin, BedDouble, Bath, Ruler,
  MessageCircle as MessageCircleWA,
  ChevronLeft, ChevronRight, Inbox, ArrowUpRight, CheckCircle, XCircle,
  MessageSquare, Clock, Building2, User, Home, StickyNote, Calendar,
  ExternalLink, Image as ImageIcon, Armchair, DollarSign, FileText,
  Save, RefreshCw
} from "lucide-react";

// ─── Constants ──────────────────────────────────────────────────────
const statusColors: Record<string, string> = {
  new: "bg-blue-500/10 text-blue-600 border-blue-200",
  contacted: "bg-amber-500/10 text-amber-600 border-amber-200",
  approved: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
  rejected: "bg-red-500/10 text-red-600 border-red-200",
};
const statusLabels: Record<string, string> = {
  new: "جديد", contacted: "تم التواصل", approved: "مقبول", rejected: "مرفوض",
};
const statusLabelsEn: Record<string, string> = {
  new: "New", contacted: "Contacted", approved: "Approved", rejected: "Rejected",
};
const statusIcons: Record<string, any> = {
  new: Clock, contacted: MessageSquare, approved: CheckCircle, rejected: XCircle,
};
const propertyTypeLabels: Record<string, string> = {
  apartment: "شقة", villa: "فيلا", studio: "استوديو", duplex: "دوبلكس",
  furnished_room: "غرفة مفروشة", compound: "مجمع سكني", hotel_apartment: "شقة فندقية",
};
const propertyTypeLabelsEn: Record<string, string> = {
  apartment: "Apartment", villa: "Villa", studio: "Studio", duplex: "Duplex",
  furnished_room: "Furnished Room", compound: "Compound", hotel_apartment: "Hotel Apartment",
};
const furnishedLabels: Record<string, string> = {
  unfurnished: "غير مفروش", semi_furnished: "مفروش جزئياً", fully_furnished: "مفروش بالكامل",
};
const furnishedLabelsEn: Record<string, string> = {
  unfurnished: "Unfurnished", semi_furnished: "Semi Furnished", fully_furnished: "Fully Furnished",
};

// ─── Main Page ──────────────────────────────────────────────────────
export default function AdminSubmissions() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showConvert, setShowConvert] = useState(false);
  const [convertId, setConvertId] = useState<number | null>(null);

  const { data, isLoading, refetch } = trpc.submission.list.useQuery({
    limit: 20, offset: page * 20,
    status: statusFilter !== "all" ? statusFilter : undefined,
    search: search || undefined,
  });

  const { data: counts } = trpc.submission.counts.useQuery();

  return (
    <DashboardLayout>
      <SEOHead title="Submissions | المفتاح الشهري - Monthly Key" />
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">طلبات إضافة عقار</h1>
          <p className="text-muted-foreground text-sm mt-1">مراجعة وإدارة طلبات تسجيل العقارات من الملاك</p>
        </div>

        {/* Pipeline Stepper */}
        {counts && (
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="flex items-stretch">
                {[
                  { key: "new", label: "جديد", labelEn: "NEW", value: counts.new, icon: Clock, bg: "bg-blue-50 dark:bg-blue-950/30", border: "border-blue-200", text: "text-blue-700 dark:text-blue-400", accent: "bg-blue-500" },
                  { key: "contacted", label: "تم التواصل", labelEn: "CONTACTED", value: counts.contacted, icon: MessageSquare, bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-200", text: "text-amber-700 dark:text-amber-400", accent: "bg-amber-500" },
                  { key: "approved", label: "مقبول", labelEn: "APPROVED", value: counts.approved, icon: CheckCircle, bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-200", text: "text-emerald-700 dark:text-emerald-400", accent: "bg-emerald-500" },
                  { key: "rejected", label: "مرفوض", labelEn: "REJECTED", value: counts.rejected, icon: XCircle, bg: "bg-red-50 dark:bg-red-950/30", border: "border-red-200", text: "text-red-700 dark:text-red-400", accent: "bg-red-500" },
                ].map((step, i, arr) => {
                  const Icon = step.icon;
                  const isActive = statusFilter === step.key;
                  return (
                    <button
                      key={step.key}
                      onClick={() => { setStatusFilter(isActive ? "all" : step.key); setPage(0); }}
                      className={`flex-1 relative px-4 py-4 flex flex-col items-center gap-1.5 transition-all
                        ${isActive ? step.bg + " ring-2 ring-inset ring-current " + step.text : "hover:bg-muted/50"}
                        ${i < arr.length - 1 ? "border-e" : ""}`}
                    >
                      <div className={`absolute top-0 inset-x-0 h-1 ${isActive ? step.accent : "bg-transparent"} transition-colors`} />
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center ${isActive ? step.accent + " text-white" : "bg-muted"}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className={`text-2xl font-bold ${isActive ? step.text : "text-foreground"}`}>{step.value}</span>
                      <span className="text-xs text-muted-foreground">{step.label}</span>
                      {i < arr.length - 1 && i < 2 && (
                        <div className="absolute end-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10">
                          <ChevronLeft className="h-5 w-5 text-muted-foreground/40" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="border-t px-4 py-2 flex items-center justify-between bg-muted/30">
                <span className="text-xs text-muted-foreground">إجمالي الطلبات: <strong className="text-foreground">{counts.total}</strong></span>
                {statusFilter !== "all" && (
                  <button onClick={() => { setStatusFilter("all"); setPage(0); }} className="text-xs text-blue-600 hover:underline">
                    عرض الكل
                  </button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="بحث بالاسم أو الهاتف..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="ps-9" />
          </div>
          <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="الحالة" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الحالات</SelectItem>
              <SelectItem value="new">جديد</SelectItem>
              <SelectItem value="contacted">تم التواصل</SelectItem>
              <SelectItem value="approved">مقبول</SelectItem>
              <SelectItem value="rejected">مرفوض</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Submissions List */}
        {isLoading ? (
          <div className="grid gap-4">
            {[1,2,3].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
        ) : !data?.items?.length ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Inbox className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <p className="text-muted-foreground">لا توجد طلبات</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {data.items.map((sub: any) => {
              const StatusIcon = statusIcons[sub.status] || Clock;
              return (
                <Card key={sub.id} className="hover:shadow-md transition-shadow cursor-pointer group" onClick={() => setSelectedId(sub.id)}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {/* Header row: Name + Status + Converted badge */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="w-8 h-8 rounded-full bg-[#3ECFC0]/10 flex items-center justify-center flex-shrink-0">
                            <User className="h-4 w-4 text-[#3ECFC0]" />
                          </div>
                          <h3 className="font-semibold text-base">{sub.ownerNameAr || sub.ownerName}</h3>
                          <Badge variant="outline" className={statusColors[sub.status] || ""}>
                            <StatusIcon className="h-3 w-3 me-1" />
                            {statusLabels[sub.status] || sub.status}
                          </Badge>
                          {sub.convertedPropertyId && (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-200">
                              <ArrowUpRight className="h-3 w-3 me-1" /> تم التحويل #{sub.convertedPropertyId}
                            </Badge>
                          )}
                        </div>

                        {/* Contact & Property info row */}
                        <div className="flex items-center gap-4 mt-2.5 text-sm text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> <span dir="ltr">{sub.phone}</span></span>
                          {sub.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {sub.email}</span>}
                          {(sub.cityAr || sub.city) && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {sub.cityAr || sub.city}</span>}
                          {sub.propertyType && (
                            <span className="flex items-center gap-1">
                              <Home className="h-3.5 w-3.5" />
                              {propertyTypeLabels[sub.propertyType] || sub.propertyType}
                            </span>
                          )}
                          {sub.desiredMonthlyRent && (
                            <span className="flex items-center gap-1 font-medium text-foreground">
                              <DollarSign className="h-3.5 w-3.5" />
                              {sub.desiredMonthlyRent} ر.س
                            </span>
                          )}
                        </div>

                        {/* Date */}
                        <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {new Date(sub.createdAt).toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>

                      {/* View button */}
                      <Button size="sm" variant="ghost" className="opacity-60 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); setSelectedId(sub.id); }}>
                        <Eye className="h-4 w-4 me-1" />
                        <span className="text-xs">عرض</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {data && data.total > 20 && (
          <div className="flex items-center justify-center gap-2">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              <ChevronRight className="h-4 w-4" /> السابق
            </Button>
            <span className="text-sm text-muted-foreground">صفحة {page + 1} من {Math.ceil(data.total / 20)}</span>
            <Button size="sm" variant="outline" disabled={(page + 1) * 20 >= data.total} onClick={() => setPage(p => p + 1)}>
              التالي <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Detail Dialog */}
        <SubmissionDetailDialog
          id={selectedId}
          open={selectedId !== null}
          onClose={() => setSelectedId(null)}
          onRefresh={refetch}
          onConvert={(id) => { setConvertId(id); setSelectedId(null); setShowConvert(true); }}
        />

        {/* Convert Dialog */}
        {showConvert && convertId && (
          <ConvertDialog
            submissionId={convertId}
            open={showConvert}
            onClose={() => { setShowConvert(false); setConvertId(null); }}
            onSuccess={() => { refetch(); setShowConvert(false); setConvertId(null); }}
          />
        )}
      </div>
    </DashboardLayout>
  );
}

// ─── Detail Dialog ──────────────────────────────────────────────────
function SubmissionDetailDialog({ id, open, onClose, onRefresh, onConvert }: {
  id: number | null; open: boolean; onClose: () => void; onRefresh: () => void; onConvert: (id: number) => void;
}) {
  const [updating, setUpdating] = useState(false);
  const [notes, setNotes] = useState("");
  const [notesInitialized, setNotesInitialized] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const { data, isLoading } = trpc.submission.getById.useQuery(
    { id: id! },
    { enabled: !!id && open }
  );

  const updateStatus = trpc.submission.updateStatus.useMutation();

  // Initialize notes from data
  useEffect(() => {
    if (data && !notesInitialized) {
      setNotes(data.internalNotes || "");
      setNotesInitialized(true);
    }
  }, [data, notesInitialized]);

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      setNotesInitialized(false);
      setNotes("");
      setSelectedPhoto(null);
    }
  }, [open]);

  const handleStatusChange = async (status: "new" | "contacted" | "approved" | "rejected") => {
    if (!id) return;
    setUpdating(true);
    try {
      await updateStatus.mutateAsync({ id, status, internalNotes: notes || undefined });
      toast.success("تم تحديث الحالة بنجاح");
      onRefresh();
    } catch (err: any) {
      toast.error(err?.message || "حدث خطأ");
    }
    setUpdating(false);
  };

  const handleSaveNotes = async () => {
    if (!id || !data) return;
    setSavingNotes(true);
    try {
      await updateStatus.mutateAsync({ id, status: data.status, internalNotes: notes });
      toast.success("تم حفظ الملاحظات");
      onRefresh();
    } catch (err: any) {
      toast.error(err?.message || "حدث خطأ");
    }
    setSavingNotes(false);
  };

  // ─── Info Row Helper ────────────────────────────────────────────
  const InfoRow = ({ icon: Icon, label, value, dir: rowDir }: { icon: any; label: string; value: string | number | undefined | null; dir?: string }) => {
    if (!value && value !== 0) return null;
    return (
      <div className="flex items-start gap-3 py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-colors">
        <div className="w-8 h-8 rounded-lg bg-[#3ECFC0]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Icon className="h-4 w-4 text-[#3ECFC0]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
          <p className="text-sm font-medium text-foreground" dir={rowDir}>{value}</p>
        </div>
      </div>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl max-h-[92vh] p-0 overflow-hidden flex flex-col">
          <DialogHeader className="px-6 pt-5 pb-0">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl font-bold">
                  تفاصيل الطلب <span className="text-muted-foreground font-normal text-base">#{id}</span>
                </DialogTitle>
                <DialogDescription className="text-sm mt-1">مراجعة بيانات طلب تسجيل العقار والتواصل مع المالك</DialogDescription>
              </div>
              {data && (
                <Badge variant="outline" className={`${statusColors[data.status] || ""} text-sm px-3 py-1`}>
                  {(() => { const Icon = statusIcons[data.status] || Clock; return <Icon className="h-3.5 w-3.5 me-1.5" />; })()}
                  {statusLabels[data.status] || data.status}
                </Badge>
              )}
            </div>
          </DialogHeader>

          <Separator className="mt-4" />

          <ScrollArea className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="space-y-4 p-6">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : data ? (
              <div className="p-6 space-y-6">

                {/* ═══ Section 1: Owner / Contact Info ═══ */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <User className="h-4 w-4 text-blue-600" />
                    </div>
                    <h3 className="font-bold text-sm">بيانات المالك / Owner Info</h3>
                  </div>
                  <Card className="border-blue-100 dark:border-blue-900/30">
                    <CardContent className="p-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-0.5">
                        <InfoRow icon={User} label="الاسم (عربي)" value={data.ownerNameAr} />
                        <InfoRow icon={User} label="Name (English)" value={data.ownerName} />
                        <InfoRow icon={Phone} label="رقم الهاتف / Phone" value={data.phone} dir="ltr" />
                        <InfoRow icon={Mail} label="البريد الإلكتروني / Email" value={data.email} dir="ltr" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* ═══ Section 2: Property Info ═══ */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <Home className="h-4 w-4 text-emerald-600" />
                    </div>
                    <h3 className="font-bold text-sm">بيانات العقار / Property Details</h3>
                  </div>
                  <Card className="border-emerald-100 dark:border-emerald-900/30">
                    <CardContent className="p-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-0.5">
                        <InfoRow
                          icon={Building2}
                          label="نوع العقار / Type"
                          value={data.propertyType ? `${propertyTypeLabels[data.propertyType] || data.propertyType} — ${propertyTypeLabelsEn[data.propertyType] || data.propertyType}` : undefined}
                        />
                        <InfoRow
                          icon={DollarSign}
                          label="الإيجار المطلوب / Desired Rent"
                          value={data.desiredMonthlyRent ? `${data.desiredMonthlyRent} ر.س / SAR` : undefined}
                        />
                        <InfoRow icon={MapPin} label="المدينة (عربي)" value={data.cityAr} />
                        <InfoRow icon={MapPin} label="City (English)" value={data.city} />
                        <InfoRow icon={MapPin} label="الحي (عربي)" value={data.districtAr} />
                        <InfoRow icon={MapPin} label="District (English)" value={data.district} />
                        <InfoRow icon={MapPin} label="العنوان (عربي)" value={data.addressAr} />
                        <InfoRow icon={MapPin} label="Address (English)" value={data.address} />
                        <InfoRow icon={BedDouble} label="غرف النوم / Bedrooms" value={data.bedrooms} />
                        <InfoRow icon={Bath} label="الحمامات / Bathrooms" value={data.bathrooms} />
                        <InfoRow icon={Ruler} label="المساحة / Size" value={data.sizeSqm ? `${data.sizeSqm} م² / sqm` : undefined} />
                        <InfoRow
                          icon={Armchair}
                          label="التأثيث / Furnished"
                          value={data.furnishedLevel ? `${furnishedLabels[data.furnishedLevel] || data.furnishedLevel} — ${furnishedLabelsEn[data.furnishedLevel] || data.furnishedLevel}` : undefined}
                        />
                      </div>

                      {/* Google Maps Link */}
                      {data.googleMapsUrl && (
                        <div className="mt-2 px-3 pb-2">
                          <a
                            href={data.googleMapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-sm text-[#3ECFC0] hover:text-[#2ab5a6] font-medium"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            عرض على خرائط جوجل / View on Google Maps
                          </a>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* ═══ Section 3: Owner Notes ═══ */}
                {(data.notes || data.notesAr) && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center">
                        <FileText className="h-4 w-4 text-purple-600" />
                      </div>
                      <h3 className="font-bold text-sm">ملاحظات المالك / Owner Notes</h3>
                    </div>
                    <Card className="border-purple-100 dark:border-purple-900/30">
                      <CardContent className="p-4 space-y-3">
                        {data.notesAr && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">بالعربي:</p>
                            <p className="text-sm text-foreground leading-relaxed bg-muted/30 rounded-lg p-3">{data.notesAr}</p>
                          </div>
                        )}
                        {data.notes && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">English:</p>
                            <p className="text-sm text-foreground leading-relaxed bg-muted/30 rounded-lg p-3" dir="ltr">{data.notes}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* ═══ Section 4: Photos ═══ */}
                {data.photos && data.photos.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-lg bg-orange-500/10 flex items-center justify-center">
                        <ImageIcon className="h-4 w-4 text-orange-600" />
                      </div>
                      <h3 className="font-bold text-sm">الصور / Photos ({data.photos.length})</h3>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                      {data.photos.map((photo: any, i: number) => {
                        const imgUrl = normalizeImageUrl(photo.thumbnailUrl || photo.url);
                        const fullUrl = normalizeImageUrl(photo.url);
                        return (
                          <button
                            key={i}
                            onClick={() => setSelectedPhoto(fullUrl)}
                            className="aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-[#3ECFC0] transition-all hover:shadow-md"
                          >
                            <img
                              loading="lazy"
                              src={imgUrl}
                              alt={`صورة ${i + 1}`}
                              className="w-full h-full object-cover"
                              onError={(e) => { (e.currentTarget as HTMLImageElement).src = BROKEN_IMAGE_PLACEHOLDER; }}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ═══ Section 5: Internal Notes (Admin) ═══ */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
                        <StickyNote className="h-4 w-4 text-amber-600" />
                      </div>
                      <h3 className="font-bold text-sm">ملاحظات داخلية / Internal Notes</h3>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleSaveNotes}
                      disabled={savingNotes}
                      className="text-xs h-7"
                    >
                      {savingNotes ? <Loader2 className="h-3 w-3 animate-spin me-1" /> : <Save className="h-3 w-3 me-1" />}
                      حفظ الملاحظات
                    </Button>
                  </div>
                  <Textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="أضف ملاحظات داخلية عن هذا الطلب... (لن تظهر للمالك)"
                    rows={4}
                    className="resize-none"
                  />
                </div>

                {/* ═══ Section 6: Timeline / Meta ═══ */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground bg-muted/30 rounded-lg px-4 py-3">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    تاريخ الإنشاء: {new Date(data.createdAt).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {data.updatedAt && data.updatedAt !== data.createdAt && (
                    <span className="flex items-center gap-1">
                      <RefreshCw className="h-3 w-3" />
                      آخر تحديث: {new Date(data.updatedAt).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                  {data.source && (
                    <span>المصدر: {data.source === "web" ? "الموقع الإلكتروني" : data.source}</span>
                  )}
                </div>
              </div>
            ) : null}
          </ScrollArea>

          {/* ═══ Footer Actions ═══ */}
          {data && (
            <div className="flex-shrink-0">
              <Separator />
              <div className="px-6 py-4 flex flex-wrap items-center gap-2 bg-muted/20">
                {/* Status Actions */}
                <span className="text-xs text-muted-foreground me-1">تحديث الحالة:</span>
                <Button
                  size="sm"
                  variant={data.status === "new" ? "default" : "outline"}
                  onClick={() => handleStatusChange("new")}
                  disabled={updating || data.status === "new"}
                  className={`text-xs h-8 ${data.status === "new" ? "bg-blue-500 hover:bg-blue-600 text-white" : ""}`}
                >
                  <Clock className="h-3 w-3 me-1" /> جديد
                </Button>
                <Button
                  size="sm"
                  variant={data.status === "contacted" ? "default" : "outline"}
                  onClick={() => handleStatusChange("contacted")}
                  disabled={updating || data.status === "contacted"}
                  className={`text-xs h-8 ${data.status === "contacted" ? "bg-amber-500 hover:bg-amber-600 text-white" : ""}`}
                >
                  <MessageSquare className="h-3 w-3 me-1" /> تم التواصل
                </Button>
                <Button
                  size="sm"
                  variant={data.status === "approved" ? "default" : "outline"}
                  onClick={() => handleStatusChange("approved")}
                  disabled={updating || data.status === "approved"}
                  className={`text-xs h-8 ${data.status === "approved" ? "bg-emerald-500 hover:bg-emerald-600 text-white" : ""}`}
                >
                  <CheckCircle className="h-3 w-3 me-1" /> قبول
                </Button>
                <Button
                  size="sm"
                  variant={data.status === "rejected" ? "default" : "outline"}
                  onClick={() => handleStatusChange("rejected")}
                  disabled={updating || data.status === "rejected"}
                  className={`text-xs h-8 ${data.status === "rejected" ? "bg-red-500 hover:bg-red-600 text-white" : ""}`}
                >
                  <XCircle className="h-3 w-3 me-1" /> رفض
                </Button>

                <div className="flex-1" />

                {/* Convert + WhatsApp */}
                <SendWhatsAppDialog
                  trigger={
                    <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50 dark:hover:bg-green-950/20 text-xs h-8">
                      <MessageCircleWA className="h-3.5 w-3.5 me-1" /> واتساب
                    </Button>
                  }
                  defaultPhone={data.phone || ""}
                  defaultName={data.ownerNameAr || data.ownerName || ""}
                />
                {!data.convertedPropertyId && (
                  <Button
                    size="sm"
                    className="bg-[#3ECFC0] text-[#0B1E2D] hover:bg-[#2ab5a6] text-xs h-8"
                    onClick={() => onConvert(data.id)}
                  >
                    <Building2 className="h-3.5 w-3.5 me-1" /> تحويل إلى عقار
                  </Button>
                )}
                {data.convertedPropertyId && (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-200 h-8 px-3">
                    <ArrowUpRight className="h-3 w-3 me-1" /> تم التحويل #{data.convertedPropertyId}
                  </Badge>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══ Photo Lightbox ═══ */}
      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="max-w-4xl p-2 bg-black/95">
          <DialogHeader className="sr-only">
            <DialogTitle>عرض الصورة</DialogTitle>
            <DialogDescription>عرض الصورة بالحجم الكامل</DialogDescription>
          </DialogHeader>
          {selectedPhoto && (
            <img
              src={selectedPhoto}
              alt="صورة العقار"
              className="w-full h-auto max-h-[85vh] object-contain rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Convert Dialog ─────────────────────────────────────────────────
function ConvertDialog({ submissionId, open, onClose, onSuccess }: {
  submissionId: number; open: boolean; onClose: () => void; onSuccess: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    titleEn: "", titleAr: "", descriptionEn: "", descriptionAr: "",
    monthlyRent: "", status: "draft" as "draft" | "pending",
  });

  const { data } = trpc.submission.getById.useQuery({ id: submissionId }, { enabled: open });
  const convert = trpc.submission.convertToProperty.useMutation();

  // Pre-fill from submission
  const [prefilled, setPrefilled] = useState(false);
  if (data && !prefilled) {
    setForm({
      titleEn: `${data.propertyType || "Property"} in ${data.city || ""}`.trim(),
      titleAr: `${propertyTypeLabels[data.propertyType || ""] || "عقار"} في ${data.cityAr || ""}`.trim(),
      descriptionEn: data.notes || "",
      descriptionAr: data.notesAr || "",
      monthlyRent: String(data.desiredMonthlyRent || ""),
      status: "draft",
    });
    setPrefilled(true);
  }

  const handleConvert = async () => {
    if (!form.titleAr || !form.titleEn || !form.monthlyRent) {
      toast.error("يرجى ملء جميع الحقول المطلوبة");
      return;
    }
    setSaving(true);
    try {
      const result = await convert.mutateAsync({ submissionId, ...form });
      toast.success(`تم إنشاء العقار #${result.propertyId} بنجاح`);
      onSuccess();
    } catch (err: any) {
      toast.error(err?.message || "حدث خطأ");
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>تحويل الطلب إلى عقار</DialogTitle>
          <DialogDescription>سيتم إنشاء عقار جديد من بيانات هذا الطلب</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div><Label>العنوان (عربي) *</Label><Input value={form.titleAr} onChange={e => setForm(p => ({ ...p, titleAr: e.target.value }))} dir="rtl" /></div>
          <div><Label>Title (English) *</Label><Input value={form.titleEn} onChange={e => setForm(p => ({ ...p, titleEn: e.target.value }))} dir="ltr" /></div>
          <div><Label>الوصف (عربي)</Label><Textarea value={form.descriptionAr} onChange={e => setForm(p => ({ ...p, descriptionAr: e.target.value }))} rows={2} dir="rtl" /></div>
          <div><Label>Description</Label><Textarea value={form.descriptionEn} onChange={e => setForm(p => ({ ...p, descriptionEn: e.target.value }))} rows={2} dir="ltr" /></div>
          <div><Label>الإيجار الشهري (ر.س) *</Label><Input value={form.monthlyRent} onChange={e => setForm(p => ({ ...p, monthlyRent: e.target.value }))} /></div>
          <div>
            <Label>الحالة الأولية</Label>
            <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v as any }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">مسودة</SelectItem>
                <SelectItem value="pending">قيد المراجعة</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={handleConvert} disabled={saving} className="bg-[#3ECFC0] text-[#0B1E2D] hover:bg-[#2ab5a6]">
            {saving && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
            تحويل إلى عقار
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
