/**
 * VerificationGate Component
 *
 * Wraps content that requires email+phone verification.
 * Shows a verification prompt if the user is not fully verified.
 * Root admins and break-glass admins always bypass.
 */
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Mail, Phone, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { ReactNode } from "react";

interface VerificationGateProps {
  children: ReactNode;
  /** What this gate protects — shown in the prompt */
  actionLabel?: string;
  actionLabelAr?: string;
  /** If true, shows a soft warning instead of blocking */
  softBlock?: boolean;
}

export default function VerificationGate({ children, actionLabel, actionLabelAr, softBlock }: VerificationGateProps) {
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const { data: user, isLoading } = trpc.user.me.useQuery();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return <>{children}</>;

  // Root admin and break-glass admin always bypass
  if (user.role === "admin" || (user as any).isBreakglassAdmin) {
    return <>{children}</>;
  }

  const emailOk = !!(user as any).emailVerified;
  const phoneOk = !!(user as any).phoneVerified;
  const fullyVerified = emailOk && phoneOk;

  if (fullyVerified) return <>{children}</>;

  if (softBlock) {
    return (
      <div>
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 mb-4">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-amber-800 dark:text-amber-200">
                {isAr ? "التحقق غير مكتمل" : "Verification Incomplete"}
              </p>
              <p className="text-amber-700 dark:text-amber-300 mt-1">
                {isAr
                  ? "يرجى التحقق من بريدك الإلكتروني ورقم هاتفك لتتمكن من استخدام جميع الميزات."
                  : "Please verify your email and phone number to access all features."
                }
              </p>
              <div className="flex gap-2 mt-2">
                <Badge variant={emailOk ? "default" : "secondary"} className="text-xs">
                  {emailOk ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <Mail className="w-3 h-3 mr-1" />}
                  {isAr ? "البريد" : "Email"} {emailOk ? "✓" : "✗"}
                </Badge>
                <Badge variant={phoneOk ? "default" : "secondary"} className="text-xs">
                  {phoneOk ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <Phone className="w-3 h-3 mr-1" />}
                  {isAr ? "الهاتف" : "Phone"} {phoneOk ? "✓" : "✗"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
        {children}
      </div>
    );
  }

  // Hard block
  return (
    <Card className="max-w-md mx-auto mt-8">
      <CardContent className="flex flex-col items-center text-center py-10 px-6">
        <ShieldCheck className="w-16 h-16 text-primary/30 mb-4" />
        <h2 className="text-xl font-bold mb-2">
          {isAr ? "التحقق مطلوب" : "Verification Required"}
        </h2>
        <p className="text-muted-foreground text-sm mb-4">
          {isAr
            ? `يجب التحقق من بريدك الإلكتروني ورقم هاتفك ${actionLabelAr ? `لـ${actionLabelAr}` : "لإتمام هذا الإجراء"}.`
            : `You must verify your email and phone number ${actionLabel ? `to ${actionLabel}` : "to proceed"}.`
          }
        </p>
        <div className="flex flex-col gap-2 w-full mb-6">
          <div className={`flex items-center gap-3 p-3 rounded-lg ${emailOk ? "bg-green-50 dark:bg-green-950/20" : "bg-muted"}`}>
            {emailOk ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <Mail className="w-5 h-5 text-muted-foreground" />}
            <span className="text-sm">{isAr ? "البريد الإلكتروني" : "Email"}</span>
            <Badge variant={emailOk ? "default" : "secondary"} className="ml-auto text-xs">
              {emailOk ? (isAr ? "تم" : "Done") : (isAr ? "مطلوب" : "Required")}
            </Badge>
          </div>
          <div className={`flex items-center gap-3 p-3 rounded-lg ${phoneOk ? "bg-green-50 dark:bg-green-950/20" : "bg-muted"}`}>
            {phoneOk ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <Phone className="w-5 h-5 text-muted-foreground" />}
            <span className="text-sm">{isAr ? "رقم الهاتف" : "Phone Number"}</span>
            <Badge variant={phoneOk ? "default" : "secondary"} className="ml-auto text-xs">
              {phoneOk ? (isAr ? "تم" : "Done") : (isAr ? "مطلوب" : "Required")}
            </Badge>
          </div>
        </div>
        <Button onClick={() => window.location.href = "/tenant"} className="w-full">
          {isAr ? "الذهاب إلى لوحة التحكم للتحقق" : "Go to Dashboard to Verify"}
        </Button>
      </CardContent>
    </Card>
  );
}
