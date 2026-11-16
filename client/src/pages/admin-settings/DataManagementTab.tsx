import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select } from "@/components/ui/select";
import { toast } from "sonner";
import { useState } from "react";
import { Users, RefreshCw, Trash2 } from "lucide-react";

export function DataManagementTab({ lang }: { lang: string }) {
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [purgeResult, setPurgeResult] = useState<Record<string, number> | null>(null);

  const purgeMutation = trpc.admin.purgeTestData.useMutation({
    onSuccess: (data: any) => {
      toast.success(data.message || (lang === "ar" ? "تم مسح البيانات بنجاح" : "Data purged successfully"));
      setPurgeResult(data.purged);
      setConfirmPhrase("");
      setSelectedCategories([]);
    },
    onError: (err: any) => {
      toast.error(err.message);
    },
  });

  const categories = [
    { key: "financial", labelAr: "المدفوعات والسجل المالي", labelEn: "Payments & Financial Ledger", tables: "payments, payment_ledger, payment_method_settings" },
    { key: "bookings", labelAr: "الحجوزات والتمديدات", labelEn: "Bookings & Extensions", tables: "bookings, booking_extensions" },
    { key: "maintenance", labelAr: "طلبات الصيانة", labelEn: "Maintenance Requests", tables: "maintenanceRequests, maintenance_updates, emergency_maintenance" },
    { key: "messages", labelAr: "المحادثات والرسائل", labelEn: "Conversations & Messages", tables: "conversations, messages, whatsapp_messages" },
    { key: "reviews", labelAr: "التقييمات", labelEn: "Reviews", tables: "reviews" },
    { key: "notifications", labelAr: "الإشعارات", labelEn: "Notifications", tables: "notifications, push_subscriptions" },
    { key: "activities", labelAr: "سجل النشاط والتدقيق", labelEn: "Activity & Audit Log", tables: "userActivities, audit_log" },
    { key: "shomoos", labelAr: "سجلات شموس", labelEn: "Shomoos Submissions", tables: "shomoos_submissions" },
    { key: "otp", labelAr: "رموز التحقق", labelEn: "OTP Codes", tables: "otp_codes" },
  ];

  const toggleCategory = (key: string) => {
    setSelectedCategories(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const selectAll = () => {
    setSelectedCategories(["all"]);
  };

  const clearSelection = () => {
    setSelectedCategories([]);
    setPurgeResult(null);
  };

  const handlePurge = () => {
    if (selectedCategories.length === 0) {
      toast.error(lang === "ar" ? "اختر فئة واحدة على الأقل" : "Select at least one category");
      return;
    }
    purgeMutation.mutate({
      confirmPhrase,
      categories: selectedCategories as any,
    });
  };

  const requiredPhrase = "أؤكد مسح البيانات التجريبية";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <Trash2 className="h-5 w-5" />
          {lang === "ar" ? "مسح البيانات التجريبية" : "Purge Test Data"}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {lang === "ar"
            ? "هذه الأداة تمسح البيانات التجريبية (المدفوعات، الحجوزات، إلخ) بدون التأثير على المستخدمين أو العقارات أو الإعدادات. متاحة فقط للمسؤول الرئيسي (Root Admin)."
            : "This tool purges test data (payments, bookings, etc.) without affecting users, properties, or settings. Available only to Root Admin."}
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Warning Banner */}
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-700 dark:text-red-300 font-semibold">
            {lang === "ar"
              ? "⚠️ تحذير: هذا الإجراء لا يمكن التراجع عنه. سيتم حذف البيانات نهائياً."
              : "⚠️ Warning: This action is irreversible. Data will be permanently deleted."}
          </p>
        </div>

        {/* Category Selection */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold">
            {lang === "ar" ? "اختر البيانات المراد مسحها:" : "Select data to purge:"}
          </Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {categories.map(cat => (
              <button
                key={cat.key}
                onClick={() => toggleCategory(cat.key)}
                className={`flex items-start gap-3 p-3 rounded-lg border text-start transition-colors ${
                  selectedCategories.includes(cat.key) || selectedCategories.includes("all")
                    ? "border-red-500 bg-red-50 dark:bg-red-950/20"
                    : "border-border hover:border-muted-foreground/30"
                }`}
              >
                <Checkbox
                  checked={selectedCategories.includes(cat.key) || selectedCategories.includes("all")}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium">{lang === "ar" ? cat.labelAr : cat.labelEn}</p>
                  <p className="text-xs text-muted-foreground font-mono">{cat.tables}</p>
                </div>
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={selectAll}>
              {lang === "ar" ? "تحديد الكل" : "Select All"}
            </Button>
            <Button variant="outline" size="sm" onClick={clearSelection}>
              {lang === "ar" ? "إلغاء التحديد" : "Clear Selection"}
            </Button>
          </div>
        </div>

        {/* Confirmation Phrase */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">
            {lang === "ar" ? "اكتب عبارة التأكيد:" : "Type confirmation phrase:"}
          </Label>
          <p className="text-sm text-muted-foreground">
            {lang === "ar" ? `اكتب: "${requiredPhrase}"` : `Type: "${requiredPhrase}"`}
          </p>
          <Input
            value={confirmPhrase}
            onChange={(e) => setConfirmPhrase(e.target.value)}
            placeholder={requiredPhrase}
            dir="rtl"
            className="font-medium"
          />
        </div>

        {/* Purge Button */}
        <Button
          variant="destructive"
          size="lg"
          className="w-full"
          onClick={handlePurge}
          disabled={
            purgeMutation.isPending ||
            selectedCategories.length === 0 ||
            confirmPhrase !== requiredPhrase
          }
        >
          {purgeMutation.isPending ? (
            <RefreshCw className="h-4 w-4 me-2 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4 me-2" />
          )}
          {lang === "ar" ? "مسح البيانات التجريبية" : "Purge Test Data"}
        </Button>

        {/* Results */}
        {purgeResult && (
          <div className="p-4 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
            <p className="text-sm font-semibold text-green-700 dark:text-green-300 mb-2">
              {lang === "ar" ? "✅ تم المسح بنجاح:" : "✅ Purge completed:"}
            </p>
            <div className="grid grid-cols-2 gap-1">
              {Object.entries(purgeResult).map(([table, count]) => (
                <div key={table} className="text-xs flex justify-between">
                  <span className="font-mono text-muted-foreground">{table}</span>
                  <span className={count === -1 ? "text-yellow-600" : count > 0 ? "text-red-600 font-semibold" : "text-muted-foreground"}>
                    {count === -1 ? (lang === "ar" ? "غير موجود" : "N/A") : `${count} ${lang === "ar" ? "سجل" : "rows"}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* What is NOT affected */}
        <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
          <p className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-2">
            {lang === "ar" ? "ℹ️ لن يتأثر بالمسح:" : "ℹ️ NOT affected by purge:"}
          </p>
          <ul className="text-xs text-blue-600 dark:text-blue-400 space-y-1 list-disc list-inside">
            <li>{lang === "ar" ? "المستخدمين وحساباتهم" : "Users and accounts"}</li>
            <li>{lang === "ar" ? "العقارات والمباني والوحدات" : "Properties, buildings, and units"}</li>
            <li>{lang === "ar" ? "المدن والأحياء" : "Cities and districts"}</li>
            <li>{lang === "ar" ? "إعدادات الموقع والتكاملات" : "Site settings and integrations"}</li>
            <li>{lang === "ar" ? "الصلاحيات والأدوار" : "Permissions and roles"}</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
