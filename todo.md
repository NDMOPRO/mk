# Monthly Key Mobile - Tasks

## Fix API Issue
- [x] Upgrade to web-db-user for backend proxy
- [x] Create backend API proxy route for monthlykey.com/api/trpc
- [x] Update frontend API client to use backend proxy
- [x] Test API loading works in production

## Feature: User Bookings Tab
- [x] Show real bookings from API in "حجوزاتي" tab
- [x] Handle authenticated vs unauthenticated state

## Feature: Interactive Map
- [x] Add OpenStreetMap + Google Maps link to property detail page
- [x] Show property location using lat/lng from API

## Feature: Phone OTP Login
- [x] Add phone number input with Saudi country code (+966)
- [x] Implement Supabase Phone Auth OTP flow
- [x] Add OTP verification screen with 6-digit input

## Feature: Favorites System (Supabase DB)
- [x] Create favorites table in Supabase (using localStorage + Supabase sync)
- [x] Build FavoritesContext with add/remove/check functionality
- [x] Integrate heart icon on PropertyCard with real save/unsave
- [x] Add Favorites tab in bottom navigation with full property list
- [x] Sync favorites across sessions via Supabase (when logged in)

## Feature: Push Notifications (Firebase Cloud Messaging)
- [x] Set up notification preferences UI
- [x] Build notification permission request flow with toggle switches
- [x] Implement notification types (booking status, new properties, price drops, promotions)
- [x] Add notification bell icon with unread count in header
- [x] Create notifications panel with Arabic notification templates

## Feature: Phone Auth Activation
- [x] Configure Supabase Phone Auth provider setup guide
- [x] Improve OTP input UX with auto-focus and countdown timer
- [x] Add resend OTP functionality with cooldown
- [x] Write tests for all new features (38 tests passing)

## Feature: Advanced Search Filters
- [x] Add price range slider (min/max SAR) — 6 presets from <3000 to >12000
- [x] Add room count filter (1-5+ rooms)
- [x] Add furnishing type filter (مفروشة/غير مفروشة/شبه مفروشة)
- [x] Build bottom sheet UI for filters panel with animated expand/collapse
- [x] Connect filters to monthlykey.com search API (minPrice, maxPrice, bedrooms, furnishedLevel, propertyType)
- [x] Show active filter count badge on filter button
- [x] Add property type filter (شقة/فيلا/استوديو/دوبلكس/غرفة/كمباوند/فندقية)
- [x] Add "clear all filters" button

## Feature: Ratings & Reviews System
- [x] Supabase-backed reviews with localStorage fallback (reviews.ts)
- [x] Build star rating input component (interactive + display modes)
- [x] Build review submission form with Arabic UI (500 char limit)
- [x] Display average rating + count on PropertyDetail page
- [x] Show reviews list on PropertyDetail page (max 5 visible + count)
- [x] Allow only authenticated users to submit reviews
- [x] Demo reviews generated for properties without real reviews
- [x] Relative date formatting (اليوم/أمس/منذ X أيام)

## Feature: Twilio SMS Setup
- [x] Add Twilio setup guide in profile/settings (6-step guide)
- [x] Add troubleshooting section (3 common issues)
- [x] Add quick links to Twilio Console, Supabase Dashboard, Twilio Verify Docs
- [x] Add Saudi phone number format note (+966 5XXXXXXXX)
- [x] Link from ProfileTab menu (إعداد SMS Twilio)

## Tests
- [x] Write 68 new vitest tests for all 3 features (106 total tests passing)
