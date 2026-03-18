import SEOHead from "@/components/SEOHead";
import DashboardLayout from "@/components/DashboardLayout";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Link } from "wouter";
import { ArrowRight, ArrowLeft, Shield, Plus, Pencil, Trash2, Users, UserPlus, Check, X, ChevronDown, ChevronUp } from "lucide-react";

// All available permissions
const ALL_PERMISSIONS = [
  { group: "العقارات", groupEn: "Properties", items: [
    { key: "properties.view", label: "عرض العقارات", labelEn: "View Properties" },
    { key: "properties.create", label: "إضافة عقار", labelEn: "Create Property" },
    { key: "properties.edit", label: "تعديل عقار", labelEn: "Edit Property" },
    { key: "properties.delete", label: "حذف عقار", labelEn: "Delete Property" },
  ]},
  { group: "الحجوزات", groupEn: "Bookings", items: [
    { key: "bookings.view", label: "عرض الحجوزات", labelEn: "View Bookings" },
    { key: "bookings.create", label: "إنشاء حجز", labelEn: "Create Booking" },
    { key: "bookings.approve", label: "الموافقة على الحجوزات", labelEn: "Approve Bookings" },
    { key: "bookings.cancel", label: "إلغاء الحجوزات", labelEn: "Cancel Bookings" },
  ]},
  { group: "المستخدمين", groupEn: "Users", items: [
    { key: "users.view", label: "عرض المستخدمين", labelEn: "View Users" },
    { key: "users.edit", label: "تعديل المستخدمين", labelEn: "Edit Users" },
    { key: "users.delete", label: "حذف المستخدمين", labelEn: "Delete Users" },
    { key: "users.roles", label: "إدارة الأدوار", labelEn: "Manage Roles" },
  ]},
  { group: "المدفوعات", groupEn: "Payments", items: [
    { key: "payments.view", label: "عرض المدفوعات", labelEn: "View Payments" },
    { key: "payments.process", label: "معالجة المدفوعات", labelEn: "Process Payments" },
  ]},
  { group: "الخدمات", groupEn: "Services", items: [
    { key: "services.view", label: "عرض الخدمات", labelEn: "View Services" },
    { key: "services.manage", label: "إدارة الخدمات", labelEn: "Manage Services" },
  ]},
  { group: "الصيانة", groupEn: "Maintenance", items: [
    { key: "maintenance.view", label: "عرض الصيانة", labelEn: "View Maintenance" },
    { key: "maintenance.manage", label: "إدارة الصيانة", labelEn: "Manage Maintenance" },
  ]},
  { group: "الإعدادات", groupEn: "Settings", items: [
    { key: "settings.view", label: "عرض الإعدادات", labelEn: "View Settings" },
    { key: "settings.edit", label: "تعديل الإعدادات", labelEn: "Edit Settings" },
  ]},
  { group: "أخرى", groupEn: "Other", items: [
    { key: "analytics.view", label: "عرض التحليلات", labelEn: "View Analytics" },
    { key: "notifications.send", label: "إرسال الإشعارات", labelEn: "Send Notifications" },
    { key: "cms.edit", label: "تعديل المحتوى", labelEn: "Edit CMS" },
  ]},
];

function PermissionMatrix({ selected, onChange, lang }: { selected: string[]; onChange: (perms: string[]) => void; lang: string }) {
  const [expandedGroups, setExpandedGroups] = useState<string[]>(ALL_PERMISSIONS.map(g => g.group));
  const isAr = lang === "ar";

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]);
  };

  const togglePermission = (key: string) => {
    onChange(selected.includes(key) ? selected.filter(k => k !== key) : [...selected, key]);
  };

  const toggleGroupAll = (items: { key: string }[]) => {
    const allSelected = items.every(i => selected.includes(i.key));
    if (allSelected) {
      onChange(selected.filter(k => !items.some(i => i.key === k)));
    } else {
      const newPerms = [...selected];
      items.forEach(i => { if (!newPerms.includes(i.key)) newPerms.push(i.key); });
      onChange(newPerms);
    }
  };

  return (
    <div className="space-y-2">
      {ALL_PERMISSIONS.map(group => {
        const isExpanded = expandedGroups.includes(group.group);
        const allSelected = group.items.every(i => selected.includes(i.key));
        const someSelected = group.items.some(i => selected.includes(i.key));
        return (
          <div key={group.group} className="border rounded-lg overflow-hidden">
            <div
              className="flex items-center justify-between p-3 bg-muted/50 cursor-pointer hover:bg-muted"
              onClick={() => toggleGroup(group.group)}
            >
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggleGroupAll(group.items); }}
                  className={`w-5 h-5 rounded border flex items-center justify-center text-xs ${
                    allSelected ? 'bg-primary border-primary text-primary-foreground' :
                    someSelected ? 'bg-primary/30 border-primary' : 'border-muted-foreground/30'
                  }`}
                >
                  {allSelected && <Check className="w-3 h-3" />}
                  {someSelected && !allSelected && <span className="w-2 h-0.5 bg-primary block" />}
                </button>
                <span className="font-medium">{isAr ? group.group : group.groupEn}</span>
              </div>
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
            {isExpanded && (
              <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {group.items.map(item => (
                  <label key={item.key} className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-muted/30">
                    <button
                      type="button"
                      onClick={() => togglePermission(item.key)}
                      className={`w-4 h-4 rounded border flex items-center justify-center ${
                        selected.includes(item.key) ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/30'
                      }`}
                    >
                      {selected.includes(item.key) && <Check className="w-3 h-3" />}
                    </button>
                    <span className="text-sm">{isAr ? item.label : item.labelEn}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function AdminPermissions() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const isAr = lang === "ar";

  const [createOpen, setCreateOpen] = useState(false);
  const [editRole, setEditRole] = useState<any>(null);
  const [newRole, setNewRole] = useState({ name: "", nameAr: "", description: "", descriptionAr: "", permissions: [] as string[] });

  // Create user state
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    username: "", password: "", name: "", nameAr: "", email: "", phone: "",
    role: "admin" as "user" | "admin" | "landlord" | "tenant",
    title: "", titleAr: "",
  });

  const rolesQuery = trpc.roles.list.useQuery();
  const adminsQuery = trpc.permissions.list.useQuery();

  const createMutation = trpc.roles.create.useMutation({
    onSuccess: () => {
      rolesQuery.refetch();
      setCreateOpen(false);
      setNewRole({ name: "", nameAr: "", description: "", descriptionAr: "", permissions: [] });
      toast.success(isAr ? "تم إنشاء الدور بنجاح" : "Role created successfully");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.roles.update.useMutation({
    onSuccess: () => {
      rolesQuery.refetch();
      setEditRole(null);
      toast.success(isAr ? "تم تحديث الدور بنجاح" : "Role updated successfully");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.roles.delete.useMutation({
    onSuccess: () => {
      rolesQuery.refetch();
      toast.success(isAr ? "تم حذف الدور" : "Role deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  const assignMutation = trpc.roles.assignToUser.useMutation({
    onSuccess: () => {
      adminsQuery.refetch();
      toast.success(isAr ? "تم تعيين الدور بنجاح" : "Role assigned successfully");
    },
    onError: (e) => toast.error(e.message),
  });

  const createUserMutation = trpc.admin.createUser.useMutation({
    onSuccess: () => {
      adminsQuery.refetch();
      setCreateUserOpen(false);
      setNewUser({ username: "", password: "", name: "", nameAr: "", email: "", phone: "", role: "admin", title: "", titleAr: "" });
      toast.success(isAr ? "تم إنشاء المستخدم بنجاح" : "User created successfully");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteUserMutation = trpc.admin.deleteUser.useMutation({
    onSuccess: () => {
      adminsQuery.refetch();
      toast.success(isAr ? "تم حذف المستخدم" : "User deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  if (!user || user.role !== "admin") {
    return (
      <>
        <div className="container py-20 text-center">
          <Shield className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2">{isAr ? "غير مصرح" : "Unauthorized"}</h1>
          <p className="text-muted-foreground">{isAr ? "هذه الصفحة متاحة للمسؤولين فقط" : "This page is for administrators only"}</p>
        </div>
      </>
    );
  }

  return (
    <DashboardLayout>
      <>
        <SEOHead title={isAr ? "الأدوار والصلاحيات | المفتاح الشهري" : "Permissions & Roles | Monthly Key"} />
        <div className="container py-8 space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin">
                <Button variant="ghost" size="icon">
                  {isAr ? <ArrowRight className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <Shield className="w-6 h-6 text-primary" />
                  {isAr ? "إدارة الأدوار والصلاحيات" : "Permissions & Roles Management"}
                </h1>
                <p className="text-muted-foreground">
                  {isAr ? "إنشاء وتعديل الأدوار وتعيين الصلاحيات للمستخدمين" : "Create and edit roles and assign permissions to users"}
                </p>
              </div>
            </div>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button><Plus className={`w-4 h-4 ${isAr ? "ml-2" : "mr-2"}`} />{isAr ? "دور جديد" : "New Role"}</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{isAr ? "إنشاء دور جديد" : "Create New Role"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>{isAr ? "اسم الدور (عربي)" : "Role Name (Arabic)"}</Label>
                      <Input value={newRole.nameAr} onChange={e => setNewRole(p => ({ ...p, nameAr: e.target.value }))} placeholder={isAr ? "مثال: مدير عقارات" : "e.g. مدير عقارات"} />
                    </div>
                    <div>
                      <Label>{isAr ? "اسم الدور (إنجليزي)" : "Role Name (English)"}</Label>
                      <Input value={newRole.name} onChange={e => setNewRole(p => ({ ...p, name: e.target.value }))} placeholder={isAr ? "مثال: Property Manager" : "e.g. Property Manager"} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>{isAr ? "الوصف (عربي)" : "Description (Arabic)"}</Label>
                      <Textarea value={newRole.descriptionAr} onChange={e => setNewRole(p => ({ ...p, descriptionAr: e.target.value }))} rows={2} />
                    </div>
                    <div>
                      <Label>{isAr ? "الوصف (إنجليزي)" : "Description (English)"}</Label>
                      <Textarea value={newRole.description} onChange={e => setNewRole(p => ({ ...p, description: e.target.value }))} rows={2} />
                    </div>
                  </div>
                  <div>
                    <Label className="mb-2 block">{isAr ? "الصلاحيات" : "Permissions"}</Label>
                    <PermissionMatrix selected={newRole.permissions} onChange={perms => setNewRole(p => ({ ...p, permissions: perms }))} lang={lang} />
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild><Button variant="outline">{isAr ? "إلغاء" : "Cancel"}</Button></DialogClose>
                  <Button onClick={() => createMutation.mutate(newRole)} disabled={!newRole.name || !newRole.nameAr || createMutation.isPending}>
                    {createMutation.isPending ? (isAr ? "جاري الإنشاء..." : "Creating...") : (isAr ? "إنشاء" : "Create")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Roles Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rolesQuery.data?.map((role: any) => (
              <Card key={role.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{isAr ? role.nameAr : role.name}</CardTitle>
                    <div className="flex gap-1">
                      {role.isSystem && <Badge variant="secondary">{isAr ? "نظامي" : "System"}</Badge>}
                      {role.isActive === false && <Badge variant="destructive">{isAr ? "معطل" : "Disabled"}</Badge>}
                    </div>
                  </div>
                  <CardDescription>{isAr ? role.name : role.nameAr}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    {isAr ? (role.descriptionAr || role.description || "بدون وصف") : (role.description || role.descriptionAr || "No description")}
                  </p>
                  <div className="flex flex-wrap gap-1 mb-4">
                    {(role.permissions || []).slice(0, 5).map((p: string) => (
                      <Badge key={p} variant="outline" className="text-xs">{p}</Badge>
                    ))}
                    {(role.permissions || []).length > 5 && (
                      <Badge variant="outline" className="text-xs">+{role.permissions.length - 5}</Badge>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Dialog open={editRole?.id === role.id} onOpenChange={(open) => {
                      if (open) setEditRole({ ...role, permissions: [...(role.permissions || [])] });
                      else setEditRole(null);
                    }}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm"><Pencil className={`w-3 h-3 ${isAr ? "ml-1" : "mr-1"}`} />{isAr ? "تعديل" : "Edit"}</Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>{isAr ? `تعديل الدور: ${role.nameAr}` : `Edit Role: ${role.name}`}</DialogTitle>
                        </DialogHeader>
                        {editRole && (
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label>{isAr ? "اسم الدور (عربي)" : "Role Name (Arabic)"}</Label>
                                <Input value={editRole.nameAr} onChange={e => setEditRole((p: any) => ({ ...p, nameAr: e.target.value }))} disabled={role.isSystem} />
                              </div>
                              <div>
                                <Label>{isAr ? "اسم الدور (إنجليزي)" : "Role Name (English)"}</Label>
                                <Input value={editRole.name} onChange={e => setEditRole((p: any) => ({ ...p, name: e.target.value }))} disabled={role.isSystem} />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label>{isAr ? "الوصف (عربي)" : "Description (Arabic)"}</Label>
                                <Textarea value={editRole.descriptionAr || ""} onChange={e => setEditRole((p: any) => ({ ...p, descriptionAr: e.target.value }))} rows={2} />
                              </div>
                              <div>
                                <Label>{isAr ? "الوصف (إنجليزي)" : "Description (English)"}</Label>
                                <Textarea value={editRole.description || ""} onChange={e => setEditRole((p: any) => ({ ...p, description: e.target.value }))} rows={2} />
                              </div>
                            </div>
                            <div>
                              <Label className="mb-2 block">{isAr ? "الصلاحيات" : "Permissions"}</Label>
                              <PermissionMatrix selected={editRole.permissions || []} onChange={perms => setEditRole((p: any) => ({ ...p, permissions: perms }))} lang={lang} />
                            </div>
                          </div>
                        )}
                        <DialogFooter>
                          <DialogClose asChild><Button variant="outline">{isAr ? "إلغاء" : "Cancel"}</Button></DialogClose>
                          <Button onClick={() => updateMutation.mutate({ id: editRole.id, nameAr: editRole.nameAr, name: editRole.name, description: editRole.description, descriptionAr: editRole.descriptionAr, permissions: editRole.permissions })} disabled={updateMutation.isPending}>
                            {updateMutation.isPending ? (isAr ? "جاري الحفظ..." : "Saving...") : (isAr ? "حفظ التغييرات" : "Save Changes")}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    {!role.isSystem && (
                      <Button variant="destructive" size="sm" onClick={() => {
                        if (confirm(isAr ? "هل أنت متأكد من حذف هذا الدور؟" : "Are you sure you want to delete this role?")) {
                          deleteMutation.mutate({ id: role.id });
                        }
                      }}>
                        <Trash2 className={`w-3 h-3 ${isAr ? "ml-1" : "mr-1"}`} />{isAr ? "حذف" : "Delete"}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Admin Users Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    {isAr ? "المسؤولون وصلاحياتهم" : "Administrators & Permissions"}
                  </CardTitle>
                  <CardDescription>{isAr ? "تعيين الأدوار للمستخدمين المسؤولين" : "Assign roles to admin users"}</CardDescription>
                </div>
                {/* Create User Button */}
                <Dialog open={createUserOpen} onOpenChange={setCreateUserOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline"><UserPlus className={`w-4 h-4 ${isAr ? "ml-2" : "mr-2"}`} />{isAr ? "إضافة مسؤول" : "Add Admin"}</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>{isAr ? "إضافة مسؤول جديد" : "Add New Administrator"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>{isAr ? "اسم المستخدم" : "Username"}</Label>
                          <Input value={newUser.username} onChange={e => setNewUser(p => ({ ...p, username: e.target.value }))} placeholder={isAr ? "مثال: ahmed" : "e.g. ahmed"} dir="ltr" />
                        </div>
                        <div>
                          <Label>{isAr ? "كلمة المرور" : "Password"}</Label>
                          <Input type="password" value={newUser.password} onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))} placeholder={isAr ? "٦ أحرف على الأقل" : "Min 6 characters"} dir="ltr" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>{isAr ? "الاسم (إنجليزي)" : "Name (English)"}</Label>
                          <Input value={newUser.name} onChange={e => setNewUser(p => ({ ...p, name: e.target.value }))} placeholder={isAr ? "مثال: Ahmed Ali" : "e.g. Ahmed Ali"} />
                        </div>
                        <div>
                          <Label>{isAr ? "الاسم (عربي)" : "Name (Arabic)"}</Label>
                          <Input value={newUser.nameAr} onChange={e => setNewUser(p => ({ ...p, nameAr: e.target.value }))} placeholder={isAr ? "مثال: أحمد علي" : "e.g. أحمد علي"} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>{isAr ? "البريد الإلكتروني" : "Email"}</Label>
                          <Input type="email" value={newUser.email} onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))} placeholder="user@example.com" dir="ltr" />
                        </div>
                        <div>
                          <Label>{isAr ? "رقم الهاتف" : "Phone"}</Label>
                          <Input value={newUser.phone} onChange={e => setNewUser(p => ({ ...p, phone: e.target.value }))} placeholder="+966500000000" dir="ltr" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>{isAr ? "المسمى الوظيفي (إنجليزي)" : "Job Title (English)"}</Label>
                          <Input value={newUser.title} onChange={e => setNewUser(p => ({ ...p, title: e.target.value }))} placeholder={isAr ? "مثال: Operations Manager" : "e.g. Operations Manager"} />
                        </div>
                        <div>
                          <Label>{isAr ? "المسمى الوظيفي (عربي)" : "Job Title (Arabic)"}</Label>
                          <Input value={newUser.titleAr} onChange={e => setNewUser(p => ({ ...p, titleAr: e.target.value }))} placeholder={isAr ? "مثال: مدير العمليات" : "e.g. مدير العمليات"} />
                        </div>
                      </div>
                      <div>
                        <Label>{isAr ? "الدور" : "Role"}</Label>
                        <select
                          className="w-full border rounded px-3 py-2 text-sm bg-background"
                          value={newUser.role}
                          onChange={e => setNewUser(p => ({ ...p, role: e.target.value as any }))}
                        >
                          <option value="admin">{isAr ? "مسؤول" : "Admin"}</option>
                          <option value="user">{isAr ? "مستخدم" : "User"}</option>
                          <option value="landlord">{isAr ? "مالك عقار" : "Landlord"}</option>
                          <option value="tenant">{isAr ? "مستأجر" : "Tenant"}</option>
                        </select>
                      </div>
                    </div>
                    <DialogFooter>
                      <DialogClose asChild><Button variant="outline">{isAr ? "إلغاء" : "Cancel"}</Button></DialogClose>
                      <Button
                        onClick={() => createUserMutation.mutate(newUser)}
                        disabled={!newUser.username || !newUser.password || !newUser.name || !newUser.email || createUserMutation.isPending}
                      >
                        {createUserMutation.isPending ? (isAr ? "جاري الإنشاء..." : "Creating...") : (isAr ? "إنشاء المسؤول" : "Create Admin")}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {adminsQuery.data && adminsQuery.data.length > 0 ? (
                <div className="space-y-3">
                  {adminsQuery.data.map((admin: any) => (
                    <div key={admin.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">{isAr ? (admin.nameAr || admin.name || admin.displayName) : (admin.name || admin.displayName || admin.nameAr)}</p>
                        <p className="text-sm text-muted-foreground">{admin.email}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(admin.permissions || []).slice(0, 4).map((p: string) => (
                            <Badge key={p} variant="outline" className="text-xs">{p}</Badge>
                          ))}
                          {(admin.permissions || []).length > 4 && (
                            <Badge variant="outline" className="text-xs">+{admin.permissions.length - 4}</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {rolesQuery.data && (
                          <select
                            className="border rounded px-3 py-1.5 text-sm bg-background"
                            onChange={(e) => {
                              if (e.target.value) {
                                assignMutation.mutate({ userId: admin.id, roleId: parseInt(e.target.value) });
                              }
                            }}
                            defaultValue=""
                          >
                            <option value="" disabled>{isAr ? "تعيين دور..." : "Assign role..."}</option>
                            {rolesQuery.data.map((role: any) => (
                              <option key={role.id} value={role.id}>{isAr ? role.nameAr : role.name}</option>
                            ))}
                          </select>
                        )}
                        {!admin.isRootAdmin && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              if (confirm(isAr ? "هل أنت متأكد من حذف هذا المسؤول؟" : "Are you sure you want to delete this admin?")) {
                                deleteUserMutation.mutate({ userId: admin.id });
                              }
                            }}
                            disabled={deleteUserMutation.isPending}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>{isAr ? "لا يوجد مسؤولون حالياً" : "No administrators found"}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </>
    </DashboardLayout>
  );
}
