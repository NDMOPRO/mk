import SEOHead from "@/components/SEOHead";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import { Link } from "wouter";
import {
  ArrowLeft, Star, TrendingUp, MessageSquare, BarChart3
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function AdminAIRatings() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const isAr = lang === "ar";

  const { data: overview, isLoading: loadingOverview } = trpc.aiStats.ratingOverview.useQuery();
  const { data: recentRated, isLoading: loadingRecent } = trpc.aiStats.recentRated.useQuery({ limit: 20 });

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center">
      <SEOHead title="AI Ratings | المفتاح الشهري - Monthly Key" />
        <p className="text-muted-foreground">{isAr ? "غير مصرح" : "Unauthorized"}</p>
      </div>
    );
  }

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${i < rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
      />
    ));
  };

  const getBarWidth = (count: number, total: number) => {
    if (total === 0) return "0%";
    return `${Math.round((count / total) * 100)}%`;
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/admin" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className={`h-5 w-5 ${isAr ? "rotate-180" : ""}`} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{isAr ? "تقييمات المساعد الذكي" : "AI Assistant Ratings"}</h1>
            <p className="text-muted-foreground text-sm">
              {isAr ? "إحصائيات وتحليلات تقييمات ردود راصد الذكي" : "Statistics and analytics for Smart Rased responses"}
            </p>
          </div>
        </div>

        {loadingOverview ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {[1, 2, 3].map(i => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6"><div className="h-20 bg-muted rounded" /></CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-amber-500/10">
                      <Star className="h-5 w-5 text-amber-500" />
                    </div>
                    <span className="text-sm text-muted-foreground">{isAr ? "متوسط التقييم" : "Average Rating"}</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold">{overview?.averageRating || 0}</span>
                    <span className="text-muted-foreground text-sm">/ 5</span>
                  </div>
                  <div className="flex mt-2">{renderStars(Math.round(overview?.averageRating || 0))}</div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <MessageSquare className="h-5 w-5 text-blue-500" />
                    </div>
                    <span className="text-sm text-muted-foreground">{isAr ? "إجمالي التقييمات" : "Total Ratings"}</span>
                  </div>
                  <span className="text-3xl font-bold">{overview?.totalRated || 0}</span>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-emerald-500/10">
                      <TrendingUp className="h-5 w-5 text-emerald-500" />
                    </div>
                    <span className="text-sm text-muted-foreground">{isAr ? "نسبة الرضا" : "Satisfaction Rate"}</span>
                  </div>
                  <span className="text-3xl font-bold">
                    {overview && overview.totalRated > 0
                      ? Math.round(((overview.distribution[4] + overview.distribution[5]) / overview.totalRated) * 100)
                      : 0}%
                  </span>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isAr ? "(4 و 5 نجوم)" : "(4 & 5 stars)"}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Rating Distribution */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  {isAr ? "توزيع التقييمات" : "Rating Distribution"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[5, 4, 3, 2, 1].map(star => {
                    const count = overview?.distribution[star] || 0;
                    const total = overview?.totalRated || 0;
                    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                    return (
                      <div key={star} className="flex items-center gap-3">
                        <div className="flex items-center gap-1 w-20">
                          <span className="text-sm font-medium">{star}</span>
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        </div>
                        <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-400 rounded-full transition-all duration-500"
                            style={{ width: getBarWidth(count, total) }}
                          />
                        </div>
                        <span className="text-sm text-muted-foreground w-16 text-end">
                          {count} ({pct}%)
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Recent Rated Messages */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              {isAr ? "آخر الردود المقيّمة" : "Recently Rated Responses"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingRecent ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="animate-pulse h-16 bg-muted rounded" />
                ))}
              </div>
            ) : !recentRated || recentRated.length === 0 ? (
              <div className="text-center py-12">
                <Star className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">{isAr ? "لا توجد تقييمات بعد" : "No ratings yet"}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentRated.map((msg: any, idx: number) => (
                  <div key={idx} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm line-clamp-2">{msg.content}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex">{renderStars(msg.rating || 0)}</div>
                        <Badge variant="outline" className="text-xs">
                          {new Date(msg.createdAt).toLocaleDateString(isAr ? "ar-SA" : "en-US")}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
}
