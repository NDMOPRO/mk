import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useState } from "react";
import { Settings, Image, Save, Upload, MapPin, Building2, Eye, Trash2, Plus } from "lucide-react";

export function CitiesManagement({ lang, isRtl }: { lang: string; isRtl: boolean }) {
  const citiesQuery = trpc.cities.all.useQuery({ activeOnly: false });
  const toggleMutation = trpc.cities.toggle.useMutation({
    onSuccess: () => { toast.success(lang === "ar" ? "تم التحديث" : "Updated"); citiesQuery.refetch(); },
    onError: (err: any) => toast.error(err.message),
  });
  const createMutation = trpc.cities.create.useMutation({
    onSuccess: () => { toast.success(lang === "ar" ? "تمت الإضافة" : "City added"); citiesQuery.refetch(); setShowAdd(false); resetForm(); },
    onError: (err: any) => toast.error(err.message),
  });
  const updateMutation = trpc.cities.update.useMutation({
    onSuccess: () => { toast.success(lang === "ar" ? "تم التحديث" : "Updated"); citiesQuery.refetch(); setEditingId(null); },
    onError: (err: any) => toast.error(err.message),
  });
  const deleteMutation = trpc.cities.delete.useMutation({
    onSuccess: () => { toast.success(lang === "ar" ? "تم الحذف" : "Deleted"); citiesQuery.refetch(); },
    onError: (err: any) => toast.error(err.message),
  });
  const uploadPhotoMutation = trpc.cities.uploadPhoto.useMutation({
    onSuccess: (data: any) => {
      toast.success(lang === "ar" ? "تم رفع الصورة" : "Photo uploaded");
      setForm(prev => ({ ...prev, imageUrl: data.url }));
    },
    onError: (err: any) => toast.error(err.message),
  });

  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ nameEn: "", nameAr: "", region: "", regionAr: "", imageUrl: "", isActive: true, sortOrder: 0 });

  const resetForm = () => setForm({ nameEn: "", nameAr: "", region: "", regionAr: "", imageUrl: "", isActive: true, sortOrder: 0 });

  const startEdit = (city: any) => {
    setEditingId(city.id);
    setForm({
      nameEn: city.nameEn || "",
      nameAr: city.nameAr || "",
      region: city.region || "",
      regionAr: city.regionAr || "",
      imageUrl: city.imageUrl || "",
      isActive: city.isActive !== false,
      sortOrder: city.sortOrder || 0,
    });
  };

  const handlePhotoUpload = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        uploadPhotoMutation.mutate({ base64, filename: file.name, contentType: file.type });
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const cities = citiesQuery.data || [];
  const activeCount = cities.filter((c: any) => c.isActive !== false).length;
  const inactiveCount = cities.filter((c: any) => c.isActive === false).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {lang === "ar" ? "إدارة المدن" : "Cities Management"}
            <Badge variant="secondary">{cities.length}</Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="default" className="bg-green-600">{activeCount} {lang === "ar" ? "نشطة" : "Active"}</Badge>
            <Badge variant="outline" className="text-amber-600 border-amber-300">{inactiveCount} {lang === "ar" ? "قريباً" : "Coming Soon"}</Badge>
            <Button size="sm" onClick={() => { setShowAdd(true); resetForm(); }}>
              <Plus className="h-4 w-4 me-1" />
              {lang === "ar" ? "إضافة مدينة" : "Add City"}
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {lang === "ar"
            ? "المدن النشطة تظهر في البحث والصفحة الرئيسية. المدن غير النشطة تظهر كـ\"قريباً\"."
            : "Active cities appear in search and homepage. Inactive cities show as \"Coming Soon\"."}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add City Form */}
        {showAdd && (
          <div className="border rounded-lg p-4 bg-accent/30 space-y-3">
            <h4 className="font-semibold text-sm">{lang === "ar" ? "إضافة مدينة جديدة" : "Add New City"}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{lang === "ar" ? "الاسم (إنجليزي)" : "Name (English)"}</Label>
                <Input value={form.nameEn} onChange={e => setForm(p => ({ ...p, nameEn: e.target.value }))} placeholder="Riyadh" dir="ltr" />
              </div>
              <div>
                <Label className="text-xs">{lang === "ar" ? "الاسم (عربي)" : "Name (Arabic)"}</Label>
                <Input value={form.nameAr} onChange={e => setForm(p => ({ ...p, nameAr: e.target.value }))} placeholder="الرياض" dir="rtl" />
              </div>
              <div>
                <Label className="text-xs">{lang === "ar" ? "المنطقة (إنجليزي)" : "Region (English)"}</Label>
                <Input value={form.region} onChange={e => setForm(p => ({ ...p, region: e.target.value }))} placeholder="Riyadh" dir="ltr" />
              </div>
              <div>
                <Label className="text-xs">{lang === "ar" ? "المنطقة (عربي)" : "Region (Arabic)"}</Label>
                <Input value={form.regionAr} onChange={e => setForm(p => ({ ...p, regionAr: e.target.value }))} placeholder="منطقة الرياض" dir="rtl" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Checkbox checked={form.isActive} onCheckedChange={(v) => setForm(p => ({ ...p, isActive: !!v }))} />
                <Label className="text-xs">{lang === "ar" ? "نشطة (تظهر في البحث)" : "Active (visible in search)"}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs">{lang === "ar" ? "الترتيب" : "Sort"}</Label>
                <Input type="number" value={form.sortOrder} onChange={e => setForm(p => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))} className="w-20" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              {form.imageUrl && <img loading="lazy" src={form.imageUrl} alt="" className="h-12 w-16 object-cover rounded" />}
              <Button variant="outline" size="sm" onClick={handlePhotoUpload} disabled={uploadPhotoMutation.isPending}>
                <Upload className="h-3 w-3 me-1" />
                {lang === "ar" ? "رفع صورة" : "Upload Photo"}
              </Button>
              <Input value={form.imageUrl} onChange={e => setForm(p => ({ ...p, imageUrl: e.target.value }))} placeholder={lang === "ar" ? "أو أدخل رابط الصورة" : "Or enter image URL"} className="flex-1" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending || !form.nameEn || !form.nameAr}>
                <Save className="h-3 w-3 me-1" />
                {lang === "ar" ? "حفظ" : "Save"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowAdd(false)}>
                {lang === "ar" ? "إلغاء" : "Cancel"}
              </Button>
            </div>
          </div>
        )}

        {/* Cities Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-start p-2.5">#</th>
                <th className="text-start p-2.5">{lang === "ar" ? "الصورة" : "Image"}</th>
                <th className="text-start p-2.5">{lang === "ar" ? "الاسم (EN)" : "Name (EN)"}</th>
                <th className="text-start p-2.5">{lang === "ar" ? "الاسم (AR)" : "Name (AR)"}</th>
                <th className="text-start p-2.5">{lang === "ar" ? "المنطقة" : "Region"}</th>
                <th className="text-center p-2.5">{lang === "ar" ? "الحالة" : "Status"}</th>
                <th className="text-center p-2.5">{lang === "ar" ? "الترتيب" : "Sort"}</th>
                <th className="text-end p-2.5">{lang === "ar" ? "إجراءات" : "Actions"}</th>
              </tr>
            </thead>
            <tbody>
              {(cities as any[]).sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0)).map((city: any) => (
                <tr key={city.id} className="border-b last:border-0 hover:bg-accent/30 transition-colors">
                  <td className="p-2.5 text-muted-foreground">{city.id}</td>
                  <td className="p-2.5">
                    {city.imageUrl ? (
                      <img loading="lazy" src={city.imageUrl} alt="" className="h-8 w-12 object-cover rounded" />
                    ) : (
                      <div className="h-8 w-12 bg-muted rounded flex items-center justify-center">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                      </div>
                    )}
                  </td>
                  <td className="p-2.5 font-medium" dir="ltr">{city.nameEn}</td>
                  <td className="p-2.5 font-medium" dir="rtl">{city.nameAr}</td>
                  <td className="p-2.5 text-muted-foreground text-xs">
                    {lang === "ar" ? (city.regionAr || city.region) : city.region}
                  </td>
                  <td className="p-2.5 text-center">
                    <button
                      onClick={() => toggleMutation.mutate({ id: city.id, isActive: !city.isActive })}
                      disabled={toggleMutation.isPending}
                      className="inline-flex items-center gap-1"
                      title={city.isActive ? (lang === "ar" ? "تعطيل (قريباً)" : "Deactivate (Coming Soon)") : (lang === "ar" ? "تفعيل" : "Activate")}
                    >
                      {city.isActive !== false ? (
                        <Badge variant="default" className="bg-green-600 cursor-pointer hover:bg-green-700 text-[10px]">
                          {lang === "ar" ? "نشطة" : "Active"}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-amber-600 border-amber-300 cursor-pointer hover:bg-amber-50 text-[10px]">
                          {lang === "ar" ? "قريباً" : "Coming Soon"}
                        </Badge>
                      )}
                    </button>
                  </td>
                  <td className="p-2.5 text-center text-muted-foreground">{city.sortOrder || 0}</td>
                  <td className="p-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {editingId === city.id ? (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => updateMutation.mutate({ id: city.id, ...form })} disabled={updateMutation.isPending}>
                            <Save className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                            <Eye className="h-3 w-3" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => startEdit(city)}>
                            <Settings className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              if (confirm(lang === "ar" ? `حذف ${city.nameAr}؟` : `Delete ${city.nameEn}?`)) {
                                deleteMutation.mutate({ id: city.id });
                              }
                            }}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Inline Edit Form */}
        {editingId && (
          <div className="border rounded-lg p-4 bg-accent/30 space-y-3">
            <h4 className="font-semibold text-sm">{lang === "ar" ? "تعديل المدينة" : "Edit City"}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{lang === "ar" ? "الاسم (إنجليزي)" : "Name (English)"}</Label>
                <Input value={form.nameEn} onChange={e => setForm(p => ({ ...p, nameEn: e.target.value }))} dir="ltr" />
              </div>
              <div>
                <Label className="text-xs">{lang === "ar" ? "الاسم (عربي)" : "Name (Arabic)"}</Label>
                <Input value={form.nameAr} onChange={e => setForm(p => ({ ...p, nameAr: e.target.value }))} dir="rtl" />
              </div>
              <div>
                <Label className="text-xs">{lang === "ar" ? "المنطقة (إنجليزي)" : "Region (English)"}</Label>
                <Input value={form.region} onChange={e => setForm(p => ({ ...p, region: e.target.value }))} dir="ltr" />
              </div>
              <div>
                <Label className="text-xs">{lang === "ar" ? "المنطقة (عربي)" : "Region (Arabic)"}</Label>
                <Input value={form.regionAr} onChange={e => setForm(p => ({ ...p, regionAr: e.target.value }))} dir="rtl" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Checkbox checked={form.isActive} onCheckedChange={(v) => setForm(p => ({ ...p, isActive: !!v }))} />
                <Label className="text-xs">{lang === "ar" ? "نشطة" : "Active"}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs">{lang === "ar" ? "الترتيب" : "Sort"}</Label>
                <Input type="number" value={form.sortOrder} onChange={e => setForm(p => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))} className="w-20" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              {form.imageUrl && <img loading="lazy" src={form.imageUrl} alt="" className="h-12 w-16 object-cover rounded" />}
              <Button variant="outline" size="sm" onClick={handlePhotoUpload} disabled={uploadPhotoMutation.isPending}>
                <Upload className="h-3 w-3 me-1" />
                {lang === "ar" ? "رفع صورة" : "Upload Photo"}
              </Button>
              <Input value={form.imageUrl} onChange={e => setForm(p => ({ ...p, imageUrl: e.target.value }))} placeholder={lang === "ar" ? "رابط الصورة" : "Image URL"} className="flex-1" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => updateMutation.mutate({ id: editingId, ...form })} disabled={updateMutation.isPending}>
                <Save className="h-3 w-3 me-1" />
                {lang === "ar" ? "حفظ التعديلات" : "Save Changes"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                {lang === "ar" ? "إلغاء" : "Cancel"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
