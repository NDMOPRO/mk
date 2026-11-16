/**
 * Dynamic Sitemap Generator
 * Generates a comprehensive sitemap.xml with:
 * - Static pages (home, search, map, FAQ, legal, contact, submit-property)
 * - Dynamic property pages with lastmod from DB (published + active)
 * - City-filtered search pages
 * - hreflang annotations for Arabic/English
 */
import type { Request, Response } from "express";
import { getDb } from "../db";
import { properties } from "../../drizzle/schema";
import { eq, desc, or } from "drizzle-orm";

const BASE_URL = "https://monthlykey.com";

export async function sitemapHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = await getDb();

    // Static pages — only public, indexable routes
    const staticPages: Array<{ loc: string; changefreq: string; priority: string; lastmod?: string }> = [
      { loc: "/", changefreq: "daily", priority: "1.0" },
      { loc: "/search", changefreq: "daily", priority: "0.9" },
      { loc: "/map", changefreq: "weekly", priority: "0.7" },
      { loc: "/submit-property", changefreq: "monthly", priority: "0.6" },
      { loc: "/faq", changefreq: "monthly", priority: "0.5" },
      { loc: "/contact", changefreq: "monthly", priority: "0.5" },
      { loc: "/terms", changefreq: "monthly", priority: "0.3" },
      { loc: "/privacy", changefreq: "monthly", priority: "0.3" },
    ];

    // Dynamic pages: published + active properties
    let propertyPages: Array<{ loc: string; changefreq: string; priority: string; lastmod?: string }> = [];
    let cityPages: Array<{ loc: string; changefreq: string; priority: string; lastmod?: string }> = [];

    if (db) {
      try {
        const allProperties = await db
          .select({ 
            id: properties.id, 
            updatedAt: properties.updatedAt,
            city: properties.city,
          })
          .from(properties)
          .where(
            or(
              eq(properties.status, "active"),
              eq(properties.status, "published")
            )
          )
          .orderBy(desc(properties.updatedAt))
          .limit(5000);

        propertyPages = allProperties.map((p) => ({
          loc: `/property/${p.id}`,
          changefreq: "weekly",
          priority: "0.8",
          lastmod: p.updatedAt ? new Date(p.updatedAt).toISOString().split("T")[0] : undefined,
        }));

        // The search page filters by the lowercase English city name
        // (/search?city=riyadh), not the numeric id. List only cities that
        // actually have published properties, so "coming soon" cities and
        // empty result pages are not submitted to search engines.
        const citiesWithListings = new Set(
          allProperties.map((p) => (p.city || "").trim().toLowerCase()).filter(Boolean)
        );
        cityPages = Array.from(citiesWithListings).map((slug) => ({
          loc: `/search?city=${encodeURIComponent(slug)}`,
          changefreq: "weekly",
          priority: "0.7",
        }));
      } catch (dbErr) {
        console.warn("[Sitemap] DB query failed, generating static-only sitemap:", dbErr);
      }
    }

    const allPages = [...staticPages, ...propertyPages, ...cityPages];
    const today = new Date().toISOString().split("T")[0];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${allPages
  .flatMap((page) => {
    // Arabic lives at the plain URL, English at the same path with ?lang=en.
    // Each language gets its own <url> entry listing both alternates.
    const xmlEscape = (s: string) => s.replace(/&/g, "&amp;");
    const ar = xmlEscape(`${BASE_URL}${page.loc}`);
    const en = xmlEscape(`${BASE_URL}${page.loc}${page.loc.includes("?") ? "&" : "?"}lang=en`);
    return [ar, en].map(
      (loc) => `  <url>
    <loc>${loc}</loc>
    <lastmod>${page.lastmod || today}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
    <xhtml:link rel="alternate" hreflang="ar" href="${ar}" />
    <xhtml:link rel="alternate" hreflang="en" href="${en}" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${ar}" />
  </url>`
    );
  })
  .join("\n")}
</urlset>`;

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600"); // Cache for 1 hour
    res.status(200).send(xml);
  } catch (err) {
    console.error("[Sitemap] Error generating sitemap:", err);
    res.status(500).send("Error generating sitemap");
  }
}
