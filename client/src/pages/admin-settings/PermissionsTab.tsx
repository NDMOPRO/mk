import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Shield, Save } from "lucide-react";
import type { AdminSettingsCtx } from "./useAdminSettings";

export function PermissionsTab({ ctx }: { ctx: AdminSettingsCtx }) {
  const { t, isRtl, permsQuery, setPermsMutation, adminUsersQuery, allPermissions, selectedAdminPerms, togglePerm, savePerms } = ctx;
  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          {t("perms.title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {adminUsersQuery.data && (adminUsersQuery.data as any[]).filter((u: any) => u.role === "admin").length === 0 ? (
          <p className="text-muted-foreground text-center py-8">{t("perms.noAdmins")}</p>
        ) : (
          <div className="space-y-6">
            {(adminUsersQuery.data as any[] || [])
              .filter((u: any) => u.role === "admin")
              .map((adminUser: any) => {
                const isRoot = (permsQuery.data as any[] || []).find((p: any) => p.userId === adminUser.id)?.isRootAdmin;
                return (
                  <div key={adminUser.id} className="border rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Shield className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold">{adminUser.displayName || adminUser.name || adminUser.userId}</p>
                          <p className="text-sm text-muted-foreground">{adminUser.email}</p>
                        </div>
                      </div>
                      {isRoot && <Badge variant="destructive">{t("perms.rootAdmin")}</Badge>}
                    </div>

                    {isRoot ? (
                      <p className="text-sm text-muted-foreground italic">{t("perms.cannotModifyRoot")}</p>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {allPermissions.map(perm => (
                            <label key={perm.key} className="flex items-center gap-2 cursor-pointer">
                              <Checkbox
                                checked={(selectedAdminPerms[adminUser.id] || []).includes(perm.key)}
                                onCheckedChange={() => togglePerm(adminUser.id, perm.key)}
                              />
                              <span className="text-sm">{perm.label}</span>
                            </label>
                          ))}
                        </div>
                        <Button size="sm" onClick={() => savePerms(adminUser.id)} disabled={setPermsMutation.isPending}>
                          <Save className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
                          {t("perms.save")}
                        </Button>
                      </>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </CardContent>
    </Card>
    </>
  );
}
