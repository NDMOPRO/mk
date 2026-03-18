# Centralized RTL/LTR Direction System — Implementation Report

**Date**: 2026-03-18  
**Commit**: `b7f091e`  
**Environment**: Production (monthlykey.sa)  
**Status**: Deployed and Verified

---

## Architecture Overview

The Monthly Key platform now uses a **single source of truth** for text direction: the `<html>` element's `dir` and `lang` attributes. Every component inherits direction automatically — no per-page `dir=` attributes needed.

### Direction Flow

```
localStorage("mk-lang")
    ↓
index.html pre-React script (prevents FOUC)
    ↓
<html dir="rtl|ltr" lang="ar|en">
    ↓
CSS logical properties cascade to all elements
    ↓
I18nProvider syncs React state with <html> attrs
```

---

## What Changed (36 files, 117 insertions, 175 deletions)

### 1. Pre-React Direction Sync (`client/index.html`)

A synchronous `<script>` in `<head>` reads `localStorage("mk-lang")` and sets `<html dir=... lang=...>` **before React loads**. This eliminates the flash of wrong direction (FOUC) that occurred when the page loaded in LTR then switched to RTL after React hydration.

### 2. Central CSS Direction Rules (`client/src/index.css`)

| Before | After |
|--------|-------|
| `.rtl-dashboard` hack that reversed ALL flex containers | Removed entirely |
| `margin-left: auto` / `margin-right: auto` | `margin-inline: auto` |
| `padding-left` / `padding-right` | `padding-inline-start` / `padding-inline-end` |
| `text-align: left` / `text-align: right` | `text-align: start` / `text-align: end` |
| Hardcoded `left`/`right` positioning | CSS logical properties |

New CSS rules added:

- **Font switching**: `[dir="rtl"]` uses `'Cairo', 'Tajawal', sans-serif`; `[dir="ltr"]` uses `'Inter', 'DM Sans', sans-serif`
- **Phone/email inputs**: Always LTR via `input[type="tel"], input[type="email"], input[type="url"] { direction: ltr; text-align: start; }`
- **Icon flipping**: `.rtl-flip-icon` class for directional icons (chevrons, arrows)
- **Mixed-direction content**: `.force-ltr` and `.force-rtl` utility classes

### 3. Removed Scattered `dir=` Attributes (34 files, 50+ removals)

| Pattern Removed | Count | Reason |
|----------------|-------|--------|
| `dir={dir}` | ~25 | Redundant — inherits from `<html>` |
| `dir={isAr ? "rtl" : "ltr"}` | ~10 | Redundant — same logic |
| `dir={lang === "ar" ? "rtl" : "ltr"}` | ~8 | Redundant — same logic |
| `dir={isRtl ? "rtl" : "ltr"}` | ~5 | Redundant — same logic |
| `dir="rtl"` on containers | 4 | Hardcoded — should follow `<html>` |
| `rtl-dashboard` class | 2 | Removed hack entirely |

### 4. Preserved Legitimate `dir=` Attributes (~80 instances)

These remain intentionally on **bilingual form inputs**:

- `dir="ltr"` on English name, address, email, phone, coordinate fields
- `dir="rtl"` on Arabic name, title, description fields
- `dir={key.endsWith("Ar") ? "rtl" : "ltr"}` in CMS editor

---

## Production Verification

| Test | Result |
|------|--------|
| Homepage — Arabic (RTL) | Text right-aligned, language toggle on left |
| Homepage — English (LTR) | Text left-aligned, language toggle on right |
| Admin Dashboard — Arabic | Sidebar on RIGHT, all text RTL |
| Admin Dashboard — English | Sidebar on LEFT, all text LTR |
| Language switch (instant) | No FOUC, no layout jump |
| Dashboard cards grid | Correct in both directions |
| Navigation items | Properly aligned in both directions |
| Build SHA visible | `faeee0d` confirmed |

---

## What Did NOT Change

- **Email templates** (`server/email.ts`): Already used `dir="${lang === "ar" ? "rtl" : "ltr"}"` — correct
- **WhatsApp notification template** (`server/taqnyat.ts`): Uses `dir="rtl"` — correct (always Arabic)
- **Sidebar positioning logic**: Uses `sidebarSide` prop — independent of CSS hack
- **Bilingual form inputs**: Keep explicit `dir="ltr"` / `dir="rtl"` — intentional

---

## Developer Guidelines for Future Components

1. **Never add `dir=` to page wrappers** — `<html dir=...>` handles it
2. **Use CSS logical properties**: `margin-inline`, `padding-inline`, `text-align: start`
3. **Only use `dir=` on inputs** that need a specific direction (phone, Arabic-only fields)
4. **Use `.force-ltr` / `.force-rtl`** utility classes for mixed-direction content
5. **Use `.rtl-flip-icon`** on directional icons that should mirror in RTL
6. **Test both directions** by clicking the language toggle
