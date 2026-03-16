/**
 * Dynamic OG Image Generator
 * 
 * Generates premium 1200x630 Open Graph images using Sharp + SVG overlay.
 * Two types:
 *   1. Homepage: branded hero with logo + Arabic/English name in navbar style
 *   2. Property: property photo background with dark overlay + text details
 * 
 * Arabic text is rendered via system Noto Sans Arabic font.
 * Images are cached in-memory with configurable TTL.
 */
import sharp from "sharp";
import path from "path";
import fs from "fs";

const WIDTH = 1200;
const HEIGHT = 630;

// In-memory cache: key → { buffer, timestamp }
const cache = new Map<string, { buffer: Buffer; timestamp: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

function getCached(key: string): Buffer | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.buffer;
}

function setCache(key: string, buffer: Buffer): void {
  // Limit cache size to prevent memory issues
  if (cache.size > 200) {
    const oldest = Array.from(cache.entries()).sort((a, b) => a[1].timestamp - b[1].timestamp);
    for (let i = 0; i < 50; i++) {
      cache.delete(oldest[i][0]);
    }
  }
  cache.set(key, { buffer, timestamp: Date.now() });
}

export function invalidateCache(key?: string): void {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}

/** Escape text for safe SVG embedding */
function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Format price with Arabic locale */
function fmtPrice(price: string | number): string {
  const num = typeof price === "string" ? parseFloat(price) : price;
  return new Intl.NumberFormat("ar-SA").format(num);
}

/** Truncate text to max length */
function truncate(str: string, max: number): string {
  if (!str) return "";
  return str.length > max ? str.substring(0, max) + "..." : str;
}

/** Resolve the logo SVG path (works in both dev and production) */
function getLogoSvgPath(): string {
  const candidates = [
    path.resolve(process.cwd(), "client/public/assets/brand/mk-logo-transparent.svg"),
    path.resolve(import.meta.dirname, "../client/public/assets/brand/mk-logo-transparent.svg"),
    path.resolve(import.meta.dirname, "public/assets/brand/mk-logo-transparent.svg"),
    path.resolve(process.cwd(), "dist/public/assets/brand/mk-logo-transparent.svg"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0];
}

/** Resolve the logo PNG path (fallback) */
function getLogoPngPath(): string {
  const candidates = [
    path.resolve(process.cwd(), "client/public/logo-mark-light.png"),
    path.resolve(import.meta.dirname, "../client/public/logo-mark-light.png"),
    path.resolve(import.meta.dirname, "public/logo-mark-light.png"),
    path.resolve(process.cwd(), "dist/public/logo-mark-light.png"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0];
}

/**
 * Generate the homepage OG image
 * Premium branded design matching the navbar style:
 * - Dark navy background with subtle gradient
 * - MK key logo centered with glow effect
 * - Arabic name "المفتاح الشهري" in elegant white text
 * - "MONTHLY KEY" in teal accent below
 * - Tagline and property type pills
 * - Gold accent line separator
 * - Clean, modern, premium feel
 */
export async function generateHomepageOG(): Promise<Buffer> {
  const cacheKey = "og:homepage:v3";
  const cached = getCached(cacheKey);
  if (cached) return cached;

  // Load logo — try SVG first, then PNG fallback
  let logoComposite: sharp.OverlayOptions[] = [];
  const logoSize = 160;
  try {
    const svgPath = getLogoSvgPath();
    const pngPath = getLogoPngPath();
    
    if (fs.existsSync(svgPath)) {
      const svgContent = fs.readFileSync(svgPath, "utf-8");
      const logoBuf = await sharp(Buffer.from(svgContent))
        .resize(logoSize, logoSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
      logoComposite = [{ input: logoBuf, top: 50, left: Math.round((WIDTH - logoSize) / 2) }];
    } else if (fs.existsSync(pngPath)) {
      const logoBuf = await sharp(pngPath)
        .resize(logoSize, logoSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
      logoComposite = [{ input: logoBuf, top: 50, left: Math.round((WIDTH - logoSize) / 2) }];
    }
  } catch (e) {
    console.warn("[OG] Logo load failed:", e);
  }

  // Property type pills
  const pills = ["شقق مفروشة", "استوديوهات", "فلل", "دوبلكس", "شقق فندقية"];
  const pillWidth = 130;
  const pillGap = 14;
  const totalPillsWidth = pills.length * pillWidth + (pills.length - 1) * pillGap;
  const pillStartX = (WIDTH - totalPillsWidth) / 2;
  const pillY = 460;

  const pillsSvg = pills.map((pill, i) => {
    const x = pillStartX + i * (pillWidth + pillGap);
    return [
      `<rect x="${x}" y="${pillY}" width="${pillWidth}" height="34" rx="17" fill="#3ECFC0" opacity="0.12"/>`,
      `<rect x="${x}" y="${pillY}" width="${pillWidth}" height="34" rx="17" fill="none" stroke="#3ECFC0" stroke-width="0.8" opacity="0.3"/>`,
      `<text x="${x + pillWidth / 2}" y="${pillY + 23}" text-anchor="middle" font-size="15" fill="#3ECFC0" font-family="'Noto Sans Arabic', 'Cairo', sans-serif" font-weight="600">${esc(pill)}</text>`,
    ].join("");
  }).join("");

  // Dot separators between pills
  const dotsSvg = pills.slice(0, -1).map((_, i) => {
    const x = pillStartX + (i + 1) * pillWidth + i * pillGap + pillGap / 2;
    return `<circle cx="${x}" cy="${pillY + 17}" r="2.5" fill="#3ECFC0" opacity="0.5"/>`;
  }).join("");

  const svg = [
    `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">`,
    `<defs>`,
    // Premium dark navy background gradient
    `<linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">`,
    `<stop offset="0%" style="stop-color:#071420;stop-opacity:1" />`,
    `<stop offset="35%" style="stop-color:#0B1E2D;stop-opacity:1" />`,
    `<stop offset="65%" style="stop-color:#0D2236;stop-opacity:1" />`,
    `<stop offset="100%" style="stop-color:#091A28;stop-opacity:1" />`,
    `</linearGradient>`,
    // Subtle radial glow behind logo
    `<radialGradient id="logoGlow" cx="50%" cy="25%" r="30%">`,
    `<stop offset="0%" style="stop-color:#3ECFC0;stop-opacity:0.06" />`,
    `<stop offset="50%" style="stop-color:#3ECFC0;stop-opacity:0.02" />`,
    `<stop offset="100%" style="stop-color:#3ECFC0;stop-opacity:0" />`,
    `</radialGradient>`,
    // Gold gradient for separator
    `<linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="0%">`,
    `<stop offset="0%" style="stop-color:#C5A55A;stop-opacity:0" />`,
    `<stop offset="20%" style="stop-color:#C5A55A;stop-opacity:0.6" />`,
    `<stop offset="50%" style="stop-color:#D4B96E;stop-opacity:1" />`,
    `<stop offset="80%" style="stop-color:#C5A55A;stop-opacity:0.6" />`,
    `<stop offset="100%" style="stop-color:#C5A55A;stop-opacity:0" />`,
    `</linearGradient>`,
    // Silver gradient for text
    `<linearGradient id="silverText" x1="0%" y1="0%" x2="0%" y2="100%">`,
    `<stop offset="0%" style="stop-color:#FFFFFF;stop-opacity:1" />`,
    `<stop offset="100%" style="stop-color:#C0C8D0;stop-opacity:1" />`,
    `</linearGradient>`,
    `</defs>`,

    // Background
    `<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>`,

    // Subtle radial glow
    `<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#logoGlow)"/>`,

    // Very subtle border frame
    `<rect x="30" y="25" width="${WIDTH - 60}" height="${HEIGHT - 50}" rx="12" fill="none" stroke="#3ECFC0" stroke-width="0.5" opacity="0.08"/>`,

    // Space for logo composite (y=50 to y=210)

    // Gold separator line below logo
    `<rect x="${WIDTH / 2 - 80}" y="225" width="160" height="2" rx="1" fill="url(#gold)"/>`,

    // Arabic brand name — large, elegant, white with slight gradient
    `<text x="${WIDTH / 2}" y="295" text-anchor="middle" font-size="72" font-weight="800" fill="url(#silverText)" font-family="'Noto Sans Arabic', 'Cairo', 'Tajawal', sans-serif">${esc("المفتاح الشهري")}</text>`,

    // English brand name — teal accent, wide letter spacing
    `<text x="${WIDTH / 2}" y="340" text-anchor="middle" font-size="22" fill="#3ECFC0" font-family="'Inter', 'DM Sans', 'Noto Sans', sans-serif" letter-spacing="10" font-weight="600">MONTHLY KEY</text>`,

    // Thin separator
    `<rect x="${WIDTH / 2 - 40}" y="365" width="80" height="1" rx="0.5" fill="#3ECFC0" opacity="0.3"/>`,

    // Tagline — Arabic
    `<text x="${WIDTH / 2}" y="405" text-anchor="middle" font-size="24" fill="#8899AA" font-family="'Noto Sans Arabic', 'Cairo', sans-serif" font-weight="500">${esc("منصة التأجير الشهري الرائدة في السعودية")}</text>`,

    // Property type pills
    pillsSvg,
    dotsSvg,

    // Bottom section — English tagline
    `<text x="${WIDTH / 2}" y="540" text-anchor="middle" font-size="16" fill="#4A6070" font-family="'Inter', 'Noto Sans', sans-serif" letter-spacing="3" font-weight="400">Monthly Key — Premium Monthly Rentals in Saudi Arabia</text>`,

    // Bottom gold accent line
    `<rect x="${WIDTH / 2 - 100}" y="${HEIGHT - 25}" width="200" height="2" rx="1" fill="url(#gold)" opacity="0.6"/>`,

    // Bottom corner dots (decorative)
    `<circle cx="50" cy="${HEIGHT - 40}" r="3" fill="#3ECFC0" opacity="0.15"/>`,
    `<circle cx="62" cy="${HEIGHT - 40}" r="3" fill="#3ECFC0" opacity="0.15"/>`,
    `<circle cx="74" cy="${HEIGHT - 40}" r="3" fill="#3ECFC0" opacity="0.15"/>`,
    `<circle cx="86" cy="${HEIGHT - 40}" r="3" fill="#3ECFC0" opacity="0.15"/>`,
    `<circle cx="98" cy="${HEIGHT - 40}" r="3" fill="#3ECFC0" opacity="0.15"/>`,

    `<circle cx="${WIDTH - 50}" cy="${HEIGHT - 40}" r="3" fill="#3ECFC0" opacity="0.15"/>`,
    `<circle cx="${WIDTH - 62}" cy="${HEIGHT - 40}" r="3" fill="#3ECFC0" opacity="0.15"/>`,
    `<circle cx="${WIDTH - 74}" cy="${HEIGHT - 40}" r="3" fill="#3ECFC0" opacity="0.15"/>`,
    `<circle cx="${WIDTH - 86}" cy="${HEIGHT - 40}" r="3" fill="#3ECFC0" opacity="0.15"/>`,
    `<circle cx="${WIDTH - 98}" cy="${HEIGHT - 40}" r="3" fill="#3ECFC0" opacity="0.15"/>`,

    `</svg>`,
  ].join("");

  const buffer = await sharp(Buffer.from(svg))
    .composite(logoComposite)
    .png({ quality: 90, compressionLevel: 6 })
    .toBuffer();

  setCache(cacheKey, buffer);
  return buffer;
}

const propertyTypeAr: Record<string, string> = {
  apartment: "شقة",
  villa: "فيلا",
  studio: "استوديو",
  duplex: "دوبلكس",
  furnished_room: "غرفة مفروشة",
  compound: "مجمع سكني",
  hotel_apartment: "شقة فندقية",
};

interface PropertyOGData {
  id: number;
  titleAr: string;
  titleEn?: string;
  propertyType: string;
  cityAr?: string;
  districtAr?: string;
  bedrooms?: number;
  bathrooms?: number;
  sizeSqm?: number;
  monthlyRent: string | number;
  photos?: string[] | string;
}

/**
 * Generate a property-specific OG image
 * If the property has a cover photo, use it as background with dark overlay.
 * Otherwise, generate a branded card with property details.
 */
export async function generatePropertyOG(prop: PropertyOGData): Promise<Buffer> {
  const cacheKey = `og:property:${prop.id}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  // Parse photos
  const photos: string[] = Array.isArray(prop.photos)
    ? prop.photos
    : typeof prop.photos === "string"
      ? JSON.parse(prop.photos || "[]")
      : [];
  const coverUrl = photos.find((p) => p && p.startsWith("http")) || "";

  let baseImage: Buffer;

  if (coverUrl) {
    // Try to fetch the cover photo and use it as background
    try {
      const response = await fetch(coverUrl, { signal: AbortSignal.timeout(5000) });
      if (response.ok) {
        const imgBuf = Buffer.from(await response.arrayBuffer());
        // Resize to 1200x630, cover mode, then apply dark overlay
        baseImage = await sharp(imgBuf)
          .resize(WIDTH, HEIGHT, { fit: "cover", position: "centre" })
          .composite([
            {
              input: Buffer.from(
                `<svg width="${WIDTH}" height="${HEIGHT}"><rect width="${WIDTH}" height="${HEIGHT}" fill="black" opacity="0.6"/></svg>`
              ),
              blend: "over",
            },
          ])
          .png()
          .toBuffer();
      } else {
        baseImage = await generatePropertyFallbackBG();
      }
    } catch {
      baseImage = await generatePropertyFallbackBG();
    }
  } else {
    baseImage = await generatePropertyFallbackBG();
  }

  // Build text overlay SVG
  const typeAr = propertyTypeAr[prop.propertyType] || prop.propertyType;
  const title = truncate(prop.titleAr || prop.titleEn || "عقار للإيجار", 40);
  const location = [prop.cityAr, prop.districtAr].filter(Boolean).join(" — ");
  const price = `${fmtPrice(prop.monthlyRent)} ر.س / شهر`;

  const highlights: string[] = [];
  if (prop.bedrooms) highlights.push(`${prop.bedrooms} غرف نوم`);
  if (prop.bathrooms) highlights.push(`${prop.bathrooms} حمامات`);
  if (prop.sizeSqm) highlights.push(`${prop.sizeSqm} م²`);
  const highlightText = highlights.join("  ●  ");

  let logoComposite: sharp.OverlayOptions[] = [];
  try {
    const svgPath = getLogoSvgPath();
    const pngPath = getLogoPngPath();
    const logoPath = fs.existsSync(svgPath) ? svgPath : pngPath;
    
    if (fs.existsSync(logoPath)) {
      const inputBuf = logoPath.endsWith(".svg") 
        ? Buffer.from(fs.readFileSync(logoPath, "utf-8"))
        : fs.readFileSync(logoPath);
      const logoBuf = await sharp(inputBuf)
        .resize(50, 50, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
      logoComposite = [{ input: logoBuf, top: HEIGHT - 70, left: WIDTH - 70 }];
    }
  } catch {}

  const overlaySvg = [
    `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">`,
    // Top accent bar
    `<rect x="0" y="0" width="${WIDTH}" height="5" fill="#3ECFC0"/>`,
    // Property type badge
    `<rect x="40" y="40" width="${typeAr.length * 22 + 40}" height="44" rx="22" fill="#3ECFC0" opacity="0.9"/>`,
    `<text x="${40 + (typeAr.length * 22 + 40) / 2}" y="68" text-anchor="middle" font-size="20" font-weight="bold" fill="#0A1628" font-family="'Noto Sans Arabic', 'Cairo', sans-serif">${esc(typeAr)}</text>`,
    // Title
    `<text x="${WIDTH / 2}" y="240" text-anchor="middle" font-size="52" font-weight="bold" fill="#ffffff" font-family="'Noto Sans Arabic', 'Cairo', sans-serif">${esc(title)}</text>`,
    // Location
    location
      ? `<text x="${WIDTH / 2}" y="300" text-anchor="middle" font-size="26" fill="#D1D5DB" font-family="'Noto Sans Arabic', 'Cairo', sans-serif">${esc(location)}</text>`
      : "",
    // Price
    `<rect x="${WIDTH / 2 - 180}" y="340" width="360" height="56" rx="28" fill="#C5A55A" opacity="0.9"/>`,
    `<text x="${WIDTH / 2}" y="376" text-anchor="middle" font-size="28" font-weight="bold" fill="#0A1628" font-family="'Noto Sans Arabic', 'Cairo', sans-serif">${esc(price)}</text>`,
    // Highlights
    highlightText
      ? `<text x="${WIDTH / 2}" y="450" text-anchor="middle" font-size="22" fill="#E5E7EB" font-family="'Noto Sans Arabic', 'Cairo', sans-serif">${esc(highlightText)}</text>`
      : "",
    // Bottom branding bar
    `<rect x="0" y="${HEIGHT - 5}" width="${WIDTH}" height="5" fill="#C5A55A"/>`,
    // Branding text
    `<text x="40" y="${HEIGHT - 25}" font-size="16" fill="#9CA3AF" font-family="'Noto Sans Arabic', 'Cairo', sans-serif">المفتاح الشهري  |  monthlykey.com</text>`,
    `</svg>`,
  ].join("");

  const buffer = await sharp(baseImage)
    .composite([
      { input: Buffer.from(overlaySvg), blend: "over" },
      ...logoComposite,
    ])
    .png({ quality: 90, compressionLevel: 6 })
    .toBuffer();

  setCache(cacheKey, buffer);
  return buffer;
}

/** Generate a branded fallback background for properties without photos */
async function generatePropertyFallbackBG(): Promise<Buffer> {
  const svg = [
    `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">`,
    `<defs>`,
    `<linearGradient id="pbg" x1="0%" y1="0%" x2="100%" y2="100%">`,
    `<stop offset="0%" style="stop-color:#0A1628;stop-opacity:1" />`,
    `<stop offset="100%" style="stop-color:#1a2d4a;stop-opacity:1" />`,
    `</linearGradient>`,
    `</defs>`,
    `<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#pbg)"/>`,
    // Subtle pattern
    `<rect x="100" y="100" width="1000" height="430" rx="8" fill="none" stroke="#3ECFC0" stroke-width="1" opacity="0.1"/>`,
    `<rect x="110" y="110" width="980" height="410" rx="6" fill="none" stroke="#C5A55A" stroke-width="1" opacity="0.08"/>`,
    `</svg>`,
  ].join("");

  return sharp(Buffer.from(svg)).png().toBuffer();
}
