import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";
import { prerenderMiddleware } from "../middleware/prerender";
import { eq } from "drizzle-orm";
import { integrationConfigs } from "../../drizzle/schema";
import { getDb } from "../db";

// ── GA4 measurement ID cache (loaded from DB, refreshed every 5 min) ──
let ga4MeasurementId: string = '';
let ga4CacheExpiry = 0;

async function getGA4MeasurementId(): Promise<string> {
  const now = Date.now();
  if (ga4MeasurementId && now < ga4CacheExpiry) return ga4MeasurementId;
  try {
    // Reuse the shared DB connection instead of creating a new pool each time
    const db = await getDb();
    if (!db) return ga4MeasurementId; // DB not ready yet, return cached/empty
    const [row] = await db.select().from(integrationConfigs)
      .where(eq(integrationConfigs.integrationKey, 'ga4'));
    if (row?.isEnabled && row.configJson) {
      const config = JSON.parse(row.configJson);
      ga4MeasurementId = config.measurementId || '';
    } else {
      ga4MeasurementId = '';
    }
    ga4CacheExpiry = now + 5 * 60 * 1000; // 5 min cache
  } catch (err) {
    console.error('[GA4] Failed to load measurement ID from DB:', err);
  }
  return ga4MeasurementId;
}

// Inject GA4 measurement ID into HTML template, replacing %VITE_GA_MEASUREMENT_ID%
function injectGA4IntoHtml(html: string, measurementId: string): string {
  if (!measurementId) {
    // Remove the GA4 script block entirely if no measurement ID
    return html
      .replace(/<!-- Google tag \(gtag\.js\) -->\s*<script[^>]*googletagmanager[^<]*<\/script>\s*<script>[\s\S]*?<\/script>/m, '<!-- GA4 not configured -->')
      .replace(/%VITE_GA_MEASUREMENT_ID%/g, '');
  }
  return html.replace(/%VITE_GA_MEASUREMENT_ID%/g, measurementId);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  // Return proper 404 for missing uploaded files in dev mode too
  app.use("/uploads/*", (_req, res) => {
    res.status(404).json({ error: "File not found" });
  });
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      // Inject GA4 measurement ID from DB at runtime
      const gaId = await getGA4MeasurementId();
      const finalPage = injectGA4IntoHtml(page, gaId);
      res.status(200).set({ "Content-Type": "text/html" }).end(finalPage);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");

  // ─── Telegram Mini App (tg.monthlykey.com) ─────────────────────────
  const tgClientPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "tg-client")
      : path.resolve(import.meta.dirname, "..", "tg-client");
  let tgHtmlTemplate = '';
  const tgIndexPath = path.resolve(tgClientPath, "index.html");
  try {
    if (fs.existsSync(tgIndexPath)) {
      tgHtmlTemplate = fs.readFileSync(tgIndexPath, 'utf-8');
      console.log('[TG] Telegram Mini App HTML template loaded');
    } else {
      console.log('[TG] No tg-client/index.html found, TG Mini App disabled');
    }
  } catch (err) {
    console.error('[TG] Failed to load TG Mini App template:', err);
  }

  // Helper to check if request is for TG Mini App subdomain
  function isTgHost(req: express.Request): boolean {
    const host = (req.hostname || req.headers.host || '').toLowerCase();
    return host.startsWith('tg.') || host === 'tg.monthlykey.com';
  }

  // Serve TG static assets under /tg/ path prefix
  if (fs.existsSync(tgClientPath)) {
    app.use('/tg', express.static(tgClientPath, {
      maxAge: '1y',
      immutable: true,
      etag: true,
      lastModified: true,
      index: false,
    }));
    console.log(`[TG] Serving TG assets from: ${tgClientPath}`);
  }
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  // Read the HTML template once for prerender middleware
  const indexPath = path.resolve(distPath, "index.html");
  let htmlTemplate = '';
  try {
    htmlTemplate = fs.readFileSync(indexPath, 'utf-8');
    console.log('[Prerender] HTML template loaded for bot serving');
  } catch (err) {
    console.error('[Prerender] Failed to load HTML template:', err);
  }

  // Prerender middleware for bots - MUST be before express.static
  // so bot requests to / /search /property/:id are intercepted first
  if (htmlTemplate) {
    app.use(prerenderMiddleware(htmlTemplate));
  }

  // Serve static assets with long cache headers for immutable files
  app.use(express.static(distPath, {
    maxAge: '1y',           // Long cache for hashed assets
    immutable: true,        // Assets are content-hashed, safe to cache forever
    etag: true,
    lastModified: true,
    index: false,           // Don't serve index.html for / - let SPA fallback handle it
    setHeaders: (res, filePath) => {
      // HTML files: short cache with stale-while-revalidate for fast repeat loads
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      }
      // Service worker MUST NOT be cached — browsers need to check for updates
      else if (filePath.endsWith('sw.js') || filePath.endsWith('service-worker.js')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
      // CSS/JS with hash in filename - cache for 1 year
      else if (filePath.match(/\.(js|css)$/)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
      // Images - cache for 30 days
      else if (filePath.match(/\.(png|jpg|jpeg|gif|svg|webp|avif|ico)$/)) {
        res.setHeader('Cache-Control', 'public, max-age=2592000');
      }
      // Fonts - cache for 1 year
      else if (filePath.match(/\.(woff|woff2|ttf|eot)$/)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  }));

  // Redirect missing uploads to R2 when S3 is configured, else 404
  app.use("/uploads/*", (req, res) => {
    const s3PublicBase = (process.env.S3_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
    if (s3PublicBase) {
      const objectKey = req.path.replace(/^\/uploads\//, "");
      res.redirect(301, `${s3PublicBase}/${objectKey}`);
    } else {
      res.status(404).json({ error: "File not found" });
    }
  });

  // SPA fallback: serve index.html for all non-file requests
  app.use("*", async (req, res) => {
    // TG Mini App: serve TG index.html for tg.monthlykey.com requests
    if (isTgHost(req) && tgHtmlTemplate) {
      res.status(200).set({
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
      }).send(tgHtmlTemplate);
      return;
    }

    if (htmlTemplate) {
      // Inject GA4 measurement ID from DB at runtime
      const gaId = await getGA4MeasurementId();
      const finalHtml = injectGA4IntoHtml(htmlTemplate, gaId);
      res.status(200).set({
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
      }).send(finalHtml);
    } else {
      res.sendFile(indexPath);
    }
  });
}
