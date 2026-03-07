/**
 * Twilio SMS Setup Guide for Supabase Phone Auth
 * No Manus AI dependencies — pure configuration guide
 */

export interface SetupStep {
  id: number;
  title: string;
  description: string;
  link?: string;
  linkLabel?: string;
}

export const twilioSetupSteps: SetupStep[] = [
  {
    id: 1,
    title: "إنشاء حساب Twilio",
    description: "قم بإنشاء حساب مجاني على Twilio. ستحصل على رصيد تجريبي مجاني لإرسال رسائل SMS.",
    link: "https://www.twilio.com/try-twilio",
    linkLabel: "إنشاء حساب Twilio",
  },
  {
    id: 2,
    title: "الحصول على Account SID و Auth Token",
    description: "بعد تسجيل الدخول، انتقل إلى Console Dashboard. ستجد Account SID و Auth Token في أعلى الصفحة.",
    link: "https://console.twilio.com/",
    linkLabel: "فتح Twilio Console",
  },
  {
    id: 3,
    title: "شراء رقم هاتف",
    description: "اشترِ رقم هاتف من Twilio يدعم إرسال SMS. اختر رقمًا يدعم المملكة العربية السعودية.",
    link: "https://console.twilio.com/us1/develop/phone-numbers/manage/incoming",
    linkLabel: "شراء رقم",
  },
  {
    id: 4,
    title: "إنشاء Messaging Service",
    description: "انتقل إلى Messaging → Services وأنشئ خدمة جديدة. أضف رقم الهاتف الذي اشتريته إلى الخدمة.",
    link: "https://console.twilio.com/us1/develop/sms/services",
    linkLabel: "إنشاء Messaging Service",
  },
  {
    id: 5,
    title: "تفعيل Phone Auth في Supabase",
    description: "انتقل إلى Supabase Dashboard → Authentication → Providers → Phone. فعّل Phone Provider وأدخل بيانات Twilio:\n\n• Account SID\n• Auth Token\n• Messaging Service SID\n\nاختر Twilio كمزود SMS.",
    link: "https://supabase.com/dashboard/project/_/auth/providers",
    linkLabel: "فتح Supabase Auth Settings",
  },
  {
    id: 6,
    title: "اختبار إرسال OTP",
    description: "بعد الإعداد، جرّب تسجيل الدخول برقم الجوال في التطبيق. ستصلك رسالة SMS تحتوي على رمز التحقق المكون من 6 أرقام.",
  },
];

export const twilioNotes = [
  "الحساب التجريبي يسمح بإرسال رسائل فقط للأرقام المُتحقق منها",
  "للإنتاج، يجب ترقية حساب Twilio وتسجيل رقم المرسل (Sender ID)",
  "تكلفة SMS للسعودية تقريباً $0.05 - $0.10 لكل رسالة",
  "يمكن استخدام Twilio Verify بدلاً من SMS المباشر لتحسين معدل التسليم",
];
