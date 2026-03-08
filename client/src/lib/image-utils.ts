/**
 * Shared image URL normalization utility.
 * Handles:
 * - /uploads/* paths → kept as-is (server redirects to R2 when S3 configured)
 * - Old absolute URLs containing /uploads/ → stripped to relative /uploads/...
 * - External URLs (Unsplash, etc.) → proxied through /api/img-proxy
 * - data: URLs → kept as-is
 * - Already-relative paths → kept as-is
 */
export function normalizeImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  // data: URLs — pass through
  if (url.startsWith("data:")) return url;
  // Already a relative /uploads/ path — pass through (server handles R2 redirect)
  if (url.startsWith("/uploads/")) return url;
  // Old absolute URL containing /uploads/ on any domain → extract relative path
  if (url.includes("/uploads/")) {
    return "/uploads/" + url.split("/uploads/").pop();
  }
  // Already a relative path (e.g. /assets/...) — pass through
  if (url.startsWith("/")) return url;
  // R2 public URL — pass through (already publicly accessible)
  if (url.includes(".r2.dev/")) return url;
  // CloudFront URL — pass through (already publicly accessible)
  if (url.includes(".cloudfront.net/")) return url;
  // External URL (Unsplash, etc.) → proxy through our server to avoid hotlink blocking
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return `/api/img-proxy?url=${encodeURIComponent(url)}`;
  }
  // Fallback — return as-is
  return url;
}

/**
 * Placeholder image for broken/missing property photos.
 * Uses a simple SVG data URL to avoid external dependencies.
 */
export const BROKEN_IMAGE_PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect fill='%23f1f5f9' width='400' height='300'/%3E%3Ctext x='200' y='140' text-anchor='middle' fill='%2394a3b8' font-family='system-ui' font-size='16'%3ENo Image%3C/text%3E%3Cpath d='M180 170 l20-20 l20 20 l20-30 l20 30' stroke='%23cbd5e1' fill='none' stroke-width='2'/%3E%3C/svg%3E";

/**
 * onError handler for img elements — replaces broken images with placeholder.
 */
export function handleImageError(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  if (img.src !== BROKEN_IMAGE_PLACEHOLDER) {
    img.src = BROKEN_IMAGE_PLACEHOLDER;
  }
}
