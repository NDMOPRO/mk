/**
 * Admin WhatsApp Module — Cloud API + Click-to-Chat
 * 
 * Design: RTL-first, 4-tab layout (Settings, Send, Templates, Logs)
 * RBAC: MANAGE_WHATSAPP permission required
 * Features: Masked secrets, template CRUD, send dialog, delivery status
 */
import { useState, useMemo, useRef, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import SEOHead from "@/components/SEOHead";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  MessageCircle, Settings, FileText, Send, Plus, Trash2, Eye, EyeOff,
  CheckCircle2, XCircle, Clock, AlertTriangle, RefreshCw, Phone, ExternalLink,
  Copy, Loader2, CheckCheck, AlertCircle, Search, User, ArrowRight, ArrowLeft,
  Inbox, CircleDot, UserCheck, Archive, X, Timer, Tag, ChevronDown
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Link } from "wouter";

const WA_GREEN = "#25D366";

// ─── Status Badge ───────────────────────────────────────────────────
function StatusBadge({ status, isRtl }: { status: string; isRtl: boolean }) {
  const config: Record<string, { color: string; icon: any; label: string; labelAr: string }> = {
    sent: { color: "bg-blue-500/10 text-blue-600 border-blue-500/20", icon: Send, label: "Sent", labelAr: "مُرسل" },
    delivered: { color: "bg-green-500/10 text-green-600 border-green-500/20", icon: CheckCheck, label: "Delivered", labelAr: "تم التسليم" },
    read: { color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", icon: CheckCheck, label: "Read", labelAr: "مقروء" },
    failed: { color: "bg-red-500/10 text-red-600 border-red-500/20", icon: XCircle, label: "Failed", labelAr: "فشل" },
    pending: { color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20", icon: Clock, label: "Pending", labelAr: "قيد الانتظار" },
  };
  const c = config[status] || config.pending;
  const Icon = c.icon;
  return (
    <Badge variant="outline" className={`${c.color} gap-1`}>
      <Icon className="h-3 w-3" />
      {isRtl ? c.labelAr : c.label}
    </Badge>
  );
}

const messageTypeLabels: Record<string, { ar: string; en: string }> = {
  welcome: { ar: "ترحيب", en: "Welcome" },
  booking_reminder: { ar: "تذكير حجز", en: "Booking" },
  follow_up: { ar: "متابعة", en: "Follow Up" },
  custom: { ar: "مخصص", en: "Custom" },
  property_share: { ar: "مشاركة عقار", en: "Property" },
  payment_reminder: { ar: "تذكير دفع", en: "Payment" },
  booking_approved: { ar: "موافقة حجز", en: "Approved" },
  booking_rejected: { ar: "رفض حجز", en: "Rejected" },
};

const channelLabels: Record<string, { ar: string; en: string }> = {
  click_to_chat: { ar: "رابط واتساب", en: "Click-to-Chat" },
  cloud_api: { ar: "Cloud API", en: "Cloud API" },
  both: { ar: "الكل", en: "Both" },
};

// ─── Inbox Badge (unread count) ─────────────────────────────────────
function InboxBadge({ isRtl, isActive }: { isRtl: boolean; isActive: boolean }) {
  const unread = trpc.waInbox.unreadCount.useQuery(undefined, { refetchInterval: 15000 });
  const count = unread.data?.count ?? 0;
  if (count === 0) return null;
  return (
    <span className={`absolute -top-1.5 ${isRtl ? '-left-1.5' : '-right-1.5'} min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold px-1 ${
      isActive ? 'bg-white text-[#25D366]' : 'bg-red-500 text-white'
    }`}>
      {count > 99 ? '99+' : count}
    </span>
  );
}

// ─── Conversation Status Helpers ────────────────────────────────────
const convStatusConfig: Record<string, { color: string; icon: any; label: string; labelAr: string }> = {
  open: { color: "bg-green-500/10 text-green-600 border-green-500/20", icon: CircleDot, label: "Open", labelAr: "مفتوح" },
  assigned: { color: "bg-blue-500/10 text-blue-600 border-blue-500/20", icon: UserCheck, label: "Assigned", labelAr: "مُعيَّن" },
  resolved: { color: "bg-purple-500/10 text-purple-600 border-purple-500/20", icon: CheckCircle2, label: "Resolved", labelAr: "محلول" },
  closed: { color: "bg-gray-500/10 text-gray-500 border-gray-500/20", icon: Archive, label: "Closed", labelAr: "مغلق" },
};

const priorityConfig: Record<string, { color: string; label: string; labelAr: string }> = {
  normal: { color: "text-muted-foreground", label: "Normal", labelAr: "عادي" },
  high: { color: "text-orange-500", label: "High", labelAr: "عالي" },
  urgent: { color: "text-red-500", label: "Urgent", labelAr: "عاجل" },
};

function get24hWindowInfo(lastInboundAt: string | null | undefined): { isOpen: boolean; hoursLeft: number; label: string; labelAr: string } {
  if (!lastInboundAt) return { isOpen: false, hoursLeft: 0, label: "No inbound", labelAr: "لا رسائل واردة" };
  const diff = Date.now() - new Date(lastInboundAt).getTime();
  const hoursLeft = Math.max(0, 24 - diff / (1000 * 60 * 60));
  if (hoursLeft > 0) return { isOpen: true, hoursLeft, label: `${hoursLeft.toFixed(1)}h left`, labelAr: `${hoursLeft.toFixed(1)} ساعة متبقية` };
  return { isOpen: false, hoursLeft: 0, label: "Window closed", labelAr: "انتهت النافذة" };
}

function formatTimeAgo(dateStr: string | null | undefined, isRtl: boolean): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return isRtl ? "الآن" : "now";
  if (mins < 60) return isRtl ? `منذ ${mins} د` : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return isRtl ? `منذ ${hrs} س` : `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return isRtl ? `منذ ${days} ي` : `${days}d ago`;
}

// ─── Inbox Tab ──────────────────────────────────────────────────────
function InboxTab({ isRtl }: { isRtl: boolean }) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [replyText, setReplyText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();

  // Queries
  const listQuery = trpc.waInbox.list.useQuery(
    { status: statusFilter !== "all" ? statusFilter : undefined, search: searchQuery || undefined, limit: 50 },
    { refetchInterval: 10000 }
  );
  const detailQuery = trpc.waInbox.get.useQuery(
    { id: selectedId! },
    { enabled: !!selectedId, refetchInterval: 5000 }
  );

  // Mutations
  const replyMutation = trpc.waInbox.reply.useMutation({
    onSuccess: () => {
      setReplyText("");
      utils.waInbox.get.invalidate({ id: selectedId! });
      utils.waInbox.list.invalidate();
      utils.waInbox.unreadCount.invalidate();
      toast.success(isRtl ? "تم إرسال الرد" : "Reply sent");
    },
    onError: (err) => toast.error(err.message),
  });
  const updateMutation = trpc.waInbox.update.useMutation({
    onSuccess: () => {
      utils.waInbox.get.invalidate({ id: selectedId! });
      utils.waInbox.list.invalidate();
      toast.success(isRtl ? "تم التحديث" : "Updated");
    },
    onError: (err) => toast.error(err.message),
  });

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [detailQuery.data?.messages]);

  const conversations = (listQuery.data?.items ?? []) as any[];
  const total = listQuery.data?.total ?? 0;
  const conv = detailQuery.data?.conversation as any;
  const msgs = (detailQuery.data?.messages ?? []) as any[];
  const windowInfo = conv ? get24hWindowInfo(conv.lastInboundAt) : null;

  const handleReply = () => {
    if (!replyText.trim() || !selectedId) return;
    replyMutation.mutate({ conversationId: selectedId, content: replyText.trim() });
  };

  const handleStatusChange = (status: string) => {
    if (!selectedId) return;
    updateMutation.mutate({ id: selectedId, status: status as any });
  };

  return (
    <div className="flex gap-0 border rounded-xl overflow-hidden" style={{ height: "calc(100vh - 16rem)" }}>
      {/* Conversation List Panel */}
      <div className={`w-full md:w-96 shrink-0 flex flex-col border-e bg-card/50 ${selectedId ? 'hidden md:flex' : 'flex'}`}>
        {/* Filters */}
        <div className="p-3 border-b space-y-2">
          <div className="relative">
            <Search className="absolute top-2.5 start-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={isRtl ? "بحث بالرقم أو الاسم..." : "Search phone or name..."}
              className="ps-9 h-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            {["all", "open", "assigned", "resolved", "closed"].map(s => (
              <Button key={s} size="sm" variant={statusFilter === s ? "default" : "ghost"}
                className={`h-7 text-xs px-2 ${statusFilter === s ? 'bg-[#25D366] hover:bg-[#20BD5A] text-white' : ''}`}
                onClick={() => setStatusFilter(s)}>
                {s === "all" ? (isRtl ? "الكل" : "All") : (isRtl ? convStatusConfig[s]?.labelAr : convStatusConfig[s]?.label)}
              </Button>
            ))}
          </div>
        </div>

        {/* Conversation List */}
        <ScrollArea className="flex-1">
          {listQuery.isLoading ? (
            <div className="p-4 space-y-3">
              {[1,2,3,4].map(i => <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />)}
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Inbox className="h-12 w-12 mb-3 opacity-40" />
              <p className="text-sm">{isRtl ? "لا توجد محادثات" : "No conversations"}</p>
            </div>
          ) : (
            <div className="divide-y">
              {conversations.map((c: any) => {
                const isSelected = selectedId === c.id;
                const statusCfg = convStatusConfig[c.status] || convStatusConfig.open;
                const StatusIcon = statusCfg.icon;
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={`p-3 cursor-pointer transition-all hover:bg-muted/50 ${
                      isSelected ? 'bg-[#25D366]/5 border-s-2 border-s-[#25D366]' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className="relative shrink-0">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                          c.unreadCount > 0 ? 'bg-[#25D366]/15 text-[#25D366]' : 'bg-muted text-muted-foreground'
                        }`}>
                          {c.contactName ? c.contactName.charAt(0).toUpperCase() : <Phone className="h-4 w-4" />}
                        </div>
                        {c.unreadCount > 0 && (
                          <span className="absolute -top-0.5 -end-0.5 w-4 h-4 bg-[#25D366] rounded-full flex items-center justify-center text-[9px] text-white font-bold">
                            {c.unreadCount > 9 ? '9+' : c.unreadCount}
                          </span>
                        )}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-sm truncate ${c.unreadCount > 0 ? 'font-bold' : 'font-medium'}`}>
                            {c.contactName || c.contactPhone}
                          </span>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {formatTimeAgo(c.lastMessageAt, isRtl)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <StatusIcon className={`h-3 w-3 shrink-0 ${statusCfg.color.includes('green') ? 'text-green-500' : statusCfg.color.includes('blue') ? 'text-blue-500' : statusCfg.color.includes('purple') ? 'text-purple-500' : 'text-gray-400'}`} />
                          <span className="text-xs text-muted-foreground truncate" dir="ltr">
                            {c.contactName ? c.contactPhone : ''}
                          </span>
                        </div>
                        {c.priority !== 'normal' && (
                          <Badge variant="outline" className={`mt-1 text-[10px] h-4 ${priorityConfig[c.priority]?.color}`}>
                            {isRtl ? priorityConfig[c.priority]?.labelAr : priorityConfig[c.priority]?.label}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {total > conversations.length && (
            <div className="p-3 text-center">
              <p className="text-xs text-muted-foreground">
                {isRtl ? `عرض ${conversations.length} من ${total}` : `Showing ${conversations.length} of ${total}`}
              </p>
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Chat / Detail Panel */}
      <div className={`flex-1 flex flex-col bg-background ${!selectedId ? 'hidden md:flex' : 'flex'}`}>
        {selectedId && conv ? (
          <>
            {/* Chat Header */}
            <div className="p-3 border-b bg-card flex items-center gap-3">
              <Button variant="ghost" size="icon" className="md:hidden h-8 w-8" onClick={() => setSelectedId(null)}>
                {isRtl ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
              </Button>
              <div className="w-9 h-9 rounded-full bg-[#25D366]/15 flex items-center justify-center text-[#25D366] font-bold text-sm">
                {conv.contactName ? conv.contactName.charAt(0).toUpperCase() : <Phone className="h-4 w-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm truncate">{conv.contactName || conv.contactPhone}</span>
                  {conv.userId && (
                    <Badge variant="outline" className="text-[10px] h-4 gap-0.5">
                      <User className="h-2.5 w-2.5" /> #{conv.userId}
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground" dir="ltr">{conv.contactPhone}</span>
              </div>
              {/* 24h Window Indicator */}
              {windowInfo && (
                <Badge variant="outline" className={`gap-1 text-xs ${
                  windowInfo.isOpen ? 'text-green-600 border-green-300 bg-green-50 dark:bg-green-950/20' : 'text-red-500 border-red-300 bg-red-50 dark:bg-red-950/20'
                }`}>
                  <Timer className="h-3 w-3" />
                  {isRtl ? windowInfo.labelAr : windowInfo.label}
                </Badge>
              )}
              {/* Status Actions */}
              <Select value={conv.status} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-auto h-8 text-xs gap-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(convStatusConfig).map(([k, v]) => (
                    <SelectItem key={k} value={k} className="text-xs">
                      {isRtl ? v.labelAr : v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              {detailQuery.isLoading ? (
                <div className="space-y-3">
                  {[1,2,3].map(i => <div key={i} className="h-12 w-48 bg-muted/50 rounded-xl animate-pulse" />)}
                </div>
              ) : msgs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <MessageCircle className="h-10 w-10 mb-2 opacity-30" />
                  <p className="text-sm">{isRtl ? "لا توجد رسائل بعد" : "No messages yet"}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {msgs.map((msg: any) => {
                    const isInbound = msg.direction === "inbound";
                    return (
                      <div key={msg.id} className={`flex ${isInbound ? 'justify-start' : 'justify-end'}`}>
                        <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                          isInbound
                            ? 'bg-muted rounded-es-sm'
                            : 'bg-[#25D366] text-white rounded-ee-sm'
                        }`}>
                          {/* Media indicator */}
                          {msg.messageType !== 'text' && msg.messageType && (
                            <div className={`text-[10px] mb-1 font-medium uppercase tracking-wider ${
                              isInbound ? 'text-muted-foreground' : 'text-white/70'
                            }`}>
                              {msg.messageType}
                            </div>
                          )}
                          {msg.mediaUrl && (
                            <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer"
                              className={`text-xs underline block mb-1 ${isInbound ? 'text-blue-500' : 'text-white/80'}`}>
                              {isRtl ? 'عرض المرفق' : 'View attachment'}
                            </a>
                          )}
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          <div className={`flex items-center gap-1.5 mt-1 ${isInbound ? '' : 'justify-end'}`}>
                            <span className={`text-[10px] ${isInbound ? 'text-muted-foreground' : 'text-white/60'}`}>
                              {new Date(msg.createdAt).toLocaleTimeString(isRtl ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {!isInbound && msg.sentByName && (
                              <span className="text-[10px] text-white/50">— {msg.sentByName}</span>
                            )}
                            {!isInbound && (
                              <CheckCheck className={`h-3 w-3 ${
                                msg.status === 'delivered' || msg.status === 'read' ? 'text-white' : 'text-white/40'
                              }`} />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Reply Input */}
            <div className="p-3 border-t bg-card">
              {windowInfo?.isOpen ? (
                <div className="flex gap-2">
                  <Input
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={isRtl ? "اكتب ردك هنا..." : "Type your reply..."}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleReply()}
                    className="flex-1"
                    disabled={replyMutation.isPending}
                  />
                  <Button
                    onClick={handleReply}
                    disabled={!replyText.trim() || replyMutation.isPending}
                    size="icon"
                    className="bg-[#25D366] hover:bg-[#20BD5A] text-white border-0"
                  >
                    {replyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                  <Timer className="h-4 w-4 text-amber-500 shrink-0" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    {isRtl
                      ? 'نافذة الـ 24 ساعة انتهت. استخدم تبويب "إرسال" لإرسال قالب رسالة أولاً.'
                      : 'The 24-hour window has expired. Use the "Send" tab to send a template message first.'}
                  </p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-[#25D366]/10 flex items-center justify-center mx-auto mb-4">
                <Inbox className="h-10 w-10 text-[#25D366]/50" />
              </div>
              <p className="text-muted-foreground font-medium">
                {isRtl ? 'اختر محادثة لعرض الرسائل' : 'Select a conversation to view messages'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {isRtl ? `${total} محادثة` : `${total} conversation${total !== 1 ? 's' : ''}`}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


// ─── Settings Tab ───────────────────────────────────────────────────
function SettingsTab({ isRtl }: { isRtl: boolean }) {
  const configQuery = trpc.admin.whatsapp.isConfigured.useQuery();
  const integrationQuery = trpc.admin.integration.list.useQuery();
  const updateConfig = trpc.admin.integration.update.useMutation();
  const testConnection = trpc.admin.integration.testConnection.useMutation();

  const [showSecrets, setShowSecrets] = useState(false);
  const [testing, setTesting] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});

  const whatsappConfig = useMemo(() => {
    if (!integrationQuery.data) return null;
    return (integrationQuery.data as any[]).find((i: any) => i.key === "whatsapp");
  }, [integrationQuery.data]);

  const config = whatsappConfig?.config || {};
  const getValue = (key: string) => formData[key] ?? (config as any)[key] ?? "";
  const maskValue = (val: string) => {
    if (!val || val.length < 8) return "••••••••";
    return val.substring(0, 4) + "••••" + val.substring(val.length - 4);
  };

  const handleSave = async () => {
    if (!whatsappConfig) return;
    try {
      await updateConfig.mutateAsync({ key: "whatsapp", config: { ...(config as any), ...formData } });
      toast.success(isRtl ? "تم حفظ إعدادات واتساب بنجاح" : "WhatsApp settings saved");
      integrationQuery.refetch();
      configQuery.refetch();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const result = await testConnection.mutateAsync({ key: "whatsapp" });
      if (result.success) {
        toast.success(isRtl ? "تم الاتصال بواتساب Cloud API بنجاح" : "Connected to WhatsApp Cloud API");
      } else {
        toast.error(result.error || (isRtl ? "تعذر الاتصال" : "Connection failed"));
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-border/40">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">{isRtl ? "حالة الاتصال" : "Connection Status"}</CardTitle>
              <CardDescription>WhatsApp Business Cloud API</CardDescription>
            </div>
            {configQuery.data?.configured ? (
              <Badge className="bg-green-100 text-green-800 border-green-200">
                <CheckCircle2 className="w-3.5 h-3.5 ml-1" /> {isRtl ? "متصل" : "Connected"}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-amber-600 border-amber-300">
                <AlertTriangle className="w-3.5 h-3.5 ml-1" /> {isRtl ? "غير مُعد" : "Not Configured"}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="outline" size="sm" onClick={handleTest} disabled={testing}>
              {testing ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <RefreshCw className="w-4 h-4 ml-2" />}
              {isRtl ? "اختبار الاتصال" : "Test Connection"}
            </Button>
            <p className="text-sm text-muted-foreground">
              Webhook URL: <code className="bg-muted px-1.5 py-0.5 rounded text-xs">/api/webhooks/whatsapp</code>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* WhatsApp Support/Escalation Email */}
      <Card className="border-border/40">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageCircle className="w-5 h-5" style={{ color: WA_GREEN }} />
            {isRtl ? "بريد دعم واتساب" : "WhatsApp Support Email"}
          </CardTitle>
          <CardDescription>
            {isRtl
              ? "بريد الدعم والتصعيد لعمليات واتساب — يستقبل إشعارات الرسائل الواردة"
              : "Support & escalation email for WhatsApp operations — receives inbound message notifications"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 flex-wrap">
            <code className="bg-muted px-3 py-1.5 rounded text-sm font-mono" dir="ltr">whatsapp@monthlykey.com</code>
            <Badge variant="outline" className="text-green-600 border-green-300">
              <CheckCircle2 className="w-3.5 h-3.5 ml-1" />
              {isRtl ? "مُعد عبر Taqnyat" : "Configured via Taqnyat"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {isRtl
              ? "يمكن تعديل هذا البريد من التكاملات ← تقنيات واتساب ← بريد الدعم والتصعيد"
              : "Editable from Integrations → Taqnyat WhatsApp → Support/Escalation Email"}
          </p>
        </CardContent>
      </Card>

      <Card className="border-border/40">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">{isRtl ? "إعدادات API" : "API Configuration"}</CardTitle>
              <CardDescription>{isRtl ? "بيانات الاتصال بـ Meta WhatsApp Business API" : "Meta WhatsApp Business API credentials"}</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowSecrets(!showSecrets)}>
              {showSecrets ? <EyeOff className="w-4 h-4 ml-1" /> : <Eye className="w-4 h-4 ml-1" />}
              {showSecrets ? (isRtl ? "إخفاء" : "Hide") : (isRtl ? "إظهار" : "Show")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Phone Number ID</Label>
              <Input dir="ltr" placeholder="123456789012345" value={getValue("phoneNumberId")}
                onChange={(e) => setFormData({ ...formData, phoneNumberId: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Business Account ID</Label>
              <Input dir="ltr" placeholder="987654321098765" value={getValue("businessAccountId")}
                onChange={(e) => setFormData({ ...formData, businessAccountId: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Access Token</Label>
              <Input dir="ltr" type={showSecrets ? "text" : "password"}
                placeholder={showSecrets ? "EAABx..." : "••••••••"}
                value={showSecrets ? getValue("accessToken") : (getValue("accessToken") ? maskValue(getValue("accessToken")) : "")}
                onChange={(e) => setFormData({ ...formData, accessToken: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Webhook Verify Token</Label>
              <Input dir="ltr" type={showSecrets ? "text" : "password"}
                placeholder={showSecrets ? "my_verify_token" : "••••••••"}
                value={showSecrets ? getValue("webhookVerifyToken") : (getValue("webhookVerifyToken") ? maskValue(getValue("webhookVerifyToken")) : "")}
                onChange={(e) => setFormData({ ...formData, webhookVerifyToken: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{isRtl ? "اسم المرسل" : "Sender Name"}</Label>
              <Input placeholder="Monthly Key" value={getValue("senderName")}
                onChange={(e) => setFormData({ ...formData, senderName: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{isRtl ? "رقم الواتساب" : "Display Phone"}</Label>
              <Input dir="ltr" placeholder="+966XXXXXXXXX" value={getValue("displayPhone")}
                onChange={(e) => setFormData({ ...formData, displayPhone: e.target.value })} />
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <Button onClick={handleSave} disabled={updateConfig.isPending}>
              {updateConfig.isPending && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
              {isRtl ? "حفظ الإعدادات" : "Save Settings"}
            </Button>
            <a href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started" target="_blank" rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline flex items-center gap-1">
              <ExternalLink className="w-3.5 h-3.5" /> {isRtl ? "دليل الإعداد" : "Setup Guide"}
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Send Tab ───────────────────────────────────────────────────────
function SendTab({ isRtl }: { isRtl: boolean }) {
  const [recipientPhone, setRecipientPhone] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [selectedType, setSelectedType] = useState("custom");
  const [channel, setChannel] = useState<"click_to_chat" | "cloud_api">("click_to_chat");
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [userSearch, setUserSearch] = useState("");

  const sendMutation = trpc.admin.whatsapp.send.useMutation();
  const configQuery = trpc.admin.whatsapp.isConfigured.useQuery();
  const templatesQuery = trpc.admin.whatsapp.templates.useQuery();
  const usersQuery = trpc.admin.users.useQuery({ limit: 50, search: userSearch }, { enabled: showUserPicker });

  const handleSelectUser = (u: any) => {
    setRecipientPhone(u.phone || u.whatsapp || "");
    setRecipientName(u.displayName || u.name || u.nameAr || "");
    setShowUserPicker(false);
  };

  const handleSelectTemplate = (tpl: any) => {
    setSelectedType(tpl.messageType || "custom");
    setMessageBody(isRtl ? (tpl.bodyAr || tpl.bodyEn || "") : (tpl.bodyEn || tpl.bodyAr || ""));
  };

  const handleSend = async () => {
    if (!recipientPhone || !messageBody) {
      toast.error(isRtl ? "يرجى إدخال رقم الهاتف والرسالة" : "Enter phone and message");
      return;
    }
    let phone = recipientPhone.replace(/[^0-9]/g, "");
    if (phone.startsWith("05")) phone = "966" + phone.substring(1);
    if (phone.startsWith("5") && phone.length === 9) phone = "966" + phone;
    if (!phone.startsWith("966") && !phone.startsWith("+")) phone = "966" + phone;

    if (channel === "click_to_chat") {
      const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(messageBody)}`;
      window.open(waUrl, "_blank");
    }

    try {
      await sendMutation.mutateAsync({
        recipientPhone: phone,
        recipientName: recipientName || undefined,
        messageType: selectedType as any,
        messageBody,
        channel,
      });
      toast.success(channel === "cloud_api"
        ? (isRtl ? "تم إرسال الرسالة عبر Cloud API" : "Sent via Cloud API")
        : (isRtl ? "تم فتح واتساب وتسجيل الرسالة" : "WhatsApp opened & logged"));
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const templates = (templatesQuery.data || []) as any[];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <div className="lg:col-span-3 space-y-6">
        <Card className="border-border/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5" style={{ color: WA_GREEN }} />
              {isRtl ? "المستلم" : "Recipient"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-1">
                <Label className="text-xs mb-1 block">{isRtl ? "رقم الهاتف" : "Phone"}</Label>
                <Input dir="ltr" placeholder="+966XXXXXXXXX" value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)} />
              </div>
              <div className="flex-1">
                <Label className="text-xs mb-1 block">{isRtl ? "الاسم" : "Name"}</Label>
                <Input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowUserPicker(!showUserPicker)}>
              <Search className="w-4 h-4 ml-1" /> {isRtl ? "اختيار من المستخدمين" : "Pick from users"}
            </Button>
            {showUserPicker && (
              <div className="border rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
                <Input placeholder={isRtl ? "بحث..." : "Search..."} value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)} />
                {(usersQuery.data as any[])?.map((u: any) => (
                  <button key={u.id} onClick={() => handleSelectUser(u)}
                    className="w-full text-right p-2 hover:bg-muted rounded text-sm flex items-center justify-between">
                    <span>{u.displayName || u.name || u.nameAr || "—"}</span>
                    <span dir="ltr" className="text-xs text-muted-foreground">{u.phone || u.whatsapp || "—"}</span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageCircle className="h-5 w-5" style={{ color: WA_GREEN }} />
              {isRtl ? "الرسالة" : "Message"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block">{isRtl ? "القناة" : "Channel"}</Label>
                <Select value={channel} onValueChange={(v: any) => setChannel(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="click_to_chat">{isRtl ? "رابط واتساب (يدوي)" : "Click-to-Chat"}</SelectItem>
                    <SelectItem value="cloud_api" disabled={!configQuery.data?.configured}>
                      Cloud API {!configQuery.data?.configured && (isRtl ? "— غير مُعد" : "— Not configured")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs mb-1 block">{isRtl ? "النوع" : "Type"}</Label>
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(messageTypeLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{isRtl ? v.ar : v.en}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Textarea value={messageBody} onChange={(e) => setMessageBody(e.target.value)}
              rows={5} placeholder={isRtl ? "اكتب رسالتك هنا..." : "Type your message..."} />
            <div className="flex gap-3">
              <Button onClick={handleSend} disabled={sendMutation.isPending}
                className="bg-[#25D366] hover:bg-[#20BD5A] text-white">
                {sendMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Send className="w-4 h-4 ml-2" />}
                {isRtl ? "إرسال" : "Send"}
              </Button>
              <Button variant="outline" onClick={() => { navigator.clipboard.writeText(messageBody); toast.success(isRtl ? "تم النسخ" : "Copied"); }}>
                <Copy className="w-4 h-4 ml-1" /> {isRtl ? "نسخ" : "Copy"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Templates Sidebar */}
      <div className="lg:col-span-2">
        <Card className="border-border/40 sticky top-4">
          <CardHeader>
            <CardTitle className="text-base">{isRtl ? "القوالب السريعة" : "Quick Templates"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[60vh] overflow-y-auto">
            {templates.filter((t: any) => t.isActive).map((tpl: any) => (
              <button key={tpl.id} onClick={() => handleSelectTemplate(tpl)}
                className="w-full text-right p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm">{isRtl ? tpl.nameAr : tpl.nameEn}</span>
                  <Badge variant="secondary" className="text-xs">{messageTypeLabels[tpl.messageType]?.[isRtl ? "ar" : "en"] || tpl.messageType}</Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{isRtl ? (tpl.bodyAr || tpl.bodyEn) : (tpl.bodyEn || tpl.bodyAr)}</p>
              </button>
            ))}
            {templates.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                {isRtl ? "جاري تحميل القوالب..." : "Loading templates..."}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Templates Tab ──────────────────────────────────────────────────
function TemplatesTab({ isRtl }: { isRtl: boolean }) {
  const templatesQuery = trpc.admin.whatsapp.templates.useQuery();
  const createTemplate = trpc.admin.whatsapp.createTemplate.useMutation();
  const updateTemplate = trpc.admin.whatsapp.updateTemplate.useMutation();
  const deleteTemplate = trpc.admin.whatsapp.deleteTemplate.useMutation();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    templateKey: "", nameEn: "", nameAr: "", metaTemplateName: "",
    languageCode: "ar", messageType: "custom" as string, bodyEn: "", bodyAr: "",
    variableKeys: "", channel: "both" as string,
  });

  const handleCreate = async () => {
    try {
      await createTemplate.mutateAsync({
        ...newTemplate,
        messageType: newTemplate.messageType as any,
        channel: newTemplate.channel as any,
        variableKeys: newTemplate.variableKeys ? newTemplate.variableKeys.split(",").map(s => s.trim()).filter(Boolean) : undefined,
      });
      toast.success(isRtl ? "تم إنشاء القالب" : "Template created");
      setShowCreateDialog(false);
      setNewTemplate({ templateKey: "", nameEn: "", nameAr: "", metaTemplateName: "", languageCode: "ar", messageType: "custom", bodyEn: "", bodyAr: "", variableKeys: "", channel: "both" });
      templatesQuery.refetch();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleToggleActive = async (id: number, currentActive: boolean) => {
    try {
      await updateTemplate.mutateAsync({ id, isActive: !currentActive });
      templatesQuery.refetch();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(isRtl ? "هل أنت متأكد من حذف هذا القالب؟" : "Delete this template?")) return;
    try {
      await deleteTemplate.mutateAsync({ id });
      toast.success(isRtl ? "تم الحذف" : "Deleted");
      templatesQuery.refetch();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const templates = (templatesQuery.data || []) as any[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{isRtl ? "قوالب الرسائل" : "Message Templates"} ({templates.length})</h3>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 ml-2" /> {isRtl ? "قالب جديد" : "New Template"}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{isRtl ? "إنشاء قالب جديد" : "Create New Template"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">{isRtl ? "مفتاح القالب" : "Template Key"}</Label>
                  <Input dir="ltr" placeholder="my_template" value={newTemplate.templateKey}
                    onChange={(e) => setNewTemplate({ ...newTemplate, templateKey: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{isRtl ? "النوع" : "Type"}</Label>
                  <Select value={newTemplate.messageType} onValueChange={(v) => setNewTemplate({ ...newTemplate, messageType: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(messageTypeLabels).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{isRtl ? v.ar : v.en}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">{isRtl ? "الاسم (عربي)" : "Name (Arabic)"}</Label>
                  <Input value={newTemplate.nameAr} onChange={(e) => setNewTemplate({ ...newTemplate, nameAr: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{isRtl ? "الاسم (إنجليزي)" : "Name (English)"}</Label>
                  <Input dir="ltr" value={newTemplate.nameEn} onChange={(e) => setNewTemplate({ ...newTemplate, nameEn: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Meta Template Name</Label>
                  <Input dir="ltr" placeholder={isRtl ? "اختياري — لـ Cloud API" : "Optional — for Cloud API"}
                    value={newTemplate.metaTemplateName}
                    onChange={(e) => setNewTemplate({ ...newTemplate, metaTemplateName: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{isRtl ? "القناة" : "Channel"}</Label>
                  <Select value={newTemplate.channel} onValueChange={(v) => setNewTemplate({ ...newTemplate, channel: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(channelLabels).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{isRtl ? v.ar : v.en}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{isRtl ? "نص الرسالة (عربي)" : "Body (Arabic)"}</Label>
                <Textarea value={newTemplate.bodyAr} onChange={(e) => setNewTemplate({ ...newTemplate, bodyAr: e.target.value })}
                  placeholder={isRtl ? "مرحباً {name}! ..." : "مرحباً {name}! ..."} rows={3} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{isRtl ? "نص الرسالة (إنجليزي)" : "Body (English)"}</Label>
                <Textarea dir="ltr" value={newTemplate.bodyEn} onChange={(e) => setNewTemplate({ ...newTemplate, bodyEn: e.target.value })}
                  placeholder="Hi {name}! ..." rows={3} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{isRtl ? "المتغيرات (مفصولة بفواصل)" : "Variables (comma-separated)"}</Label>
                <Input dir="ltr" placeholder="name, property, rent" value={newTemplate.variableKeys}
                  onChange={(e) => setNewTemplate({ ...newTemplate, variableKeys: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>{isRtl ? "إلغاء" : "Cancel"}</Button>
              <Button onClick={handleCreate} disabled={createTemplate.isPending || !newTemplate.templateKey || !newTemplate.nameAr}>
                {createTemplate.isPending && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                {isRtl ? "إنشاء" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3">
        {templates.map((t: any) => (
          <Card key={t.id} className={`border-border/40 ${!t.isActive ? "opacity-60" : ""}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h4 className="font-medium text-sm">{isRtl ? t.nameAr : t.nameEn}</h4>
                    <Badge variant="outline" className="text-xs">{messageTypeLabels[t.messageType]?.[isRtl ? "ar" : "en"] || t.messageType}</Badge>
                    <Badge variant="outline" className="text-xs">{channelLabels[t.channel]?.[isRtl ? "ar" : "en"] || t.channel}</Badge>
                    {t.metaTemplateName && <Badge className="bg-green-100 text-green-800 text-xs">Cloud API</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">
                    {isRtl ? t.nameEn : t.nameAr} — <code className="bg-muted px-1 rounded">{t.templateKey}</code>
                  </p>
                  <p className="text-sm text-muted-foreground line-clamp-2 whitespace-pre-line">
                    {isRtl ? (t.bodyAr || t.bodyEn || "—") : (t.bodyEn || t.bodyAr || "—")}
                  </p>
                  {t.variableKeys && (() => {
                    try {
                      const vars = typeof t.variableKeys === "string" ? JSON.parse(t.variableKeys) : t.variableKeys;
                      return Array.isArray(vars) && vars.length > 0 ? (
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          <span className="text-xs text-muted-foreground">{isRtl ? "المتغيرات:" : "Variables:"}</span>
                          {vars.map((v: string) => <Badge key={v} variant="secondary" className="text-xs px-1">{`{${v}}`}</Badge>)}
                        </div>
                      ) : null;
                    } catch { return null; }
                  })()}
                </div>
                <div className="flex items-center gap-1 mr-3">
                  <Switch checked={!!t.isActive} onCheckedChange={() => handleToggleActive(t.id, !!t.isActive)} />
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(t.id)}>
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {templates.length === 0 && (
          <Card className="border-border/40">
            <CardContent className="p-8 text-center text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>{isRtl ? "جاري تحميل القوالب الافتراضية..." : "Loading default templates..."}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ─── Logs Tab ───────────────────────────────────────────────────────
function LogsTab({ isRtl }: { isRtl: boolean }) {
  const [filters, setFilters] = useState({ messageType: "", status: "" });
  const logsQuery = trpc.admin.whatsapp.list.useQuery({
    limit: 50, offset: 0,
    messageType: filters.messageType || undefined,
    status: filters.status || undefined,
  });
  const statsQuery = trpc.admin.whatsapp.stats.useQuery();

  const logs = (() => {
    const d = logsQuery.data;
    if (!d) return [];
    if (Array.isArray(d)) return d;
    if ((d as any).items) return (d as any).items;
    return [];
  })();
  const stats = (statsQuery.data || {}) as any;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: isRtl ? "إجمالي" : "Total", value: stats.totalMessages || stats.total || 0, color: "text-foreground" },
          { label: isRtl ? "مُرسلة" : "Sent", value: stats.sent || 0, color: "text-green-600" },
          { label: isRtl ? "فشلت" : "Failed", value: stats.failed || 0, color: "text-red-600" },
          { label: isRtl ? "آخر 24 ساعة" : "Last 24h", value: stats.last24h || 0, color: "text-blue-600" },
        ].map((s) => (
          <Card key={s.label} className="border-border/40">
            <CardContent className="p-3 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Select value={filters.status || "all"} onValueChange={(v) => setFilters({ ...filters, status: v === "all" ? "" : v })}>
          <SelectTrigger className="w-40"><SelectValue placeholder={isRtl ? "الحالة" : "Status"} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{isRtl ? "الكل" : "All"}</SelectItem>
            <SelectItem value="sent">{isRtl ? "مُرسل" : "Sent"}</SelectItem>
            <SelectItem value="delivered">{isRtl ? "تم التسليم" : "Delivered"}</SelectItem>
            <SelectItem value="read">{isRtl ? "مقروء" : "Read"}</SelectItem>
            <SelectItem value="failed">{isRtl ? "فشل" : "Failed"}</SelectItem>
            <SelectItem value="pending">{isRtl ? "قيد الانتظار" : "Pending"}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.messageType || "all"} onValueChange={(v) => setFilters({ ...filters, messageType: v === "all" ? "" : v })}>
          <SelectTrigger className="w-40"><SelectValue placeholder={isRtl ? "النوع" : "Type"} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{isRtl ? "الكل" : "All"}</SelectItem>
            {Object.entries(messageTypeLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>{isRtl ? v.ar : v.en}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => logsQuery.refetch()}>
          <RefreshCw className="w-4 h-4 ml-1" /> {isRtl ? "تحديث" : "Refresh"}
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden border-border/40">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-right p-3 font-medium">{isRtl ? "المستلم" : "Recipient"}</th>
              <th className="text-right p-3 font-medium">{isRtl ? "النوع" : "Type"}</th>
              <th className="text-right p-3 font-medium">{isRtl ? "القناة" : "Channel"}</th>
              <th className="text-right p-3 font-medium">{isRtl ? "الحالة" : "Status"}</th>
              <th className="text-right p-3 font-medium">{isRtl ? "الرسالة" : "Message"}</th>
              <th className="text-right p-3 font-medium">{isRtl ? "التاريخ" : "Date"}</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log: any) => (
              <tr key={log.id} className="border-t hover:bg-muted/30">
                <td className="p-3">
                  <div className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                    <span dir="ltr" className="text-xs">{log.recipientPhone}</span>
                  </div>
                  {log.recipientName && <p className="text-xs text-muted-foreground">{log.recipientName}</p>}
                </td>
                <td className="p-3">
                  <Badge variant="secondary" className="text-xs">
                    {messageTypeLabels[log.messageType]?.[isRtl ? "ar" : "en"] || log.messageType}
                  </Badge>
                </td>
                <td className="p-3">
                  <Badge variant={log.channel === "cloud_api" ? "default" : "secondary"} className="text-xs">
                    {channelLabels[log.channel]?.[isRtl ? "ar" : "en"] || log.channel}
                  </Badge>
                </td>
                <td className="p-3"><StatusBadge status={log.status} isRtl={isRtl} /></td>
                <td className="p-3">
                  <p className="text-xs text-muted-foreground line-clamp-1 max-w-[200px]">{log.messageBody}</p>
                  {log.errorMessage && <p className="text-xs text-red-500">{log.errorMessage}</p>}
                </td>
                <td className="p-3 text-xs text-muted-foreground">
                  {log.sentAt ? new Date(log.sentAt).toLocaleString(isRtl ? "ar-SA" : "en-US") : "—"}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                  <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  {isRtl ? "لا توجد رسائل بعد" : "No messages yet"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Exported Send Dialog (reusable from other pages) ───────────────
export function SendWhatsAppDialog({ trigger, defaultPhone, defaultName, defaultBookingId, defaultPropertyId }: {
  trigger: React.ReactNode;
  defaultPhone?: string;
  defaultName?: string;
  defaultBookingId?: number;
  defaultPropertyId?: number;
}) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState(defaultPhone || "");
  const [name, setName] = useState(defaultName || "");
  const [message, setMessage] = useState("");
  const [channel, setChannel] = useState<"click_to_chat" | "cloud_api">("click_to_chat");
  const [messageType, setMessageType] = useState("custom");

  const sendMutation = trpc.admin.whatsapp.send.useMutation();
  const configQuery = trpc.admin.whatsapp.isConfigured.useQuery();

  const handleSend = async () => {
    if (!phone || !message) {
      toast.error("يرجى إدخال رقم الهاتف والرسالة");
      return;
    }
    let cleanPhone = phone.replace(/[^0-9]/g, "");
    if (cleanPhone.startsWith("05")) cleanPhone = "966" + cleanPhone.substring(1);
    if (cleanPhone.startsWith("5") && cleanPhone.length === 9) cleanPhone = "966" + cleanPhone;

    if (channel === "click_to_chat") {
      window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, "_blank");
    }

    try {
      await sendMutation.mutateAsync({
        recipientPhone: cleanPhone,
        recipientName: name || undefined,
        messageBody: message,
        channel,
        messageType: messageType as any,
        bookingId: defaultBookingId,
        propertyId: defaultPropertyId,
      });
      toast.success(channel === "cloud_api" ? "تم الإرسال عبر Cloud API" : "تم التسجيل");
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) { setPhone(defaultPhone || ""); setName(defaultName || ""); } }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5" style={{ color: WA_GREEN }} />
            إرسال رسالة واتساب
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">رقم الهاتف</Label><Input dir="ltr" placeholder="+966XXXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            <div><Label className="text-xs">الاسم</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">القناة</Label>
              <Select value={channel} onValueChange={(v: any) => setChannel(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="click_to_chat">رابط واتساب</SelectItem>
                  <SelectItem value="cloud_api" disabled={!configQuery.data?.configured}>Cloud API</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">النوع</Label>
              <Select value={messageType} onValueChange={setMessageType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(messageTypeLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.ar}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label className="text-xs">الرسالة</Label><Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
          <Button onClick={handleSend} disabled={sendMutation.isPending} className="bg-[#25D366] hover:bg-[#20BD5A] text-white">
            {sendMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Send className="w-4 h-4 ml-2" />}
            إرسال
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────
export default function AdminWhatsApp() {
  const { t, lang } = useI18n();
  const { user, isAuthenticated, loading } = useAuth();
  const isRtl = lang === "ar";
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;

  const [activeTab, setActiveTab] = useState<"inbox" | "settings" | "send" | "templates" | "logs">("inbox");

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8" /></div>;
  if (!isAuthenticated) { window.location.href = getLoginUrl(); return null; }
  if (user?.role !== "admin") {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center p-4">
          <Card className="max-w-md w-full"><CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">{isRtl ? "غير مصرح" : "Unauthorized"}</h2>
          </CardContent></Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <SEOHead title="WhatsApp" titleAr="واتساب" path="/admin/whatsapp" noindex />
      <div className="container py-8 max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="p-2.5 rounded-xl" style={{ background: `${WA_GREEN}20` }}>
            <MessageCircle className="h-6 w-6" style={{ color: WA_GREEN }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{isRtl ? "واتساب" : "WhatsApp"}</h1>
            <p className="text-muted-foreground text-sm">{isRtl ? "Cloud API + Click-to-Chat — إدارة الرسائل والقوالب" : "Cloud API + Click-to-Chat — Messages & Templates"}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-border/40 pb-3 flex-wrap">
          {[
            { id: "inbox" as const, label: isRtl ? "صندوق الوارد" : "Inbox", icon: MessageCircle },
            { id: "send" as const, label: isRtl ? "إرسال" : "Send", icon: Send },
            { id: "templates" as const, label: isRtl ? "القوالب" : "Templates", icon: FileText },
            { id: "logs" as const, label: isRtl ? "السجلات" : "Logs", icon: Clock },
            { id: "settings" as const, label: isRtl ? "الإعدادات" : "Settings", icon: Settings },
          ].map(tab => (
            <Button key={tab.id}
              variant={activeTab === tab.id ? "default" : "ghost"}
              className={`gap-2 relative ${activeTab === tab.id ? "bg-[#25D366] hover:bg-[#20BD5A] text-white" : ""}`}
              onClick={() => setActiveTab(tab.id)}>
              <tab.icon className="h-4 w-4" />
              {tab.label}
              {tab.id === "inbox" && <InboxBadge isRtl={isRtl} isActive={activeTab === "inbox"} />}
            </Button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "inbox" && <InboxTab isRtl={isRtl} />}
        {activeTab === "settings" && <SettingsTab isRtl={isRtl} />}
        {activeTab === "send" && <SendTab isRtl={isRtl} />}
        {activeTab === "templates" && <TemplatesTab isRtl={isRtl} />}
        {activeTab === "logs" && <LogsTab isRtl={isRtl} />}
      </div>
    </DashboardLayout>
  );
}
