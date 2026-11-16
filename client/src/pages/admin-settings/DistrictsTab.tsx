import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin } from "lucide-react";
import type { AdminSettingsCtx } from "./useAdminSettings";

export function DistrictsTab({ ctx }: { ctx: AdminSettingsCtx }) {
  const { t, lang, dir, districtsQuery, districtFilter, setDistrictFilter, settings, groupedDistricts, filteredDistricts } = ctx;
  return (
    <>
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            {t("districts.title")} ({(districtsQuery.data as any[] || []).length})
          </CardTitle>
          <Select value={districtFilter} onValueChange={setDistrictFilter}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("districts.allCities")}</SelectItem>
              {Object.keys(groupedDistricts).sort().map(city => (
                <SelectItem key={city} value={city}>{city} ({groupedDistricts[city].length})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {/* City summary cards */}
        {districtFilter === "all" && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {Object.entries(groupedDistricts).sort().map(([city, dists]) => (
              <button
                key={city}
                onClick={() => setDistrictFilter(city)}
                className="border rounded-lg p-3 text-start hover:bg-accent/50 transition-colors"
              >
                <p className="font-semibold">{city}</p>
                <p className="text-xs text-muted-foreground">
                  {(dists as any[])[0]?.cityAr} • {(dists as any[]).length} {lang === "ar" ? "حي" : "districts"}
                </p>
              </button>
            ))}
          </div>
        )}

        {/* Districts table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-start p-2">{t("districts.city")}</th>
                <th className="text-start p-2">{t("districts.district")} ({t("settings.english")})</th>
                <th className="text-start p-2">{t("districts.district")} ({t("settings.arabic")})</th>
              </tr>
            </thead>
            <tbody>
              {(filteredDistricts as any[]).map((d: any) => (
                <tr key={d.id} className="border-b last:border-0 hover:bg-accent/30">
                  <td className="p-2">
                    <span className="font-medium">{d.city}</span>
                    <span className="text-muted-foreground text-xs block">{d.cityAr}</span>
                  </td>
                  <td className="p-2" dir="ltr">{d.nameEn}</td>
                  <td className="p-2" dir="rtl">{d.nameAr}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
    </>
  );
}
