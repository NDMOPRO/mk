// App constants — no external dependencies
export const APP_NAME = "المفتاح الشهري";
export const APP_NAME_EN = "Monthly Key";

// Login URL helper — used by Supabase Auth flow
export function getLoginUrl(returnPath?: string): string {
  return returnPath ? `/?return=${encodeURIComponent(returnPath)}` : "/";
}
