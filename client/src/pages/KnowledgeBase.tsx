import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import {
  BookOpen, Plus, Pencil, Trash2, Search, Filter,
  FileText, CheckCircle, Clock, Database, ArrowRight, ArrowLeft,
  BookMarked, Users, ShieldCheck, HelpCircle, ScrollText, Wrench, Globe
} from "lucide-react";

type Category = "general" | "tenant_guide" | "landlord_guide" | "admin_guide" | "faq" | "policy" | "troubleshooting";

interface ArticleForm {
  category: Category;
  titleEn: string;
  titleAr: string;
  contentEn: string;
  contentAr: string;
  tags: string;
  isActive: boolean;
}

const emptyForm: ArticleForm = {
  category: "general",
  titleEn: "",
  titleAr: "",
  contentEn: "",
  contentAr: "",
  tags: "",
  isActive: true,
};

const categoryIcons: Record<Category, typeof BookOpen> = {
  general: Globe,
  tenant_guide: Users,
  landlord_guide: BookMarked,
  admin_guide: ShieldCheck,
  faq: HelpCircle,
  policy: ScrollText,
  troubleshooting: Wrench,
};

export default function KnowledgeBase() {
  const { t, lang, dir } = useI18n();
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [form, setForm] = useState<ArticleForm>(emptyForm);

  const utils = trpc.useUtils();
  const { data: articles, isLoading } = trpc.knowledge.all.useQuery();

  const createMutation = trpc.knowledge.create.useMutation({
    onSuccess: () => {
      toast.success(t("kb.created"));
      utils.knowledge.all.invalidate();
      closeDialog();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.knowledge.update.useMutation({
    onSuccess: () => {
      toast.success(t("kb.updated"));
      utils.knowledge.all.invalidate();
      closeDialog();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.knowledge.delete.useMutation({
    onSuccess: () => {
      toast.success(t("kb.deleted"));
      utils.knowledge.all.invalidate();
      setDeleteDialogOpen(false);
      setDeletingId(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const seedMutation = trpc.knowledge.seed.useMutation({
    onSuccess: () => {
      toast.success(t("kb.seedSuccess"));
      utils.knowledge.all.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  // Filter and search articles
  const filteredArticles = useMemo(() => {
    if (!articles) return [];
    return articles.filter((a: any) => {
      const matchesCategory = filterCategory === "all" || a.category === filterCategory;
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q ||
        a.titleEn?.toLowerCase().includes(q) ||
        a.titleAr?.toLowerCase().includes(q) ||
        a.contentEn?.toLowerCase().includes(q) ||
        a.contentAr?.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [articles, filterCategory, searchQuery]);

  // Stats
  const stats = useMemo(() => {
    if (!articles) return { total: 0, published: 0, drafts: 0 };
    return {
      total: articles.length,
      published: articles.filter((a: any) => a.isActive).length,
      drafts: articles.filter((a: any) => !a.isActive).length,
    };
  }, [articles]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(article: any) {
    setEditingId(article.id);
    setForm({
      category: article.category,
      titleEn: article.titleEn || "",
      titleAr: article.titleAr || "",
      contentEn: article.contentEn || "",
      contentAr: article.contentAr || "",
      tags: article.tags ? (typeof article.tags === "string" ? article.tags : JSON.parse(article.tags).join(", ")) : "",
      isActive: article.isActive ?? true,
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  function handleSave() {
    const tagsArray = form.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        category: form.category,
        titleEn: form.titleEn,
        titleAr: form.titleAr,
        contentEn: form.contentEn,
        contentAr: form.contentAr,
        tags: tagsArray,
        isActive: form.isActive,
      });
    } else {
      createMutation.mutate({
        category: form.category,
        titleEn: form.titleEn,
        titleAr: form.titleAr,
        contentEn: form.contentEn,
        contentAr: form.contentAr,
        tags: tagsArray,
      });
    }
  }

  function confirmDelete(id: number) {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  }

  function handleDelete() {
    if (deletingId) {
      deleteMutation.mutate({ id: deletingId });
    }
  }

  function toggleStatus(article: any) {
    updateMutation.mutate({
      id: article.id,
      isActive: !article.isActive,
    });
  }

  // Auth guard
  if (authLoading) {
    return (
    <DashboardLayout>
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-[#3ECFC0] border-t-transparent rounded-full" />
      </div>
        </DashboardLayout>
  );
  }

  if (!user || user.role !== "admin") {
    return (
      <DashboardLayout>
      <div className="min-h-screen flex flex-col" dir={dir}>
<main className="flex-1 flex items-center justify-center">
          <Card className="max-w-md mx-auto text-center p-8">
            <ShieldCheck className="w-16 h-16 mx-auto text-red-500 mb-4" />
            <h2 className="text-xl font-bold mb-2">
              {lang === "ar" ? "غير مصرح" : "Unauthorized"}
            </h2>
            <p className="text-muted-foreground mb-4">
              {lang === "ar"
                ? "هذه الصفحة متاحة فقط للمسؤولين"
                : "This page is only available to administrators"}
            </p>
            <Button onClick={() => navigate("/")}>
              {lang === "ar" ? "العودة للرئيسية" : "Back to Home"}
            </Button>
          </Card>
        </main>
      </div>
      </DashboardLayout>
    );
  }

  const categories: Category[] = ["general", "tenant_guide", "landlord_guide", "admin_guide", "faq", "policy", "troubleshooting"];
  const BackArrow = dir === "rtl" ? ArrowRight : ArrowLeft;
  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <DashboardLayout>
    <div className="min-h-screen flex flex-col bg-background" dir={dir}>
<main className="flex-1 py-8">
        <div className="container max-w-7xl">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
                <BackArrow className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <BookOpen className="w-7 h-7 text-[#3ECFC0]" />
                  {t("kb.title")}
                </h1>
                <p className="text-muted-foreground text-sm mt-1">{t("kb.subtitle")}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
                <Database className="w-4 h-4 me-2" />
                {t("kb.seedKB")}
              </Button>
              <Button onClick={openCreate} className="bg-[#3ECFC0] hover:bg-[#2ab5a6] text-[#0B1E2D] text-white">
                <Plus className="w-4 h-4 me-2" />
                {t("kb.addArticle")}
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <Card className="border-[#3ECFC0]/20 bg-[#3ECFC0]/5">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#3ECFC0]/10 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-[#3ECFC0]" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#3ECFC0]">{stats.total}</p>
                  <p className="text-sm text-muted-foreground">{t("kb.totalArticles")}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-blue-200 bg-blue-50/50">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-blue-700" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-700">{stats.published}</p>
                  <p className="text-sm text-muted-foreground">{t("kb.publishedArticles")}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-amber-200 bg-amber-50/50">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-amber-700" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-700">{stats.drafts}</p>
                  <p className="text-sm text-muted-foreground">{t("kb.draftArticles")}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t("kb.searchArticles")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ps-10"
              />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <Filter className="w-4 h-4 me-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("kb.allCategories")}</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {t(`kb.cat.${cat}` as any)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Articles Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin w-8 h-8 border-4 border-[#3ECFC0] border-t-transparent rounded-full" />
            </div>
          ) : filteredArticles.length === 0 ? (
            <Card className="text-center py-16">
              <CardContent>
                <BookOpen className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-semibold mb-2">{t("kb.noArticles")}</h3>
                <p className="text-muted-foreground mb-4">
                  {lang === "ar"
                    ? "ابدأ بإضافة مقالات لقاعدة المعرفة أو حمّل المقالات الافتراضية"
                    : "Start by adding articles or load the default articles"}
                </p>
                <div className="flex gap-2 justify-center">
                  <Button variant="outline" onClick={() => seedMutation.mutate()}>
                    <Database className="w-4 h-4 me-2" />
                    {t("kb.seedKB")}
                  </Button>
                  <Button onClick={openCreate} className="bg-[#3ECFC0] hover:bg-[#2ab5a6] text-[#0B1E2D] text-white">
                    <Plus className="w-4 h-4 me-2" />
                    {t("kb.addArticle")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredArticles.map((article: any) => {
                const CatIcon = categoryIcons[article.category as Category] || Globe;
                return (
                  <Card key={article.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        {/* Icon & Category */}
                        <div className="w-10 h-10 rounded-lg bg-[#3ECFC0]/10 flex items-center justify-center shrink-0">
                          <CatIcon className="w-5 h-5 text-[#3ECFC0]" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold truncate">
                              {lang === "ar" ? article.titleAr : article.titleEn}
                            </h3>
                            <Badge variant={article.isActive ? "default" : "secondary"} className={article.isActive ? "bg-[#3ECFC0]/10 text-[#3ECFC0] hover:bg-[#3ECFC0]/20" : ""}>
                              {article.isActive ? t("kb.active") : t("kb.inactive")}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {lang === "ar" ? article.contentAr : article.contentEn}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-xs">
                              {t(`kb.cat.${article.category}` as any)}
                            </Badge>
                            {article.tags && (() => {
                              try {
                                const tags = typeof article.tags === "string" ? JSON.parse(article.tags) : article.tags;
                                return Array.isArray(tags) ? tags.slice(0, 3).map((tag: string, i: number) => (
                                  <Badge key={i} variant="outline" className="text-xs bg-gray-50">
                                    {tag}
                                  </Badge>
                                )) : null;
                              } catch { return null; }
                            })()}
                            <span className="text-xs text-muted-foreground">
                              {new Date(article.updatedAt).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US")}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          <Switch
                            checked={article.isActive}
                            onCheckedChange={() => toggleStatus(article)}
                            className="data-[state=checked]:bg-[#3ECFC0]"
                          />
                          <Button variant="ghost" size="icon" onClick={() => openEdit(article)}>
                            <Pencil className="w-4 h-4 text-blue-600" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => confirmDelete(article.id)}>
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>
{/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir={dir}>
          <DialogHeader>
            <DialogTitle>
              {editingId ? t("kb.editArticle") : t("kb.addArticle")}
            </DialogTitle>
            <DialogDescription>
              {lang === "ar"
                ? "أدخل تفاصيل المقال باللغتين العربية والإنجليزية"
                : "Enter article details in both Arabic and English"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Category */}
            <div>
              <Label>{t("kb.category")}</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as Category })}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {t(`kb.cat.${cat}` as any)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Title Arabic */}
            <div>
              <Label>{t("kb.titleAr")}</Label>
              <Input
                dir="rtl"
                value={form.titleAr}
                onChange={(e) => setForm({ ...form, titleAr: e.target.value })}
                className="mt-1 font-[Tajawal]"
                placeholder="عنوان المقال بالعربية..."
              />
            </div>

            {/* Title English */}
            <div>
              <Label>{t("kb.titleEn")}</Label>
              <Input
                dir="ltr"
                value={form.titleEn}
                onChange={(e) => setForm({ ...form, titleEn: e.target.value })}
                className="mt-1"
                placeholder="Article title in English..."
              />
            </div>

            {/* Content Arabic */}
            <div>
              <Label>{t("kb.contentAr")}</Label>
              <Textarea
                dir="rtl"
                value={form.contentAr}
                onChange={(e) => setForm({ ...form, contentAr: e.target.value })}
                className="mt-1 min-h-[120px] font-[Tajawal]"
                placeholder="محتوى المقال بالعربية..."
              />
            </div>

            {/* Content English */}
            <div>
              <Label>{t("kb.contentEn")}</Label>
              <Textarea
                dir="ltr"
                value={form.contentEn}
                onChange={(e) => setForm({ ...form, contentEn: e.target.value })}
                className="mt-1 min-h-[120px]"
                placeholder="Article content in English..."
              />
            </div>

            {/* Tags */}
            <div>
              <Label>{t("kb.tags")}</Label>
              <Input
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                className="mt-1"
                placeholder={t("kb.tagsPlaceholder")}
              />
            </div>

            {/* Status (only for editing) */}
            {editingId && (
              <div className="flex items-center justify-between">
                <Label>{t("kb.status")}</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {form.isActive ? t("kb.active") : t("kb.inactive")}
                  </span>
                  <Switch
                    checked={form.isActive}
                    onCheckedChange={(v) => setForm({ ...form, isActive: v })}
                    className="data-[state=checked]:bg-[#3ECFC0]"
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeDialog}>
              {t("kb.cancel")}
            </Button>
            <Button
              onClick={handleSave}
              disabled={!form.titleAr || !form.titleEn || !form.contentAr || !form.contentEn || isSaving}
              className="bg-[#3ECFC0] hover:bg-[#2ab5a6] text-[#0B1E2D] text-white"
            >
              {isSaving ? (
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full me-2" />
              ) : null}
              {t("kb.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent dir={dir}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("kb.deleteArticle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("kb.deleteConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>{t("kb.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {t("kb.deleteArticle")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </DashboardLayout>
  );
}
