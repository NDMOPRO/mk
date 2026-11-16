import SEOHead from "@/components/SEOHead";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Settings, Image, DollarSign, FileText, Shield, BarChart3, ArrowRight, ArrowLeft, Save, RefreshCw, Globe, MapPin, Building2, Trash2, MessageCircle, CreditCard, LayoutGrid, Home as HomeIcon, Calendar, HelpCircle } from "lucide-react";
import { GeneralTab } from "./admin-settings/GeneralTab";
import { HeroTab } from "./admin-settings/HeroTab";
import { StatsTab } from "./admin-settings/StatsTab";
import { FeesTab } from "./admin-settings/FeesTab";
import { FooterTab } from "./admin-settings/FooterTab";
import { LegalTab } from "./admin-settings/LegalTab";
import { ServicesTab } from "./admin-settings/ServicesTab";
import { HomepageTab } from "./admin-settings/HomepageTab";
import { PaymentTab } from "./admin-settings/PaymentTab";
import { WhatsAppTab } from "./admin-settings/WhatsAppTab";
import { PermissionsTab } from "./admin-settings/PermissionsTab";
import { AnalyticsTab } from "./admin-settings/AnalyticsTab";
import { DistrictsTab } from "./admin-settings/DistrictsTab";
import { InspectionsTab } from "./admin-settings/InspectionsTab";
import { FaqTab } from "./admin-settings/FaqTab";
import { MaintenanceTab } from "./admin-settings/MaintenanceTab";
import { DataManagementTab } from "./admin-settings/DataManagementTab";
import { CitiesManagement } from "./admin-settings/CitiesManagement";
import { SettingsFormProvider } from "./admin-settings/fields";
import { useAdminSettings } from "./admin-settings/useAdminSettings";

export default function AdminSettings() {
  const ctx = useAdminSettings();
  const { t, lang, user, isRtl, settingsQuery, updateMutation, seedMutation, settings, dirty, lastSavedAt, fieldsLoadedCount, saveSettings, updateSetting, dir } = ctx;

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center">
      <SEOHead title="Settings | المفتاح الشهري - Monthly Key" />
        <p className="text-lg text-muted-foreground">{lang === "ar" ? "غير مصرح" : "Unauthorized"}</p>
      </div>
    );
  }

  return (
    <SettingsFormProvider value={{ settings, updateSetting, dir }}>
    <DashboardLayout>
    <div className="bg-background w-full">
      {/* Header */}
      <div className="bg-card border-b">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <Link href="/admin">
                <Button variant="ghost" size="icon">
                  {isRtl ? <ArrowRight className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold">{t("settings.title")}</h1>
                <p className="text-sm text-muted-foreground">
                  {lang === "ar" ? "تحكم كامل في جميع إعدادات المنصة" : "Full control over all platform settings"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {/* DB source indicator */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
                <div className={`h-2 w-2 rounded-full ${settingsQuery.isLoading ? 'bg-yellow-500 animate-pulse' : settingsQuery.isError ? 'bg-red-500' : 'bg-green-500'}`} />
                <span>{t("settings.dbSource" as any)}</span>
                <span className="font-mono">{fieldsLoadedCount} {t("settings.fieldsLoaded" as any)}</span>
              </div>
              {lastSavedAt && (
                <div className="text-xs text-muted-foreground">
                  {t("settings.lastSavedAt" as any)}: {lastSavedAt}
                </div>
              )}
              {dirty && (
                <Badge variant="outline" className="text-amber-600 border-amber-600/30 bg-amber-50 dark:bg-amber-950/30">
                  {t("settings.unsavedChanges" as any)}
                </Badge>
              )}
              <Button variant="outline" size="sm" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
                <RefreshCw className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"} ${seedMutation.isPending ? "animate-spin" : ""}`} />
                {t("settings.seedDefaults")}
              </Button>
              {dirty && (
                <Button size="sm" onClick={saveSettings} disabled={updateMutation.isPending}>
                  <Save className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
                  {t("settings.save")}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        <Tabs defaultValue="general">
          <TabsList className="flex flex-wrap gap-1 h-auto p-1 mb-6">
            <TabsTrigger value="general" className="gap-2"><Settings className="h-4 w-4" />{t("settings.general")}</TabsTrigger>
            <TabsTrigger value="hero" className="gap-2"><Image className="h-4 w-4" />{t("settings.hero")}</TabsTrigger>
            <TabsTrigger value="stats" className="gap-2"><BarChart3 className="h-4 w-4" />{t("settings.stats")}</TabsTrigger>
            <TabsTrigger value="fees" className="gap-2"><DollarSign className="h-4 w-4" />{t("settings.fees")}</TabsTrigger>
            <TabsTrigger value="footer" className="gap-2"><Globe className="h-4 w-4" />{t("settings.footer")}</TabsTrigger>
            <TabsTrigger value="legal" className="gap-2"><FileText className="h-4 w-4" />{t("settings.legal")}</TabsTrigger>
            <TabsTrigger value="permissions" className="gap-2"><Shield className="h-4 w-4" />{t("perms.title")}</TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2"><BarChart3 className="h-4 w-4" />{t("analytics.title")}</TabsTrigger>
            <TabsTrigger value="cities" className="gap-2"><Building2 className="h-4 w-4" />{lang === "ar" ? "المدن" : "Cities"}</TabsTrigger>
            <TabsTrigger value="districts" className="gap-2"><MapPin className="h-4 w-4" />{t("districts.title")}</TabsTrigger>
            <TabsTrigger value="services" className="gap-2"><LayoutGrid className="h-4 w-4" />{lang === "ar" ? "الخدمات" : "Services"}</TabsTrigger>
            <TabsTrigger value="homepage" className="gap-2"><HomeIcon className="h-4 w-4" />{lang === "ar" ? "الصفحة الرئيسية" : "Homepage"}</TabsTrigger>
            <TabsTrigger value="payment" className="gap-2"><CreditCard className="h-4 w-4" />{lang === "ar" ? "الدفع" : "Payment"}</TabsTrigger>
            <TabsTrigger value="whatsapp" className="gap-2"><MessageCircle className="h-4 w-4" />{lang === "ar" ? "واتساب" : "WhatsApp"}</TabsTrigger>
            <TabsTrigger value="inspections" className="gap-2"><Calendar className="h-4 w-4" />{lang === "ar" ? "طلبات المعاينة" : "Inspections"}</TabsTrigger>
            <TabsTrigger value="faq" className="gap-2"><HelpCircle className="h-4 w-4" />{lang === "ar" ? "الأسئلة الشائعة" : "FAQ"}</TabsTrigger>
            <TabsTrigger value="maintenance" className="gap-2"><Shield className="h-4 w-4" />{lang === "ar" ? "وضع الصيانة" : "Maintenance Mode"}</TabsTrigger>
            <TabsTrigger value="datamgmt" className="gap-2"><Trash2 className="h-4 w-4" />{lang === "ar" ? "إدارة البيانات" : "Data Management"}</TabsTrigger>
          </TabsList>

          {/* General Settings */}
          <TabsContent value="general">
            <GeneralTab ctx={ctx} />
          </TabsContent>

          {/* Hero Section */}
          <TabsContent value="hero">
            <HeroTab ctx={ctx} />
          </TabsContent>

          {/* Statistics */}
          <TabsContent value="stats">
            <StatsTab ctx={ctx} />
          </TabsContent>

          {/* Fees & Pricing */}
          <TabsContent value="fees">
            <FeesTab ctx={ctx} />
          </TabsContent>

          {/* Footer */}
          <TabsContent value="footer">
            <FooterTab ctx={ctx} />
          </TabsContent>

          {/* Legal */}
          <TabsContent value="legal">
            <LegalTab ctx={ctx} />
          </TabsContent>

          {/* Services Section CMS */}
          <TabsContent value="services">
            <ServicesTab ctx={ctx} />
          </TabsContent>

          {/* Homepage Content CMS */}
          <TabsContent value="homepage">
            <HomepageTab ctx={ctx} />
          </TabsContent>

          {/* Payment Settings */}
          <TabsContent value="payment">
            <PaymentTab ctx={ctx} />
          </TabsContent>
          {/* WhatsApp Settings */}
          <TabsContent value="whatsapp">
            <WhatsAppTab ctx={ctx} />
          </TabsContent>

          {/* Admin Permissions */}
          <TabsContent value="permissions">
            <PermissionsTab ctx={ctx} />
          </TabsContent>

          {/* User Analytics */}
          <TabsContent value="analytics">
            <AnalyticsTab ctx={ctx} />
          </TabsContent>

          {/* Cities Management */}
          <TabsContent value="cities">
            <CitiesManagement lang={lang} isRtl={isRtl} />
          </TabsContent>

          {/* Districts */}
          <TabsContent value="districts">
            <DistrictsTab ctx={ctx} />
          </TabsContent>



          {/* Inspection Requests */}
          <TabsContent value="inspections">
            <InspectionsTab ctx={ctx} />
          </TabsContent>

          {/* FAQ Management */}
          <TabsContent value="faq">
            <FaqTab ctx={ctx} />
          </TabsContent>

          {/* Maintenance Mode */}
          <TabsContent value="maintenance">
            <MaintenanceTab ctx={ctx} />
          </TabsContent>

          {/* Data Management - Root Admin Only */}
          <TabsContent value="datamgmt">
            <DataManagementTab lang={lang} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
    </DashboardLayout>
    </SettingsFormProvider>
  );
}
