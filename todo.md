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
