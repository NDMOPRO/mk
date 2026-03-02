# CMS Build TODO

## Phase 1: Data Model + API
- [ ] Design cms_content table (key, titleAr, titleEn, bodyAr, bodyEn, imageUrl, altText, status, version)
- [ ] Design cms_content_versions table (audit trail)
- [ ] Design cms_media table (media library)
- [ ] Create migration script
- [ ] Build CMS TRPC router (CRUD + publish + rollback + audit)
- [ ] Seed initial content keys from current hardcoded content

## Phase 2: Admin CMS Screens
- [ ] AdminCMS page with content key list + search
- [ ] Content editor with rich text (AR/EN side-by-side)
- [ ] Media library with upload/replace/alt text
- [ ] Draft/Publish toggle + Preview Draft mode
- [ ] Version history + rollback UI
- [ ] CMS permissions (cms.view, cms.edit, cms.publish)

## Phase 3: Wire Header/Footer/Hero
- [ ] Replace header nav labels with CMS keys
- [ ] Replace footer content with CMS keys
- [ ] Replace homepage hero (title, subtitle, image, CTAs) with CMS keys
- [ ] useCmsContent() hook for public pages

## Phase 4: Wire Remaining Homepage
- [ ] Stats counters
- [ ] Services section
- [ ] How it works section
- [ ] Featured properties header
- [ ] Cities section + coming soon toggles
- [ ] Testimonials
- [ ] CTA section

## Phase 5: Wire Search + Property Pages
- [ ] Search page headings + empty state
- [ ] Property page disclaimers + helper text
- [ ] WhatsApp share text
- [ ] SEO defaults (site title, meta description, OG image)

## Phase 6: CI Guard + Registry
- [ ] Content Key Registry document
- [ ] Hardcoded Content Inventory (before/after)
- [ ] CI guard script
- [ ] Allowlist for technical strings

## Phase 7: Smoke Tests
- [ ] Test 1: Change hero title → verify live
- [ ] Test 2: Change hero image → verify live
- [ ] Test 3: Change nav/footer → verify live
- [ ] Test 4: Change empty state → verify
- [ ] Test 5: Change disclaimer → verify
- [ ] Test 6: AR/EN switch → verify
- [ ] Test 7: Rollback → verify + audit log
- [ ] Test 8: No hardcoded strings check
- [ ] Test 9: /api/health + core flows OK
