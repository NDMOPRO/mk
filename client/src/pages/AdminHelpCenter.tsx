import SEOHead from "@/components/SEOHead";
import { useI18n } from "@/lib/i18n";
import DOMPurify from 'dompurify';
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  HelpCircle, Search, ChevronDown, ChevronUp, ArrowLeft, BookOpen,
  Shield, Loader2, Users, Wrench, MessageSquare, AlertTriangle, BookMarked
} from "lucide-react";
import { useState, useMemo } from "react";
import { Link } from "wouter";
import { getLoginUrl } from "@/const";

// Map section IDs to icons
const sectionIcons: Record<string, React.ReactNode> = {
  roles: <Shield className="h-5 w-5" />,
  sops: <BookOpen className="h-5 w-5" />,
  troubleshooting: <Wrench className="h-5 w-5" />,
  "internal-faq": <HelpCircle className="h-5 w-5" />,
  "response-templates": <MessageSquare className="h-5 w-5" />,
  glossary: <BookMarked className="h-5 w-5" />,
};

export default function AdminHelpCenter() {
  const { lang } = useI18n();
  const { user, isAuthenticated, loading } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const kbSections = trpc.knowledge.kbSections.useQuery(
    { lang },
    { enabled: isAuthenticated && (user?.role === "admin" || user?.role === "landlord") }
  );

  const filteredSections = useMemo(() => {
    if (!kbSections.data) return [];
    if (!searchQuery.trim()) return kbSections.data;
    const q = searchQuery.toLowerCase();
    return kbSections.data.filter(
      (s: any) => s.title.toLowerCase().includes(q) || s.content.toLowerCase().includes(q)
    );
  }, [kbSections.data, searchQuery]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8" /></div>;
  if (!isAuthenticated) { window.location.href = getLoginUrl(); return null; }

  return (
    <div className="min-h-screen flex flex-col">
      <SEOHead title="Help Center" titleAr="مركز المساعدة" path="/admin/help-center" noindex={true} />
      <Navbar />
      <div className="container py-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/admin">
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
              <HelpCircle className="h-6 w-6 text-blue-500" />
              {lang === "ar" ? "مركز المساعدة" : "Help Center"}
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {lang === "ar" ? "قاعدة المعرفة الإدارية — إجراءات التشغيل واستكشاف الأخطاء" : "Admin knowledge base — SOPs and troubleshooting"}
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={lang === "ar" ? "ابحث في قاعدة المعرفة..." : "Search knowledge base..."}
            className="ps-9 h-11"
          />
        </div>

        {/* Sections */}
        {kbSections.isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
          </div>
        ) : filteredSections.length === 0 ? (
          <Card className="p-12 text-center">
            <HelpCircle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">
              {searchQuery
                ? (lang === "ar" ? "لا توجد نتائج للبحث" : "No results found")
                : (lang === "ar" ? "لا توجد مقالات في قاعدة المعرفة" : "No knowledge base articles")}
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredSections.map((section: any) => (
              <Card key={section.id} className="overflow-hidden transition-all hover:shadow-md">
                <button
                  onClick={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
                  className="w-full text-start p-4 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0">
                      {sectionIcons[section.id] || <BookOpen className="h-5 w-5" />}
                    </div>
                    <div>
                      <h3 className="font-heading font-semibold text-sm sm:text-base">{section.title}</h3>
                      {!expandedSection && (
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          {section.content.slice(0, 100)}...
                        </p>
                      )}
                    </div>
                  </div>
                  {expandedSection === section.id ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
                  )}
                </button>
                {expandedSection === section.id && (
                  <CardContent className="pt-0 pb-5 px-4 border-t">
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none mt-4"
                      style={{ direction: lang === "ar" ? "rtl" : "ltr" }}
                      dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(renderMarkdown(section.content)),
                      }}
                    />
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}

        {/* Quick link to AI Copilot */}
        <Card className="mt-8 p-6 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border-cyan-500/20">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center">
              <MessageSquare className="h-6 w-6 text-cyan-500" />
            </div>
            <div className="flex-1">
              <h3 className="font-heading font-semibold">
                {lang === "ar" ? "هل تحتاج مساعدة إضافية؟" : "Need more help?"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {lang === "ar"
                  ? "استخدم مساعد الإدارة الذكي للحصول على إرشادات خطوة بخطوة"
                  : "Use the Admin AI Copilot for step-by-step guidance"}
              </p>
            </div>
            <Link href="/admin/ai-copilot">
              <Button className="bg-cyan-500 hover:bg-cyan-600 text-white">
                {lang === "ar" ? "المساعد الذكي" : "AI Copilot"}
              </Button>
            </Link>
          </div>
        </Card>
      </div>
      <Footer />
    </div>
  );
}

/** Simple markdown to HTML renderer for KB content */
function renderMarkdown(md: string): string {
  return md
    .replace(/### (.+)/g, '<h4 class="font-semibold mt-4 mb-2">$1</h4>')
    .replace(/#### (.+)/g, '<h5 class="font-medium mt-3 mb-1">$1</h5>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '</p><p class="mb-2">')
    .replace(/\n- /g, '</p><li class="ms-4 list-disc">')
    .replace(/\n(\d+)\. /g, '</p><li class="ms-4 list-decimal">')
    .replace(/\| (.+?) \|/g, (match) => {
      const cells = match.split('|').filter(Boolean).map(c => c.trim());
      return `<tr>${cells.map(c => `<td class="border px-2 py-1 text-sm">${c}</td>`).join('')}</tr>`;
    })
    .replace(/> (.+)/g, '<blockquote class="border-s-4 border-blue-500/30 ps-3 py-1 my-2 text-muted-foreground italic">$1</blockquote>');
}
