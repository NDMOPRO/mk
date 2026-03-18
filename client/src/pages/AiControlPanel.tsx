import SEOHead from "@/components/SEOHead";
import { useState, useRef } from "react";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Bot, Settings, FileText, MessageCircle, Star, Upload,
  Trash2, Eye, EyeOff, ChevronLeft, Save,
  Brain, BarChart3, File, Download, Loader2, Key, CheckCircle2, XCircle, RefreshCw,
} from "lucide-react";
import { Link } from "wouter";

export default function AiControlPanel() {
  const { t, lang, dir } = useI18n();
  const [activeTab, setActiveTab] = useState<"overview" | "settings" | "documents" | "conversations" | "ratings">("overview");

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="AI Control Panel | المفتاح الشهري - Monthly Key" />
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container py-4">
          <div className="flex items-center gap-3 mb-2">
            <Link href="/admin">
              <Button variant="ghost" size="icon" className="shrink-0">
                <ChevronLeft className={`w-5 h-5 ${dir === "rtl" ? "rotate-180" : ""}`} />
              </Button>
            </Link>
            <Bot className="w-8 h-8 text-emerald-600" />
            <div>
              <h1 className="text-2xl font-bold">
                {lang === "ar" ? "لوحة تحكم المساعد الذكي" : "AI Assistant Control Panel"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {lang === "ar" ? "تحكم كامل بالمساعد الذكي — الإعدادات، المستندات، المحادثات، التقييمات" : "Full control over AI assistant — settings, documents, conversations, ratings"}
              </p>
            </div>
          </div>
          {/* Tabs */}
          <div className="flex gap-1 mt-4 overflow-x-auto">
            {[
              { id: "overview" as const, icon: BarChart3, labelAr: "نظرة عامة", labelEn: "Overview" },
              { id: "settings" as const, icon: Settings, labelAr: "الإعدادات", labelEn: "Settings" },
              { id: "documents" as const, icon: FileText, labelAr: "المستندات", labelEn: "Documents" },
              { id: "conversations" as const, icon: MessageCircle, labelAr: "المحادثات", labelEn: "Conversations" },
              { id: "ratings" as const, icon: Star, labelAr: "التقييمات", labelEn: "Ratings" },
            ].map((tab) => (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? "default" : "ghost"}
                className={`gap-2 shrink-0 ${activeTab === tab.id ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <tab.icon className="w-4 h-4" />
                {lang === "ar" ? tab.labelAr : tab.labelEn}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container py-6">
        {activeTab === "overview" && <OverviewTab />}
        {activeTab === "settings" && <SettingsTab />}
        {activeTab === "documents" && <DocumentsTab />}
        {activeTab === "conversations" && <ConversationsTab />}
        {activeTab === "ratings" && <RatingsTab />}
      </div>
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────
function OverviewTab() {
  const { lang } = useI18n();
  const { data: stats, isLoading } = trpc.ai.stats.useQuery();

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>;

  const cards = [
    { labelAr: "إجمالي المحادثات", labelEn: "Total Conversations", value: stats?.totalConversations || 0, icon: MessageCircle, color: "text-blue-600 bg-blue-100" },
    { labelAr: "إجمالي الرسائل", labelEn: "Total Messages", value: stats?.totalMessages || 0, icon: FileText, color: "text-emerald-600 bg-emerald-100" },
    { labelAr: "متوسط التقييم", labelEn: "Average Rating", value: (stats?.avgRating || 0).toFixed(1), icon: Star, color: "text-amber-600 bg-amber-100" },
    { labelAr: "المستندات المرفوعة", labelEn: "Uploaded Documents", value: stats?.totalDocuments || 0, icon: File, color: "text-purple-600 bg-purple-100" },
    { labelAr: "مقالات قاعدة المعرفة", labelEn: "Knowledge Articles", value: stats?.totalArticles || 0, icon: Brain, color: "text-rose-600 bg-rose-100" },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {cards.map((card, i) => (
        <Card key={i}>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${card.color}`}>
                <card.icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{lang === "ar" ? card.labelAr : card.labelEn}</p>
                <p className="text-3xl font-bold">{card.value}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Settings Tab ─────────────────────────────────────────────────
function SettingsTab() {
  const { lang } = useI18n();
  const utils = trpc.useUtils();
  // FIX: getAllSettings returns Record<string, string>, NOT an array
  const { data: settings } = trpc.siteSettings.getAll.useQuery() as { data: Record<string, string> | undefined };
  const updateSetting = trpc.siteSettings.update.useMutation({
    onSuccess: () => {
      utils.siteSettings.getAll.invalidate();
      toast.success(lang === "ar" ? "تم حفظ الإعدادات" : "Settings saved");
    },
  });

  // FIX: Access settings as a Record (object), not as an array
  const getSetting = (key: string) => {
    if (!settings || typeof settings !== "object") return "";
    // Handle both Record<string, string> and array formats for safety
    if (Array.isArray(settings)) {
      const s = (settings as any[]).find((s: any) => s.key === key || s.settingKey === key);
      return s?.value || s?.settingValue || "";
    }
    return (settings as Record<string, string>)[key] || "";
  };

  const [localSettings, setLocalSettings] = useState<Record<string, string>>({});

  const getVal = (key: string) => localSettings[key] ?? getSetting(key);
  const setVal = (key: string, value: string) => setLocalSettings(prev => ({ ...prev, [key]: value }));

  const handleSaveAll = () => {
    if (Object.keys(localSettings).length === 0) return;
    updateSetting.mutate({ settings: localSettings });
    setLocalSettings({});
  };

  const saveSingleSetting = (key: string, value: string) => {
    updateSetting.mutate({ settings: { [key]: value } });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Enable/Disable */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5" />
            {lang === "ar" ? "تفعيل المساعد الذكي" : "Enable AI Assistant"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <Label>{lang === "ar" ? "المساعد الذكي مفعل" : "AI Assistant Enabled"}</Label>
            <Switch
              checked={getVal("ai.enabled") === "true"}
              onCheckedChange={(checked) => {
                setVal("ai.enabled", checked ? "true" : "false");
                saveSingleSetting("ai.enabled", checked ? "true" : "false");
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* API Key Management */}
      <Card className="border-amber-200 bg-amber-50/30 dark:border-amber-900 dark:bg-amber-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="w-5 h-5 text-amber-600" />
            {lang === "ar" ? "مفتاح OpenAI API" : "OpenAI API Key"}
          </CardTitle>
          <CardDescription>
            {lang === "ar"
              ? "أدخل مفتاح OpenAI API لتشغيل المساعد الذكي. يمكنك الحصول على مفتاح من platform.openai.com"
              : "Enter your OpenAI API key to power the AI assistant. Get a key from platform.openai.com"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ApiKeyField
            lang={lang}
            getVal={getVal}
            setVal={setVal}
            saveSingleSetting={saveSingleSetting}
          />
        </CardContent>
      </Card>

      {/* Identity */}
      <Card>
        <CardHeader>
          <CardTitle>{lang === "ar" ? "هوية المساعد" : "Assistant Identity"}</CardTitle>
          <CardDescription>{lang === "ar" ? "اسم المساعد ورسالة الترحيب" : "Name and welcome message"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{lang === "ar" ? "الاسم (عربي)" : "Name (Arabic)"}</Label>
              <Input value={getVal("ai.name")} onChange={(e) => setVal("ai.name", e.target.value)} />
            </div>
            <div>
              <Label>{lang === "ar" ? "الاسم (إنجليزي)" : "Name (English)"}</Label>
              <Input value={getVal("ai.nameEn")} onChange={(e) => setVal("ai.nameEn", e.target.value)} />
            </div>
          </div>
          <div>
            <Label>{lang === "ar" ? "رسالة الترحيب (عربي)" : "Welcome Message (Arabic)"}</Label>
            <Textarea value={getVal("ai.welcomeMessage")} onChange={(e) => setVal("ai.welcomeMessage", e.target.value)} rows={2} />
          </div>
          <div>
            <Label>{lang === "ar" ? "رسالة الترحيب (إنجليزي)" : "Welcome Message (English)"}</Label>
            <Textarea value={getVal("ai.welcomeMessageEn")} onChange={(e) => setVal("ai.welcomeMessageEn", e.target.value)} rows={2} />
          </div>
        </CardContent>
      </Card>

      {/* Personality */}
      <Card>
        <CardHeader>
          <CardTitle>{lang === "ar" ? "شخصية المساعد" : "Assistant Personality"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>{lang === "ar" ? "نمط الشخصية" : "Personality Style"}</Label>
            <Select value={getVal("ai.personality") || "professional_friendly"} onValueChange={(v) => setVal("ai.personality", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="professional_friendly">{lang === "ar" ? "محترف وودود" : "Professional & Friendly"}</SelectItem>
                <SelectItem value="formal">{lang === "ar" ? "رسمي" : "Formal"}</SelectItem>
                <SelectItem value="casual_saudi">{lang === "ar" ? "عامي سعودي" : "Casual Saudi"}</SelectItem>
                <SelectItem value="helpful_detailed">{lang === "ar" ? "مفصّل ومساعد" : "Helpful & Detailed"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{lang === "ar" ? "الحد الأقصى لطول الرد (كلمة)" : "Max Response Length (words)"}</Label>
            <Input type="number" value={getVal("ai.maxResponseLength")} onChange={(e) => setVal("ai.maxResponseLength", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Custom Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>{lang === "ar" ? "تعليمات مخصصة" : "Custom Instructions"}</CardTitle>
          <CardDescription>{lang === "ar" ? "أضف تعليمات إضافية للمساعد الذكي (مثل: لا تذكر المنافسين، ركز على الخدمات الجديدة)" : "Add custom instructions for the AI (e.g., don't mention competitors, focus on new services)"}</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={getVal("ai.customInstructions")}
            onChange={(e) => setVal("ai.customInstructions", e.target.value)}
            rows={5}
            placeholder={lang === "ar" ? "أضف تعليمات إضافية هنا..." : "Add custom instructions here..."}
          />
        </CardContent>
      </Card>

      {/* Save Button */}
      {Object.keys(localSettings).length > 0 && (
        <Button onClick={handleSaveAll} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
          <Save className="w-4 h-4" />
          {lang === "ar" ? "حفظ جميع التغييرات" : "Save All Changes"}
        </Button>
      )}
    </div>
  );
}

// ─── API Key Field ────────────────────────────────────────────────
function ApiKeyField({ lang, getVal, setVal, saveSingleSetting }: {
  lang: string;
  getVal: (key: string) => string;
  setVal: (key: string, value: string) => void;
  saveSingleSetting: (key: string, value: string) => void;
}) {
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);
  const testMutation = trpc.ai.testApiKey.useMutation({
    onSuccess: (data: any) => {
      setTesting(false);
      if (data?.success) {
        setTestResult("success");
        toast.success(lang === "ar" ? "المفتاح يعمل بنجاح!" : "API key is working!");
      } else {
        setTestResult("error");
        toast.error(data?.error || (lang === "ar" ? "المفتاح غير صالح" : "Invalid API key"));
      }
    },
    onError: (err) => {
      setTesting(false);
      setTestResult("error");
      toast.error(err.message || (lang === "ar" ? "فشل اختبار المفتاح" : "Failed to test key"));
    },
  });

  const currentKey = getVal("ai.apiKey") || "";
  const maskedKey = currentKey ? `${currentKey.slice(0, 7)}${'*'.repeat(20)}${currentKey.slice(-4)}` : "";

  const handleSaveKey = () => {
    const key = getVal("ai.apiKey");
    if (!key || !key.startsWith("sk-")) {
      toast.error(lang === "ar" ? "المفتاح يجب أن يبدأ بـ sk-" : "Key must start with sk-");
      return;
    }
    saveSingleSetting("ai.apiKey", key);
    setTestResult(null);
    toast.success(lang === "ar" ? "تم حفظ المفتاح" : "API key saved");
  };

  const handleTestKey = () => {
    const key = getVal("ai.apiKey");
    if (!key || !key.startsWith("sk-")) {
      toast.error(lang === "ar" ? "أدخل مفتاح صالح أولاً" : "Enter a valid key first");
      return;
    }
    setTesting(true);
    setTestResult(null);
    testMutation.mutate({ apiKey: key });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          {lang === "ar" ? "مفتاح API" : "API Key"}
          {testResult === "success" && <CheckCircle2 className="w-4 h-4 text-green-600" />}
          {testResult === "error" && <XCircle className="w-4 h-4 text-red-600" />}
        </Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              type={showKey ? "text" : "password"}
              value={showKey ? (getVal("ai.apiKey") || "") : maskedKey}
              onChange={(e) => { setVal("ai.apiKey", e.target.value); setTestResult(null); }}
              placeholder="sk-proj-..."
              className="font-mono text-sm pe-10"
              dir="ltr"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute top-1/2 -translate-y-1/2 end-3 text-muted-foreground hover:text-foreground"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button onClick={handleSaveKey} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
          <Save className="w-4 h-4" />
          {lang === "ar" ? "حفظ المفتاح" : "Save Key"}
        </Button>
        <Button variant="outline" onClick={handleTestKey} disabled={testing} className="gap-2">
          {testing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
          {lang === "ar" ? "اختبار المفتاح" : "Test Key"}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        {lang === "ar"
          ? "المفتاح يُحفظ بشكل آمن في قاعدة البيانات ويُستخدم لجميع خدمات AI (المحادثة، توليد الصور، تحويل الصوت). احصل على مفتاح من "
          : "The key is securely stored in the database and used for all AI services (chat, image generation, voice transcription). Get a key from "}
        <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline">
          platform.openai.com/api-keys
        </a>
      </p>
    </div>
  );
}

// ─── Documents Tab ────────────────────────────────────────────────
function DocumentsTab() {
  const { lang } = useI18n();
  const utils = trpc.useUtils();
  const { data: documents, isLoading } = trpc.ai.documents.useQuery();
  const uploadMutation = trpc.ai.uploadDocument.useMutation({
    onSuccess: () => {
      utils.ai.documents.invalidate();
      toast.success(lang === "ar" ? "تم رفع المستند بنجاح" : "Document uploaded successfully");
    },
    onError: () => toast.error(lang === "ar" ? "فشل رفع المستند" : "Upload failed"),
  });
  const deleteMutation = trpc.ai.deleteDocument.useMutation({
    onSuccess: () => {
      utils.ai.documents.invalidate();
      toast.success(lang === "ar" ? "تم حذف المستند" : "Document deleted");
    },
  });
  const updateMutation = trpc.ai.updateDocument.useMutation({
    onSuccess: () => {
      utils.ai.documents.invalidate();
      toast.success(lang === "ar" ? "تم تحديث المستند" : "Document updated");
    },
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadDesc, setUploadDesc] = useState("");
  const [uploadDescAr, setUploadDescAr] = useState("");
  const [uploadCategory, setUploadCategory] = useState("general");

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error(lang === "ar" ? "الحد الأقصى 10 ميقا" : "Max file size is 10MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      
      let extractedText = "";
      if (file.type === "text/plain" || file.name.endsWith(".txt") || file.name.endsWith(".md")) {
        extractedText = await file.text();
      } else if (file.type === "text/csv" || file.name.endsWith(".csv")) {
        extractedText = await file.text();
      }

      uploadMutation.mutate({
        base64,
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        category: uploadCategory,
        description: uploadDesc || file.name,
        descriptionAr: uploadDescAr || file.name,
        extractedText: extractedText || undefined,
      });

      setUploadDesc("");
      setUploadDescAr("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            {lang === "ar" ? "رفع مستند جديد" : "Upload New Document"}
          </CardTitle>
          <CardDescription>
            {lang === "ar"
              ? "ارفع مستندات (PDF, TXT, CSV, Word) لتحسين معرفة المساعد الذكي. المحتوى النصي يُستخرج تلقائياً."
              : "Upload documents (PDF, TXT, CSV, Word) to enhance AI knowledge. Text content is extracted automatically."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>{lang === "ar" ? "وصف المستند (عربي)" : "Description (Arabic)"}</Label>
              <Input value={uploadDescAr} onChange={(e) => setUploadDescAr(e.target.value)} placeholder={lang === "ar" ? "وصف المستند..." : "Document description..."} />
            </div>
            <div>
              <Label>{lang === "ar" ? "وصف المستند (إنجليزي)" : "Description (English)"}</Label>
              <Input value={uploadDesc} onChange={(e) => setUploadDesc(e.target.value)} placeholder="Document description..." />
            </div>
          </div>
          <div>
            <Label>{lang === "ar" ? "التصنيف" : "Category"}</Label>
            <Select value={uploadCategory} onValueChange={setUploadCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="general">{lang === "ar" ? "عام" : "General"}</SelectItem>
                <SelectItem value="policy">{lang === "ar" ? "سياسات" : "Policy"}</SelectItem>
                <SelectItem value="guide">{lang === "ar" ? "دليل" : "Guide"}</SelectItem>
                <SelectItem value="faq">{lang === "ar" ? "أسئلة شائعة" : "FAQ"}</SelectItem>
                <SelectItem value="training">{lang === "ar" ? "تدريب" : "Training"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.csv,.doc,.docx,.md"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 gap-2"
            >
              {uploadMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {lang === "ar" ? "اختر ملف للرفع" : "Choose File to Upload"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Documents List */}
      <Card>
        <CardHeader>
          <CardTitle>{lang === "ar" ? "المستندات المرفوعة" : "Uploaded Documents"}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : !documents?.length ? (
            <p className="text-center text-muted-foreground py-8">
              {lang === "ar" ? "لا توجد مستندات مرفوعة بعد" : "No documents uploaded yet"}
            </p>
          ) : (
            <div className="space-y-3">
              {(Array.isArray(documents) ? documents : []).map((doc: any) => (
                <div key={doc.id} className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                  <div className="flex items-center gap-3 min-w-0">
                    <File className="w-8 h-8 text-emerald-600 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{doc.filename}</p>
                      <p className="text-sm text-muted-foreground">
                        {lang === "ar" ? doc.descriptionAr || doc.description : doc.description || doc.descriptionAr}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">{doc.category}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {(doc.fileSize / 1024).toFixed(1)} KB
                        </span>
                        {doc.extractedText && (
                          <Badge variant="secondary" className="text-xs">
                            {lang === "ar" ? "نص مستخرج" : "Text Extracted"}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => updateMutation.mutate({ id: doc.id, isActive: !doc.isActive })}
                    >
                      {doc.isActive ? <Eye className="w-4 h-4 text-emerald-600" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm(lang === "ar" ? "هل تريد حذف هذا المستند؟" : "Delete this document?")) {
                          deleteMutation.mutate({ id: doc.id });
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                    <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="icon">
                        <Download className="w-4 h-4" />
                      </Button>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Conversations Tab ────────────────────────────────────────────
function ConversationsTab() {
  const { lang, dir } = useI18n();
  const [selectedConvId, setSelectedConvId] = useState<number | null>(null);
  const { data: conversations, isLoading } = trpc.ai.allConversations.useQuery();
  const { data: messages } = trpc.ai.adminMessages.useQuery(
    { conversationId: selectedConvId! },
    { enabled: !!selectedConvId }
  );

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ minHeight: "500px" }}>
      {/* Conversations List */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="text-base">
            {lang === "ar" ? `المحادثات (${conversations?.length || 0})` : `Conversations (${conversations?.length || 0})`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            {!conversations?.length ? (
              <p className="text-center text-muted-foreground py-8 px-4">
                {lang === "ar" ? "لا توجد محادثات" : "No conversations"}
              </p>
            ) : (
              (Array.isArray(conversations) ? conversations : []).map((conv: any) => (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConvId(conv.id)}
                  className={`w-full text-start p-4 border-b hover:bg-muted/50 transition-colors ${selectedConvId === conv.id ? "bg-emerald-50 dark:bg-emerald-950/20" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm truncate">{conv.title || (lang === "ar" ? "محادثة" : "Conversation")}</p>
                    <Badge variant="outline" className="text-xs shrink-0">#{conv.id}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {lang === "ar" ? "المستخدم" : "User"} #{conv.userId} • {new Date(conv.updatedAt).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US")}
                  </p>
                </button>
              ))
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Messages View */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">
            {selectedConvId
              ? (lang === "ar" ? `محادثة #${selectedConvId}` : `Conversation #${selectedConvId}`)
              : (lang === "ar" ? "اختر محادثة" : "Select a conversation")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            {!selectedConvId ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <MessageCircle className="w-12 h-12 mb-3 opacity-30" />
                <p>{lang === "ar" ? "اختر محادثة من القائمة" : "Select a conversation from the list"}</p>
              </div>
            ) : !messages?.length ? (
              <p className="text-center text-muted-foreground py-8">
                {lang === "ar" ? "لا توجد رسائل" : "No messages"}
              </p>
            ) : (
              <div className="p-4 space-y-3">
                {(Array.isArray(messages) ? messages : []).map((msg: any) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm ${
                        msg.role === "user"
                          ? "bg-emerald-600 text-white"
                          : "bg-muted"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                      <div className="flex items-center gap-2 mt-1 opacity-60 text-xs">
                        <span>{new Date(msg.createdAt).toLocaleTimeString(lang === "ar" ? "ar-SA" : "en-US")}</span>
                        {msg.rating && (
                          <span className="flex items-center gap-0.5">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            {msg.rating}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Ratings Tab ──────────────────────────────────────────────────
function RatingsTab() {
  const { lang } = useI18n();
  const { data: ratedMessages, isLoading } = trpc.ai.ratedMessages.useQuery();

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>;

  const safeRatedMessages = Array.isArray(ratedMessages) ? ratedMessages : [];
  const ratingCounts = [5, 4, 3, 2, 1].map((r) => ({
    rating: r,
    count: safeRatedMessages.filter((m: any) => m.rating === r).length || 0,
  }));
  const totalRated = safeRatedMessages.length;

  return (
    <div className="space-y-6">
      {/* Rating Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>{lang === "ar" ? "توزيع التقييمات" : "Rating Distribution"}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {ratingCounts.map(({ rating, count }) => (
              <div key={rating} className="flex items-center gap-3">
                <div className="flex items-center gap-1 w-20 shrink-0">
                  {Array.from({ length: rating }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all"
                    style={{ width: totalRated > 0 ? `${(count / totalRated) * 100}%` : "0%" }}
                  />
                </div>
                <span className="text-sm text-muted-foreground w-10 text-end">{count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Rated Messages */}
      <Card>
        <CardHeader>
          <CardTitle>{lang === "ar" ? "آخر الرسائل المقيّمة" : "Recent Rated Messages"}</CardTitle>
        </CardHeader>
        <CardContent>
          {!safeRatedMessages.length ? (
            <p className="text-center text-muted-foreground py-8">
              {lang === "ar" ? "لا توجد تقييمات بعد" : "No ratings yet"}
            </p>
          ) : (
            <div className="space-y-4">
              {safeRatedMessages.slice(0, 20).map((msg: any) => (
                <div key={msg.id} className="p-4 rounded-lg border">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`w-4 h-4 ${i < msg.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(msg.createdAt).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US")}
                    </span>
                  </div>
                  <p className="text-sm line-clamp-3">{msg.content}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
