import { useAuth } from "@/_core/hooks/useAuth";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useState, useEffect, useMemo, useRef } from "react";
import { Settings, ArrowRight, ArrowLeft } from "lucide-react";

/** All state, queries and handlers behind the Admin Settings page. */
export function useAdminSettings() {
  const { t, lang, dir } = useI18n();
  const { user } = useAuth();
  const isRtl = dir === "rtl";
  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;

  const settingsQuery = trpc.siteSettings.getAll.useQuery();
  const updateMutation = trpc.siteSettings.update.useMutation({
    onSuccess: () => { toast.success(t("settings.saved")); settingsQuery.refetch(); },
  });
  const seedMutation = trpc.siteSettings.seed.useMutation({
    onSuccess: () => { toast.success(t("settings.seeded")); settingsQuery.refetch(); },
  });
  const uploadMutation = trpc.siteSettings.uploadAsset.useMutation({
    onSuccess: (data) => { toast.success(t("settings.saved")); settingsQuery.refetch(); },
  });

  // Admin permissions
  const permsQuery = trpc.permissions.list.useQuery();
  const setPermsMutation = trpc.permissions.set.useMutation({
    onSuccess: () => { toast.success(t("perms.saved")); permsQuery.refetch(); },
    onError: (err) => { toast.error(err.message); },
  });

  // User analytics
  const activityStatsQuery = trpc.activity.stats.useQuery();
  const activityLogQuery = trpc.activity.log.useQuery({ limit: 50 });

  // Districts
  const districtsQuery = trpc.districts.all.useQuery();
  const [districtFilter, setDistrictFilter] = useState("all");

  // Admin users for permissions
  const adminUsersQuery = trpc.admin.users.useQuery({ limit: 100 });

  // Settings state
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [fieldsLoadedCount, setFieldsLoadedCount] = useState(0);

  useEffect(() => {
    if (settingsQuery.data) {
      const raw = settingsQuery.data as any;
      let map: Record<string, string> = {};
      if (Array.isArray(raw)) {
        // Array of {key, value} objects
        raw.forEach((s: any) => { map[s.key ?? s.settingKey] = s.value ?? s.settingValue ?? ""; });
      } else if (typeof raw === 'object') {
        // Direct Record<string, string> from getAllSettings
        map = { ...raw };
      }
      setSettings(map);
      setDirty(false);
      setFieldsLoadedCount(Object.keys(map).filter(k => map[k] && map[k].trim() !== '').length);
    }
  }, [settingsQuery.data]);

  const updateSetting = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const saveSettings = () => {
    updateMutation.mutate({ settings });
    setDirty(false);
    setLastSavedAt(new Date().toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-US'));
  };

  const handleFileUpload = (purpose: string) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        uploadMutation.mutate({ base64, filename: file.name, contentType: file.type, purpose });
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  // Permission management
  const allPermissions = [
    { key: "manage_users", label: t("perms.manageUsers") },
    { key: "manage_properties", label: t("perms.manageProperties") },
    { key: "manage_bookings", label: t("perms.manageBookings") },
    { key: "manage_settings", label: t("perms.manageSettings") },
    { key: "manage_kb", label: t("perms.manageKB") },
    { key: "view_analytics", label: t("perms.viewAnalytics") },
    { key: "manage_payments", label: t("perms.managePayments") },
    { key: "manage_maintenance", label: t("perms.manageMaintenance") },
  ];

  const [selectedAdminPerms, setSelectedAdminPerms] = useState<Record<number, string[]>>({});

  // Check if current user is root admin
  const isCurrentUserRootAdmin = useMemo(() => {
    if (!user || !permsQuery.data) return false;
    const data = permsQuery.data as any[];
    if (!Array.isArray(data)) return false;
    // permissions.list returns full user objects where id = numeric user id, userId = openId string
    return data.some((p: any) => (p.id === user.id || String(p.id) === String(user.id)) && p.isRootAdmin);
  }, [user, permsQuery.data]);

  // Bank card refs for copy-as-image
  const bankCardRef = useRef<HTMLDivElement>(null);
  const bankCard2Ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (permsQuery.data) {
      const map: Record<number, string[]> = {};
      (permsQuery.data as any[]).forEach((p: any) => {
        try { map[p.userId] = JSON.parse(p.permissions); } catch { map[p.userId] = []; }
      });
      setSelectedAdminPerms(map);
    }
  }, [permsQuery.data]);

  const togglePerm = (userId: number, perm: string) => {
    setSelectedAdminPerms(prev => {
      const current = prev[userId] || [];
      const next = current.includes(perm) ? current.filter(p => p !== perm) : [...current, perm];
      return { ...prev, [userId]: next };
    });
  };

  const savePerms = (userId: number) => {
    setPermsMutation.mutate({ userId, permissions: selectedAdminPerms[userId] || [] });
  };

  // Districts grouped by city
  const groupedDistricts = useMemo(() => {
    if (!districtsQuery.data) return {};
    const grouped: Record<string, any[]> = {};
    (districtsQuery.data as any[]).forEach(d => {
      const key = d.city;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(d);
    });
    return grouped;
  }, [districtsQuery.data]);

  const filteredDistricts = useMemo(() => {
    if (districtFilter === "all") return districtsQuery.data || [];
    return (districtsQuery.data as any[] || []).filter((d: any) => d.city === districtFilter);
  }, [districtsQuery.data, districtFilter]);

  return {
    t,
    lang,
    dir,
    user,
    isRtl,
    ArrowIcon,
    settingsQuery,
    updateMutation,
    seedMutation,
    uploadMutation,
    permsQuery,
    setPermsMutation,
    activityStatsQuery,
    activityLogQuery,
    districtsQuery,
    districtFilter,
    setDistrictFilter,
    adminUsersQuery,
    settings,
    setSettings,
    dirty,
    setDirty,
    lastSavedAt,
    setLastSavedAt,
    fieldsLoadedCount,
    setFieldsLoadedCount,
    updateSetting,
    saveSettings,
    handleFileUpload,
    allPermissions,
    selectedAdminPerms,
    setSelectedAdminPerms,
    isCurrentUserRootAdmin,
    bankCardRef,
    bankCard2Ref,
    togglePerm,
    savePerms,
    groupedDistricts,
    filteredDistricts,
  };
}

export type AdminSettingsCtx = ReturnType<typeof useAdminSettings>;
