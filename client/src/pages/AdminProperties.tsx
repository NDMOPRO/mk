import { useState, useRef, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { normalizeImageUrl, handleImageError, BROKEN_IMAGE_PLACEHOLDER } from "@/lib/image-utils";
import { Link, useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Plus, Search, Loader2, ImagePlus, X, Eye, Pencil,
  Building2, MapPin, BedDouble, Bath, Ruler, ChevronLeft, ChevronRight,
  AlertTriangle, ImageOff, CheckCircle2, XCircle, Globe, ArrowLeft, ArrowRight,
  ExternalLink, Save
} from "lucide-react";

/* ─── Admin Thumbnail ───────────────────────────────────────────── */
function AdminPropertyThumbnail({ photos, propertyType, isAr = true }: { photos?: string[] | null; propertyType?: string; isAr?: boolean }) {
  const hasPhotos = Array.isArray(photos) && photos.length > 0;
  const primaryUrl = hasPhotos ? normalizeImageUrl(photos![0]) : null;
  const photoCount = hasPhotos ? photos!.length : 0;
  if (!primaryUrl) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted gap-1">
        <Building2 className="h-6 w-6 text-muted-foreground/40" />
        <span className="text-[10px] text-muted-foreground/60">{isAr ? "لا توجد صور" : "No photos"}</span>
      </div>
    );
  }
  return (
    <>
      <img src={primaryUrl} alt="" loading="lazy"
        onError={(e) => { e.currentTarget.style.display = 'none'; const fb = e.currentTarget.nextElementSibling as HTMLElement | null; if (fb) fb.style.display = 'flex'; }}
        className="absolute inset-0 w-full h-full object-cover" />
      <div style={{ display: 'none' }} className="absolute inset-0 flex-col items-center justify-center bg-amber-950/30 gap-1 p-1">
        <ImageOff className="h-5 w-5 text-amber-400" />
        <span className="text-[9px] text-amber-300 text-center leading-tight">{photoCount} {isAr ? "صور موجودة - فشل التحميل" : "photos exist - load failed"}</span>
      </div>
      {photoCount > 1 && (
        <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded z-10">+{photoCount - 1}</div>
      )}
    </>
  );
}

/* ─── Constants ──────────────────────────────────────────────────── */
const statusColors: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
  published: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
  pending: "bg-amber-500/10 text-amber-600 border-amber-200",
  draft: "bg-slate-500/10 text-slate-600 border-slate-200",
  inactive: "bg-red-500/10 text-red-600 border-red-200",
  rejected: "bg-red-500/10 text-red-600 border-red-200",
};
const statusLabelsAr: Record<string, string> = {
  active: "نشط", published: "منشور", pending: "قيد المراجعة", draft: "مسودة", inactive: "غير نشط", rejected: "مرفوض",
};
const statusLabelsEn: Record<string, string> = {
  active: "Active", published: "Published", pending: "Pending", draft: "Draft", inactive: "Inactive", rejected: "Rejected",
};
const propertyTypeLabelsAr: Record<string, string> = {
  apartment: "شقة", villa: "فيلا", studio: "استوديو", duplex: "دوبلكس",
  furnished_room: "غرفة مفروشة", compound: "مجمع سكني", hotel_apartment: "شقة فندقية",
};
const propertyTypeLabelsEn: Record<string, string> = {
  apartment: "Apartment", villa: "Villa", studio: "Studio", duplex: "Duplex",
  furnished_room: "Furnished Room", compound: "Compound", hotel_apartment: "Hotel Apartment",
};

/* ─── Wizard Steps ───────────────────────────────────────────────── */
const WIZARD_STEPS_AR = [
  { id: 1, label: "المعلومات الأساسية", icon: "📝" },
  { id: 2, label: "الموقع", icon: "📍" },
  { id: 3, label: "المواصفات والتسعير", icon: "💰" },
  { id: 4, label: "الصور", icon: "📸" },
  { id: 5, label: "المراجعة والنشر", icon: "🚀" },
];
const WIZARD_STEPS_EN = [
  { id: 1, label: "Basic Info", icon: "📝" },
  { id: 2, label: "Location", icon: "📍" },
  { id: 3, label: "Specs & Pricing", icon: "💰" },
  { id: 4, label: "Photos", icon: "📸" },
  { id: 5, label: "Review & Publish", icon: "🚀" },
];

/* ═══════════════════════════════════════════════════════════════════
   Main Admin Properties Page
   ═══════════════════════════════════════════════════════════════════ */
export default function AdminProperties() {
  const { lang, dir } = useI18n();
  const isAr = lang === "ar";
  const statusLabels = isAr ? statusLabelsAr : statusLabelsEn;
  const propertyTypeLabels = isAr ? propertyTypeLabelsAr : propertyTypeLabelsEn;
  const WIZARD_STEPS = isAr ? WIZARD_STEPS_AR : WIZARD_STEPS_EN;
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [showWizard, setShowWizard] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  const { data, isLoading, refetch } = trpc.admin.properties.useQuery({
    limit: 20, offset: page * 20, status: statusFilter !== "all" ? statusFilter : undefined, search: search || undefined,
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{isAr ? "إدارة العقارات" : "Property Management"}</h1>
            <p className="text-muted-foreground text-sm mt-1">{isAr ? "إنشاء وتعديل وإدارة العقارات" : "Create, edit and manage properties"}</p>
          </div>
          <Button onClick={() => { setEditId(null); setShowWizard(true); }} className="bg-[#3ECFC0] text-[#0B1E2D] hover:bg-[#2ab5a6]">
            <Plus className="h-4 w-4 me-2" /> {isAr ? isAr ? "إضافة عقار جديد" : "Add New Property" : "Add New Property"}
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder={isAr ? "بحث بالعنوان أو المدينة..." : "Search by title or city..."} value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="ps-9" />
          </div>
          <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder={isAr ? "الحالة" : "Status"} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isAr ? "جميع الحالات" : "All Statuses"}</SelectItem>
              <SelectItem value="active">{statusLabels.active}</SelectItem>
              <SelectItem value="published">{statusLabels.published}</SelectItem>
              <SelectItem value="pending">{statusLabels.pending}</SelectItem>
              <SelectItem value="draft">{statusLabels.draft}</SelectItem>
              <SelectItem value="inactive">{statusLabels.inactive}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Properties List */}
        {isLoading ? (
          <div className="grid gap-4">{[1,2,3].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
        ) : !data?.items?.length ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <p className="text-muted-foreground">{isAr ? "لا توجد عقارات" : "No properties"}</p>
              <Button variant="outline" className="mt-4" onClick={() => { setEditId(null); setShowWizard(true); }}>
                <Plus className="h-4 w-4 me-2" /> {isAr ? "إضافة عقار" : "Add Property"}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {data.items.map((prop: any) => (
              <Card key={prop.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    <div className="w-28 h-28 rounded-lg bg-muted overflow-hidden shrink-0 relative border border-border">
                      <AdminPropertyThumbnail photos={prop.photos} propertyType={prop.propertyType} isAr={isAr} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold truncate">{prop.titleAr || prop.titleEn}</h3>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <MapPin className="h-3.5 w-3.5" />
                            <span>{prop.cityAr || prop.city || "—"} - {prop.districtAr || prop.district || "—"}</span>
                          </div>
                        </div>
                        <Badge variant="outline" className={statusColors[prop.status] || ""}>
                          {statusLabels[prop.status] || prop.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1"><BedDouble className="h-3.5 w-3.5" /> {prop.bedrooms}</span>
                        <span className="flex items-center gap-1"><Bath className="h-3.5 w-3.5" /> {prop.bathrooms}</span>
                        <span className="flex items-center gap-1"><Ruler className="h-3.5 w-3.5" /> {prop.sizeSqm} m²</span>
                        <span className="font-medium text-foreground">{prop.monthlyRent} {isAr ? "ر.س/شهر" : "SAR/mo"}</span>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Button size="sm" variant="outline" onClick={() => window.open(`/property/${prop.id}`, "_blank")}>
                          <Eye className="h-3.5 w-3.5 me-1" /> {isAr ? "عرض" : "View"}
                        </Button>
                        <Link href={`/admin/properties/${prop.id}/edit`}>
                          <Button size="sm" variant="outline">
                            <Pencil className="h-3.5 w-3.5 me-1" /> {isAr ? "تعديل" : "Edit"}
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination */}
        {data && data.total > 20 && (
          <div className="flex items-center justify-center gap-2">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              <ChevronRight className="h-4 w-4" /> {isAr ? "السابق" : "Previous"}
            </Button>
            <span className="text-sm text-muted-foreground">{isAr ? "صفحة " : "Page "}{page + 1}{isAr ? " من " : " of "}{Math.ceil(data.total / 20)}</span>
            <Button size="sm" variant="outline" disabled={(page + 1) * 20 >= data.total} onClick={() => setPage(p => p + 1)}>
              {isAr ? "التالي" : "Next"} <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Wizard Dialog */}
        <PropertyWizard
          open={showWizard}
          onClose={() => { setShowWizard(false); setEditId(null); }}
          editId={editId}
          onSuccess={() => { refetch(); setShowWizard(false); setEditId(null); }}
        />
      </div>
    </DashboardLayout>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Unified Create + Publish Wizard
   ═══════════════════════════════════════════════════════════════════ */
function PropertyWizard({ open, onClose, editId, onSuccess }: {
  open: boolean; onClose: () => void; editId: number | null; onSuccess: () => void;
}) {
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const propertyTypeLabels = isAr ? propertyTypeLabelsAr : propertyTypeLabelsEn;
  const WIZARD_STEPS = isAr ? WIZARD_STEPS_AR : WIZARD_STEPS_EN;
  const [, navigate] = useLocation();
  const isEdit = editId !== null;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [createdId, setCreatedId] = useState<number | null>(editId);

  const [form, setForm] = useState({
    titleEn: "", titleAr: "", descriptionEn: "", descriptionAr: "",
    propertyType: "apartment" as const,
    city: "", cityAr: "", district: "", districtAr: "",
    address: "", addressAr: "",
    latitude: "", longitude: "", googleMapsUrl: "",
    bedrooms: 1, bathrooms: 1, sizeSqm: 0,
    floor: 0, totalFloors: 0, yearBuilt: 2024,
    furnishedLevel: "unfurnished" as "unfurnished" | "semi_furnished" | "fully_furnished",
    monthlyRent: "", securityDeposit: "",
    minStayMonths: 1, maxStayMonths: 12,
    instantBook: false,
    photos: [] as string[],
  });

  // Load property data for edit
  const { data: editData } = trpc.submission.adminGetProperty.useQuery(
    { id: editId! },
    { enabled: isEdit && open }
  );

  // Populate form when edit data loads
  const [populated, setPopulated] = useState(false);
  useEffect(() => {
    if (isEdit && editData && !populated) {
      setForm({
        titleEn: editData.titleEn || "", titleAr: editData.titleAr || "",
        descriptionEn: editData.descriptionEn || "", descriptionAr: editData.descriptionAr || "",
        propertyType: editData.propertyType || "apartment",
        city: editData.city || "", cityAr: editData.cityAr || "",
        district: editData.district || "", districtAr: editData.districtAr || "",
        address: editData.address || "", addressAr: editData.addressAr || "",
        latitude: editData.latitude || "", longitude: editData.longitude || "",
        googleMapsUrl: (editData as any).googleMapsUrl || "",
        bedrooms: editData.bedrooms || 1, bathrooms: editData.bathrooms || 1,
        sizeSqm: editData.sizeSqm || 0,
        floor: editData.floor || 0, totalFloors: editData.totalFloors || 0,
        yearBuilt: editData.yearBuilt || 2024,
        furnishedLevel: editData.furnishedLevel || "unfurnished",
        monthlyRent: editData.monthlyRent || "", securityDeposit: editData.securityDeposit || "",
        minStayMonths: editData.minStayMonths || 1, maxStayMonths: editData.maxStayMonths || 12,
        instantBook: editData.instantBook || false,
        photos: editData.photos || [],
      });
      setCreatedId(editId);
      setPopulated(true);
    }
  }, [isEdit, editData, populated, editId]);

  // Readiness check (only after property is created)
  const { data: readiness, refetch: refetchReadiness } = trpc.admin.publishReadiness.useQuery(
    { id: createdId! },
    { enabled: !!createdId && step === 5 }
  );

  const uploadPhoto = trpc.submission.adminUploadPropertyPhoto.useMutation();
  const createProperty = trpc.submission.adminCreateProperty.useMutation();
  const updateProperty = trpc.submission.adminUpdateProperty.useMutation();
  const publishMutation = trpc.admin.publishProperty.useMutation();

  /* ─── Photo Upload ──────────────────────────────────────────────── */
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(",")[1]);
          reader.readAsDataURL(file);
        });
        const result = await uploadPhoto.mutateAsync({ base64, filename: file.name, contentType: file.type });
        setForm(prev => ({ ...prev, photos: [...prev.photos, result.url] }));
      }
    toast.success(isAr ? "تم رفع الصور بنجاح" : "Photos uploaded successfully");   } catch {
    toast.error(isAr ? "فشل رفع الصورة" : "Photo upload failed");   }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePhoto = (index: number) => {
    setForm(prev => ({ ...prev, photos: prev.photos.filter((_, i) => i !== index) }));
  };

  /* ─── Save / Create ─────────────────────────────────────────────── */
  const saveStep = async (): Promise<boolean> => {
    setSaving(true);
    try {
      if (!createdId) {
        // First save — create property as draft
        if (!form.titleAr && !form.titleEn) {
          toast.error(isAr ? "يرجى إدخال العنوان" : "Title is required");       setSaving(false);
          return false;
        }
        if (!form.monthlyRent || Number(form.monthlyRent) <= 0) {
          // Allow creating without rent on step 1, set a placeholder
          // Rent will be required before publish
        }
        const result = await createProperty.mutateAsync({
          ...form,
          titleEn: form.titleEn || form.titleAr,
          titleAr: form.titleAr || form.titleEn,
          monthlyRent: String(Number(form.monthlyRent) || 0),
        });
        setCreatedId(result.id);
        toast.success(isAr ? `تم إنشاء العقار #${result.id} كمسودة` : `Property #${result.id} created as draft`);
      } else {
        // Update existing property
        const clean: Record<string, any> = { id: createdId, ...form };
        // Ensure numeric fields are properly formatted
        clean.monthlyRent = String(Number(clean.monthlyRent) || 0);
        clean.securityDeposit = String(Number(clean.securityDeposit) || 0);
        // Sanitize empty strings to undefined for optional fields
        const optionalFields = ['latitude', 'longitude', 'googleMapsUrl'];
        for (const k of optionalFields) {
          if (clean[k] === '') clean[k] = undefined;
        }
        await updateProperty.mutateAsync(clean as any);
     toast.success(isAr ? "تم حفظ التعديلات" : "Changes saved");      }
      setSaving(false);
      return true;
    } catch (err: any) {
      toast.error(err?.message || (isAr ? "حدث خطأ أثناء الحفظ" : "Error saving"));   setSaving(false);
      return false;
    }
  };

  /* ─── Navigation ────────────────────────────────────────────────── */
  const goNext = async () => {
    // Validate current step
    if (step === 1) {
      if (!form.titleAr && !form.titleEn) {
        toast.error(isAr ? "يرجى إدخال العنوان" : "Title is required");
        return;
      }
    }
    // Save before advancing
    const ok = await saveStep();
    if (!ok) return;
    if (step < 5) {
      setStep(step + 1);
      if (step + 1 === 5) {
        // Refresh readiness when entering review step
        setTimeout(() => refetchReadiness(), 300);
      }
    }
  };

  const goBack = () => {
    if (step > 1) setStep(step - 1);
  };

  /* ─── Publish ───────────────────────────────────────────────────── */
  const handlePublish = async () => {
    if (!createdId) return;
    // Save latest changes first
    const ok = await saveStep();
    if (!ok) return;
    setPublishing(true);
    try {
      await publishMutation.mutateAsync({ id: createdId });
   toast.success(isAr ? "تم نشر العقار بنجاح على الموقع!" : "Property published successfully!");      onSuccess();
      resetWizard();
    } catch (err: any) {
  toast.error(err?.message || (isAr ? "فشل النشر" : "Publish failed"));
    }
    setPublishing(false);
  };

  /* ─── Reset ─────────────────────────────────────────────────────── */
  const resetWizard = () => {
    setStep(1);
    setCreatedId(null);
    setPopulated(false);
    setForm({
      titleEn: "", titleAr: "", descriptionEn: "", descriptionAr: "",
      propertyType: "apartment", city: "", cityAr: "", district: "", districtAr: "",
      address: "", addressAr: "", latitude: "", longitude: "", googleMapsUrl: "",
      bedrooms: 1, bathrooms: 1, sizeSqm: 0, floor: 0, totalFloors: 0, yearBuilt: 2024,
      furnishedLevel: "unfurnished", monthlyRent: "", securityDeposit: "",
      minStayMonths: 1, maxStayMonths: 12, instantBook: false, photos: [],
    });
  };

  const handleClose = () => {
    resetWizard();
    onClose();
  };

  /* ─── Render ────────────────────────────────────────────────────── */
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
        {/* Wizard Header */}
        <div className="sticky top-0 z-10 bg-background border-b px-6 pt-6 pb-4">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl">
              {isEdit ? (isAr ? "تعديل العقار" : "Edit Property") : createdId ? (isAr ? `تعديل العقار #${createdId}` : `Edit Property #${createdId}`) : (isAr ? "إضافة عقار جديد" : "Add New Property")}
            </DialogTitle>
            <DialogDescription>
              {WIZARD_STEPS[step - 1].label} — {isAr ? `الخطوة ${step} من ${WIZARD_STEPS.length}` : `Step ${step} of ${WIZARD_STEPS.length}`}
            </DialogDescription>
          </DialogHeader>

          {/* Step Progress */}
          <div className="flex items-center gap-1">
            {WIZARD_STEPS.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  // Only allow going back to previous steps or current
                  if (s.id <= step || (createdId && s.id <= step + 1)) {
                    if (s.id < step) setStep(s.id);
                  }
                }}
                className={`flex-1 flex flex-col items-center gap-1 py-2 px-1 rounded-lg transition-all text-xs
                  ${s.id === step ? 'bg-[#3ECFC0]/10 text-[#3ECFC0] font-semibold' : ''}
                  ${s.id < step ? 'text-green-600 cursor-pointer hover:bg-green-50' : ''}
                  ${s.id > step ? 'text-muted-foreground/50' : ''}
                `}
              >
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm
                  ${s.id === step ? 'bg-[#3ECFC0] text-[#0B1E2D]' : ''}
                  ${s.id < step ? 'bg-green-500 text-white' : ''}
                  ${s.id > step ? 'bg-muted text-muted-foreground' : ''}
                `}>
                  {s.id < step ? <CheckCircle2 className="h-4 w-4" /> : s.id}
                </span>
                <span className="hidden sm:block">{s.label}</span>
              </button>
            ))}
          </div>
          <Progress value={(step / WIZARD_STEPS.length) * 100} className="mt-3 h-1.5" />
        </div>

        {/* Step Content */}
        <div className="px-6 py-6 min-h-[350px]">
          {/* Step 1: Basic Info */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">{isAr ? "العنوان (عربي)" : "Title (Arabic)"} <span className="text-red-500">*</span></Label>
                  <Input value={form.titleAr} onChange={e => setForm(p => ({ ...p, titleAr: e.target.value }))} placeholder={isAr ? "شقة فاخرة في حي العليا..." : "Luxury apartment in Al Olaya..."} dir="rtl" className="mt-1" />
                </div>
                <div>
                  <Label className="text-sm font-medium">Title (English)</Label>
                  <Input value={form.titleEn} onChange={e => setForm(p => ({ ...p, titleEn: e.target.value }))} placeholder="Luxury apartment in Al Olaya..." dir="ltr" className="mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">{isAr ? "الوصف (عربي)" : "Description (Arabic)"}</Label>
                  <Textarea value={form.descriptionAr} onChange={e => setForm(p => ({ ...p, descriptionAr: e.target.value }))} rows={4} dir="rtl" className="mt-1" />
                </div>
                <div>
                  <Label className="text-sm font-medium">Description (English)</Label>
                  <Textarea value={form.descriptionEn} onChange={e => setForm(p => ({ ...p, descriptionEn: e.target.value }))} rows={4} dir="ltr" className="mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">{isAr ? "نوع العقار" : "Property Type"}</Label>
                  <Select value={form.propertyType} onValueChange={v => setForm(p => ({ ...p, propertyType: v as any }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(propertyTypeLabels).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium">{isAr ? "التأثيث" : "Furnishing"}</Label>
                  <Select value={form.furnishedLevel} onValueChange={v => setForm(p => ({ ...p, furnishedLevel: v as any }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unfurnished">{isAr ? "غير مفروش" : "Unfurnished"}</SelectItem>
                      <SelectItem value="semi_furnished">{isAr ? "مفروش جزئياً" : "Semi Furnished"}</SelectItem>
                      <SelectItem value="fully_furnished">{isAr ? "مفروش بالكامل" : "Fully Furnished"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Location */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">{isAr ? "المدينة (عربي)" : "City (Arabic)"}</Label>
                  <Input value={form.cityAr} onChange={e => setForm(p => ({ ...p, cityAr: e.target.value }))} dir="rtl" className="mt-1" placeholder={isAr ? "الرياض" : "Riyadh"} />
                </div>
                <div>
                  <Label className="text-sm font-medium">City (English)</Label>
                  <Input value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} dir="ltr" className="mt-1" placeholder="Riyadh" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">{isAr ? "الحي (عربي)" : "District (Arabic)"}</Label>
                  <Input value={form.districtAr} onChange={e => setForm(p => ({ ...p, districtAr: e.target.value }))} dir="rtl" className="mt-1" placeholder={isAr ? "حي العليا" : "Al Olaya"} />
                </div>
                <div>
                  <Label className="text-sm font-medium">District (English)</Label>
                  <Input value={form.district} onChange={e => setForm(p => ({ ...p, district: e.target.value }))} dir="ltr" className="mt-1" placeholder="Al Olaya" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">{isAr ? "العنوان التفصيلي (عربي)" : "Detailed Address (Arabic)"}</Label>
                  <Input value={form.addressAr} onChange={e => setForm(p => ({ ...p, addressAr: e.target.value }))} dir="rtl" className="mt-1" />
                </div>
                <div>
                  <Label className="text-sm font-medium">Address (English)</Label>
                  <Input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} dir="ltr" className="mt-1" />
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium">{isAr ? "رابط Google Maps" : "Google Maps Link"}</Label>
                <Input value={form.googleMapsUrl} onChange={e => setForm(p => ({ ...p, googleMapsUrl: e.target.value }))} dir="ltr" className="mt-1" placeholder="https://maps.google.com/..." />
                <p className="text-[11px] text-muted-foreground mt-1">{isAr ? "الصق رابط الموقع من Google Maps — سيتم استخراج الإحداثيات تلقائياً" : "Paste Google Maps link — coordinates will be extracted automatically"}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">{isAr ? "خط العرض" : "Latitude"}</Label>
                  <Input value={form.latitude} onChange={e => setForm(p => ({ ...p, latitude: e.target.value }))} dir="ltr" className="mt-1" placeholder="24.7136" />
                </div>
                <div>
                  <Label className="text-sm font-medium">{isAr ? "خط الطول" : "Longitude"}</Label>
                  <Input value={form.longitude} onChange={e => setForm(p => ({ ...p, longitude: e.target.value }))} dir="ltr" className="mt-1" placeholder="46.6753" />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Specs & Pricing */}
          {step === 3 && (
            <div className="space-y-5">
              <h3 className="font-semibold text-sm text-muted-foreground border-b pb-2">{isAr ? "المواصفات" : "Specifications"}</h3>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <Label className="text-sm font-medium">{isAr ? "غرف النوم" : "Bedrooms"}</Label>
                  <Input type="number" value={form.bedrooms} onChange={e => setForm(p => ({ ...p, bedrooms: +e.target.value }))} min={0} className="mt-1" />
                </div>
                <div>
                  <Label className="text-sm font-medium">{isAr ? "الحمامات" : "Bathrooms"}</Label>
                  <Input type="number" value={form.bathrooms} onChange={e => setForm(p => ({ ...p, bathrooms: +e.target.value }))} min={0} className="mt-1" />
                </div>
                <div>
                  <Label className="text-sm font-medium">{isAr ? "المساحة (م²)" : "Size (m²)"}</Label>
                  <Input type="number" value={form.sizeSqm} onChange={e => setForm(p => ({ ...p, sizeSqm: +e.target.value }))} min={0} className="mt-1" />
                </div>
                <div>
                  <Label className="text-sm font-medium">{isAr ? "سنة البناء" : "Year Built"}</Label>
                  <Input type="number" value={form.yearBuilt} onChange={e => setForm(p => ({ ...p, yearBuilt: +e.target.value }))} className="mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">{isAr ? "الطابق" : "Floor"}</Label>
                  <Input type="number" value={form.floor} onChange={e => setForm(p => ({ ...p, floor: +e.target.value }))} min={0} className="mt-1" />
                </div>
                <div>
                  <Label className="text-sm font-medium">{isAr ? "عدد الطوابق" : "Total Floors"}</Label>
                  <Input type="number" value={form.totalFloors} onChange={e => setForm(p => ({ ...p, totalFloors: +e.target.value }))} min={0} className="mt-1" />
                </div>
              </div>

              <h3 className="font-semibold text-sm text-muted-foreground border-b pb-2 mt-6">{isAr ? "التسعير" : "Pricing"}</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">{isAr ? "الإيجار الشهري (ر.س)" : "Monthly Rent (SAR)"} <span className="text-red-500">*</span></Label>
                  <Input
                    value={form.monthlyRent}
                    onChange={e => setForm(p => ({ ...p, monthlyRent: e.target.value }))}
                    placeholder="3000"
                    type="number"
                    min="1"
                    className={`mt-1 ${!form.monthlyRent || Number(form.monthlyRent) <= 0 ? 'border-amber-500 focus-visible:ring-amber-500' : ''}`}
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">{isAr ? "مطلوب للنشر والدفع" : "Required for publishing and payment"}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">{isAr ? "مبلغ التأمين (ر.س)" : "Security Deposit (SAR)"}</Label>
                  <Input value={form.securityDeposit} onChange={e => setForm(p => ({ ...p, securityDeposit: e.target.value }))} placeholder="3000" type="number" className="mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">{isAr ? "الحد الأدنى للإقامة (أشهر)" : "Min Stay (months)"}</Label>
                  <Input type="number" value={form.minStayMonths} onChange={e => setForm(p => ({ ...p, minStayMonths: +e.target.value }))} min={1} className="mt-1" />
                </div>
                <div>
                  <Label className="text-sm font-medium">{isAr ? "الحد الأقصى للإقامة (أشهر)" : "Max Stay (months)"}</Label>
                  <Input type="number" value={form.maxStayMonths} onChange={e => setForm(p => ({ ...p, maxStayMonths: +e.target.value }))} min={1} className="mt-1" />
                </div>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <Switch checked={form.instantBook} onCheckedChange={v => setForm(p => ({ ...p, instantBook: v }))} />
                <Label className="text-sm font-medium">{isAr ? "حجز فوري (بدون موافقة مسبقة)" : "Instant Book (no approval needed)"}</Label>
              </div>
            </div>
          )}

          {/* Step 4: Photos */}
          {step === 4 && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{isAr ? "صور العقار" : "Property Photos"}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                  {form.photos.length === 0 ? (isAr ? "لم يتم رفع أي صور بعد" : "No photos uploaded yet") : `${form.photos.length} ${isAr ? "صورة" : "photo(s)"}`}                 </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="gap-2"
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
              {uploading ? (isAr ? "جاري الرفع..." : "Uploading...") : (isAr ? "رفع صور" : "Upload Photos")}
                </Button>
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
              </div>

              {form.photos.length === 0 ? (
                <div className="border-2 border-dashed rounded-xl p-12 text-center">
                  <ImagePlus className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground">{isAr ? 'اضغط "رفع صور" أو اسحب الصور هنا' : "Click Upload or drag photos here"}</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">{isAr ? "يُنصح برفع 3 صور على الأقل" : "At least 3 photos recommended"}</p>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-3">
                  {form.photos.map((url, i) => (
                    <div key={i} className="relative aspect-square rounded-lg overflow-hidden border group">
                      <img loading="lazy" src={normalizeImageUrl(url)} alt="" className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).src = BROKEN_IMAGE_PLACEHOLDER; }} />
                      <button
                        onClick={() => removePhoto(i)}
                        className="absolute top-2 end-2 bg-black/60 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                      {i === 0 && (
                        <div className="absolute bottom-0 inset-x-0 bg-[#3ECFC0]/90 text-[#0B1E2D] text-xs text-center py-1 font-medium">
                          {isAr ? "صورة الغلاف" : "Cover"}
                        </div>
                      )}
                    </div>
                  ))}
                  {/* Upload more button */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center text-muted-foreground hover:border-[#3ECFC0] hover:text-[#3ECFC0] transition-colors"
                  >
                    {uploading ? <Loader2 className="h-8 w-8 animate-spin" /> : <Plus className="h-8 w-8" />}
                    <span className="text-xs mt-1">{uploading ? isAr ? "جاري..." : "..." : isAr ? "إضافة" : "Add"}</span>
                  </button>
                </div>
              )}

              {form.photos.length > 0 && form.photos.length < 3 && (
                <div className="flex items-center gap-2 text-amber-600 bg-amber-50 rounded-lg p-3 text-sm">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{isAr ? "يُنصح برفع 3 صور على الأقل لتحسين ظهور العقار" : "At least 3 photos recommended for better visibility"}</span>
                </div>
              )}
            </div>
          )}

          {/* Step 5: Review & Publish */}
          {step === 5 && (
            <div className="space-y-6">
              {/* Summary */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{isAr ? "ملخص العقار" : "Property Summary"}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">{isAr ? "العنوان:" : "Title:"}</span><span className="font-medium">{form.titleAr || form.titleEn || "—"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">{isAr ? "النوع:" : "Type:"}</span><span className="font-medium">{propertyTypeLabels[form.propertyType] || form.propertyType}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">{isAr ? "المدينة:" : "City:"}</span><span className="font-medium">{form.cityAr || form.city || "—"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">{isAr ? "الحي:" : "District:"}</span><span className="font-medium">{form.districtAr || form.district || "—"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">{isAr ? "الإيجار:" : "Rent:"}</span><span className="font-medium text-[#3ECFC0]">{form.monthlyRent || "0"} ر.س/شهر</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">{isAr ? "الصور:" : "Photos:"}</span><span className="font-medium">{form.photos.length} صورة</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">{isAr ? "غرف النوم:" : "Bedrooms:"}</span><span className="font-medium">{form.bedrooms}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">{isAr ? "الحمامات:" : "Bathrooms:"}</span><span className="font-medium">{form.bathrooms}</span></div>
                  </div>
                </CardContent>
              </Card>

              {/* Readiness Checks */}
              {readiness && (
                <Card className={readiness.ready ? "border-green-200 bg-green-50/30" : "border-amber-200 bg-amber-50/30"}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      {readiness.ready ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                      )}
                      {isAr ? "جاهزية النشر" : "Publish Readiness"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {readiness.checks.map((check: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          {check.passed ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                          )}
                          <span>{check.labelAr}</span>
                          {check.detail && (
                            <span className="text-xs text-muted-foreground mr-auto">{check.detail}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Actions */}
              <div className="flex flex-col gap-3">
                <Button
                  className="w-full bg-[#3ECFC0] text-[#0B1E2D] hover:bg-[#2ab5a6] h-12 text-base"
                  onClick={handlePublish}
                  disabled={publishing || !readiness?.ready}
                >
                  {publishing ? <Loader2 className="h-5 w-5 animate-spin ml-2" /> : <Globe className="h-5 w-5 ml-2" />}
                  {isAr ? "نشر العقار على الموقع" : "Publish Property"}
                </Button>

                {!readiness?.ready && (
                  <p className="text-sm text-amber-600 text-center">
                    {isAr ? "يرجى استكمال جميع المتطلبات أعلاه قبل النشر" : "Please complete all requirements above before publishing"}
                  </p>
                )}

                {createdId && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        handleClose();
                        navigate(`/admin/properties/${createdId}/edit`);
                      }}
                    >
                      <ExternalLink className="h-4 w-4 ml-1" />
                      {isAr ? "فتح المحرر المتقدم" : "Open Advanced Editor"}
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        onSuccess();
                        resetWizard();
                      }}
                    >
                      <Save className="h-4 w-4 ml-1" />
                      {isAr ? "حفظ كمسودة والإغلاق" : "Save as Draft & Close"}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="sticky bottom-0 bg-background border-t px-6 py-4 flex items-center justify-between">
          <Button variant="outline" onClick={step === 1 ? handleClose : goBack} className="gap-2">
            {step === 1 ? (
              <>{isAr ? "إلغاء" : "Cancel"}</>
            ) : (
              <><ArrowRight className="h-4 w-4" /> {isAr ? "السابق" : "Previous"}</>
            )}
          </Button>

          <div className="flex items-center gap-2">
            {createdId && step < 5 && (
              <span className="text-xs text-muted-foreground">{isAr ? `العقار #${createdId}` : `Property #${createdId}`}</span>
            )}
          </div>

          {step < 5 ? (
            <Button onClick={goNext} disabled={saving} className="bg-[#3ECFC0] text-[#0B1E2D] hover:bg-[#2ab5a6] gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {step === 1 && !createdId ? isAr ? "إنشاء والمتابعة" : "Create & Continue" : isAr ? "حفظ والمتابعة" : "Save & Continue"}
              <ArrowLeft className="h-4 w-4" />
            </Button>
          ) : (
            <Button variant="outline" onClick={handleClose}>
              {isAr ? "إغلاق" : "Close"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
