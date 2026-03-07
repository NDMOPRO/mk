/**
 * Push Notifications Service
 * Uses browser Notification API (Web Push) — no Firebase dependency needed.
 * For React Native, this would use expo-notifications or FCM.
 */

const NOTIFICATION_PREFS_KEY = "mk_notification_prefs";

export interface NotificationPrefs {
  enabled: boolean;
  bookingUpdates: boolean;
  newProperties: boolean;
  priceDrops: boolean;
  promotions: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  enabled: false,
  bookingUpdates: true,
  newProperties: true,
  priceDrops: true,
  promotions: false,
};

export function getNotificationPrefs(): NotificationPrefs {
  try {
    const stored = localStorage.getItem(NOTIFICATION_PREFS_KEY);
    return stored ? { ...DEFAULT_PREFS, ...JSON.parse(stored) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

export function saveNotificationPrefs(prefs: NotificationPrefs): void {
  localStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(prefs));
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) {
    console.warn("Browser does not support notifications");
    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  if (Notification.permission === "denied") {
    return false;
  }

  const permission = await Notification.requestPermission();
  return permission === "granted";
}

export function sendLocalNotification(title: string, body: string, icon?: string): void {
  if (Notification.permission !== "granted") return;

  new Notification(title, {
    body,
    icon: icon || "/favicon.ico",
    badge: "/favicon.ico",
    dir: "rtl",
    lang: "ar",
    tag: `mk-${Date.now()}`,
  });
}

// Notification templates for different events
export const notificationTemplates = {
  bookingConfirmed: (propertyName: string) => ({
    title: "تم تأكيد حجزك ✓",
    body: `تم تأكيد حجزك في ${propertyName}. يمكنك مراجعة التفاصيل في حجوزاتي.`,
  }),
  bookingCancelled: (propertyName: string) => ({
    title: "تم إلغاء الحجز",
    body: `تم إلغاء حجزك في ${propertyName}. تواصل معنا إذا كان لديك أي استفسار.`,
  }),
  newProperty: (cityName: string) => ({
    title: "عقار جديد متاح 🏠",
    body: `تم إضافة عقار جديد في ${cityName}. اطلع عليه الآن!`,
  }),
  priceDrop: (propertyName: string, newPrice: string) => ({
    title: "انخفاض في السعر 📉",
    body: `انخفض سعر ${propertyName} إلى ${newPrice} شهرياً.`,
  }),
  reminder: (propertyName: string) => ({
    title: "تذكير بالحجز ⏰",
    body: `لا تنسَ إكمال حجزك في ${propertyName}.`,
  }),
};
