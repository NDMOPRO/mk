import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, BarChart3, Eye, Search } from "lucide-react";
import type { AdminSettingsCtx } from "./useAdminSettings";

export function AnalyticsTab({ ctx }: { ctx: AdminSettingsCtx }) {
  const { t, lang, activityStatsQuery, activityLogQuery } = ctx;
  return (
    <>
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: t("analytics.totalActions"), value: (activityStatsQuery.data as any)?.totalActions || 0, icon: BarChart3 },
          { label: t("analytics.uniqueUsers"), value: (activityStatsQuery.data as any)?.uniqueUsers || 0, icon: Users },
          { label: t("analytics.pageViews"), value: (activityStatsQuery.data as any)?.topActions?.find((a: any) => a.action === "page_view")?.count || 0, icon: Eye },
          { label: t("analytics.searches"), value: (activityStatsQuery.data as any)?.topActions?.find((a: any) => a.action === "search")?.count || 0, icon: Search },
        ].map((stat, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <stat.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Top Actions */}
      <Card>
        <CardHeader>
          <CardTitle>{t("analytics.topActions")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {((activityStatsQuery.data as any)?.topActions || []).map((action: any, i: number) => (
              <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                <span className="font-medium">{action.action}</span>
                <Badge variant="secondary">{action.count}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity Log */}
      <Card>
        <CardHeader>
          <CardTitle>{t("analytics.recentActivity")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-start p-2">{t("analytics.user")}</th>
                  <th className="text-start p-2">{t("analytics.action")}</th>
                  <th className="text-start p-2">{t("analytics.page")}</th>
                  <th className="text-start p-2">{t("analytics.time")}</th>
                </tr>
              </thead>
              <tbody>
                {(activityLogQuery.data as any[] || []).map((log: any, i: number) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="p-2">{log.userId || "-"}</td>
                    <td className="p-2"><Badge variant="outline">{log.action}</Badge></td>
                    <td className="p-2 text-muted-foreground">{log.page || "-"}</td>
                    <td className="p-2 text-muted-foreground">
                      {log.createdAt ? new Date(log.createdAt).toLocaleString(lang === "ar" ? "ar-SA" : "en-US") : "-"}
                    </td>
                  </tr>
                ))}
                {(!activityLogQuery.data || (activityLogQuery.data as any[]).length === 0) && (
                  <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">
                    {lang === "ar" ? "لا توجد أنشطة مسجلة بعد" : "No activities recorded yet"}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
    </>
  );
}
