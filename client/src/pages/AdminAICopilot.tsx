import SEOHead from "@/components/SEOHead";
import { useI18n } from "@/lib/i18n";
import DOMPurify from 'dompurify';
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MessageSquare, Send, ArrowLeft, Loader2, Shield, Bot,
  Sparkles, HelpCircle, BookOpen, Wrench
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { getLoginUrl } from "@/const";

interface CopilotMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const QUICK_PROMPTS_AR = [
  { icon: <BookOpen className="h-4 w-4" />, text: "كيف أضيف عقار جديد؟" },
  { icon: <Wrench className="h-4 w-4" />, text: "الصور لا تظهر في العقار — ما الحل؟" },
  { icon: <HelpCircle className="h-4 w-4" />, text: "كيف أتعامل مع شكوى مستأجر؟" },
  { icon: <Shield className="h-4 w-4" />, text: "ما هي صلاحيات كل دور؟" },
];

const QUICK_PROMPTS_EN = [
  { icon: <BookOpen className="h-4 w-4" />, text: "How to add a new property?" },
  { icon: <Wrench className="h-4 w-4" />, text: "Photos not showing on a property — how to fix?" },
  { icon: <HelpCircle className="h-4 w-4" />, text: "How to handle a tenant complaint?" },
  { icon: <Shield className="h-4 w-4" />, text: "What are the permissions for each role?" },
];

export default function AdminAICopilot() {
  const { lang } = useI18n();
  const { user, isAuthenticated, loading } = useAuth();
  const [location] = useLocation();
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Use the existing AI chat endpoint with a special copilot conversation
  const chatMutation = trpc.ai.chat.useMutation();
  const newConversation = trpc.ai.newConversation.useMutation();
  const [conversationId, setConversationId] = useState<number | null>(null);

  // Create a copilot conversation on mount
  useEffect(() => {
    if (isAuthenticated && !conversationId) {
      newConversation.mutate(
        { title: lang === "ar" ? "مساعد الإدارة" : "Admin Copilot" },
        {
          onSuccess: (data) => setConversationId(data.id),
        }
      );
    }
  }, [isAuthenticated]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const quickPrompts = lang === "ar" ? QUICK_PROMPTS_AR : QUICK_PROMPTS_EN;

  const sendMessage = async (text: string) => {
    if (!text.trim() || !conversationId || isThinking) return;

    const userMsg: CopilotMessage = { role: "user", content: text.trim(), timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsThinking(true);

    try {
      // Prefix the message with copilot context so the AI knows it's an admin copilot
      const copilotPrefix = lang === "ar"
        ? `[مساعد الإدارة — الدور: ${user?.role || "admin"} — الصفحة: ${location}] `
        : `[Admin Copilot — Role: ${user?.role || "admin"} — Page: ${location}] `;

      const result = await chatMutation.mutateAsync({
        conversationId,
        message: copilotPrefix + text.trim(),
      });

      const assistantMsg: CopilotMessage = {
        role: "assistant",
        content: result.response,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: CopilotMessage = {
        role: "assistant",
        content: lang === "ar"
          ? "عذراً، حدث خطأ. يرجى المحاولة مرة أخرى."
          : "Sorry, an error occurred. Please try again.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsThinking(false);
      inputRef.current?.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8" /></div>;
  if (!isAuthenticated) { window.location.href = getLoginUrl(); return null; }

  return (
    <div className="min-h-screen flex flex-col">
      <SEOHead title="Admin AI Copilot" titleAr="مساعد الإدارة الذكي" path="/admin/ai-copilot" noindex={true} />
      <Navbar />
      <div className="container py-6 max-w-3xl flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/admin">
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-heading font-bold flex items-center gap-2">
              <Bot className="h-5 w-5 text-cyan-500" />
              {lang === "ar" ? "مساعد الإدارة الذكي" : "Admin AI Copilot"}
            </h1>
            <p className="text-muted-foreground text-xs mt-0.5">
              {lang === "ar"
                ? "إرشادات خطوة بخطوة — لا ينفذ إجراءات ولا يعدل بيانات"
                : "Step-by-step guidance — does not execute actions or modify data"}
            </p>
          </div>
        </div>

        {/* Chat area */}
        <Card className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ minHeight: "400px", maxHeight: "60vh" }}>
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center mb-4">
                  <Sparkles className="h-8 w-8 text-cyan-500" />
                </div>
                <h3 className="font-heading font-semibold text-lg mb-2">
                  {lang === "ar" ? "مرحباً! كيف أقدر أساعدك؟" : "Hello! How can I help you?"}
                </h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-md">
                  {lang === "ar"
                    ? "اسألني عن إجراءات التشغيل، استكشاف الأخطاء، أو أي سؤال إداري"
                    : "Ask me about SOPs, troubleshooting, or any admin question"}
                </p>
                {/* Quick prompts */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                  {quickPrompts.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(p.text)}
                      className="flex items-center gap-2 p-3 rounded-lg border text-start text-sm hover:bg-accent transition-colors"
                    >
                      <span className="text-cyan-500">{p.icon}</span>
                      <span>{p.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-cyan-500 text-white rounded-br-sm"
                        : "bg-muted rounded-bl-sm"
                    }`}
                    style={{ direction: lang === "ar" ? "rtl" : "ltr" }}
                  >
                    {msg.role === "assistant" ? (
                      <div
                        className="prose prose-sm dark:prose-invert max-w-none [&_p]:mb-2 [&_li]:mb-1"
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(simpleMarkdown(msg.content)) }}
                      />
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              ))
            )}
            {isThinking && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-cyan-500" />
                  <span className="text-sm text-muted-foreground">
                    {lang === "ar" ? "أفكر..." : "Thinking..."}
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t p-3">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={lang === "ar" ? "اكتب سؤالك هنا..." : "Type your question here..."}
                className="flex-1 h-11"
                disabled={isThinking || !conversationId}
              />
              <Button
                type="submit"
                size="icon"
                className="h-11 w-11 bg-cyan-500 hover:bg-cyan-600"
                disabled={!input.trim() || isThinking || !conversationId}
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
            <p className="text-[10px] text-muted-foreground text-center mt-2">
              {lang === "ar"
                ? "المساعد يقدم إرشادات فقط — لا ينفذ إجراءات ولا يكشف أسرار النظام"
                : "Copilot provides guidance only — does not execute actions or expose system secrets"}
            </p>
          </div>
        </Card>
      </div>
      <Footer />
    </div>
  );
}

/** Simple markdown to HTML for copilot responses */
function simpleMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n- /g, '<br/>• ')
    .replace(/\n(\d+)\. /g, '<br/>$1. ')
    .replace(/`(.+?)`/g, '<code class="bg-muted px-1 rounded text-xs">$1</code>');
}
