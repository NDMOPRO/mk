# Monthly Key Telegram Bot (المفتاح الشهري) 🔑

The official Telegram Bot for [Monthly Key](https://monthlykey.com) — the leading monthly rental platform in Saudi Arabia.

## Features

### Phase 1 (Core)
1.  **AI Customer Support Chatbot** — Powered by OpenAI GPT-4.1-mini, providing instant support in both Arabic and English.
2.  **Inline Property Search** — Search and share properties directly in any Telegram chat using `@monthlykey_bot`.
3.  **Telegram Mini App Integration** — Integrated directly with the [tg.monthlykey.com](https://tg.monthlykey.com) Mini App.
4.  **Push Notifications** — Real-time updates for new properties, price drops, and booking confirmations.
5.  **Bilingual Support** — Fully localized in Arabic and English with automatic language detection.

### Phase 2 (Booking & Payments)
6.  **Booking System** — Complete in-chat booking flow with property selection, date picking, cost breakdown (rent, deposit, service fee, VAT), and confirmation.
7.  **Payment Integration** — Telegram Payments API for in-chat invoice-based payments with pre-checkout validation and automatic booking confirmation.
8.  **Property Alerts** — Subscribe to alerts for specific cities, price ranges, and property types. Get notified instantly when matching properties are listed.

### Phase 3 (Admin & Expansion)
9.  **Admin Dashboard** — Commands for authorized admins to view analytics, manage bookings/listings, and broadcast messages to all users.
10. **Channel Auto-Posting** — Automatically post new property listings to a configured Telegram channel with rich cards and "Open in App" buttons.
11. **Multi-language Expansion** — Added support for **French**, **Urdu**, and **Hindi** to serve diverse users in Saudi Arabia.
12. **Enhanced Inline Sharing** — Rich property cards with images, prices, and direct booking/app links when searching via `@monthlykey_bot`.

## Commands

| Command | Description |
|---------|-------------|
| `/start` | Start the bot |
| `/search` | Search for properties |
| `/book` | Book a property |
| `/mybookings` | View your bookings |
| `/alerts` | View your property alerts |
| `/subscribe` | Subscribe to property alerts |
| `/unsubscribe` | Unsubscribe from alerts |
| `/notifications` | Notification settings |
| `/language` | Change language (AR/EN/FR/UR/HI) |
| `/help` | Show help guide |

### Admin Commands (Authorized Only)
| Command | Description |
|---------|-------------|
| `/admin` | Open Admin Dashboard |
| `/stats` | View bot statistics and analytics |
| `/broadcast` | Send message to all active users |
| `/manage_bookings` | View and manage pending bookings |
| `/manage_listings` | View listings from the API |

## Booking Flow

1. User runs `/book` or taps "Book This Property" on a search result
2. Selects a city and property (or provides property ID directly: `/book 123`)
3. Enters check-in date (YYYY-MM-DD format)
4. Enters check-out date (YYYY-MM-DD format)
5. Reviews booking summary with full cost breakdown (rent, deposit, service fee, VAT)
6. Confirms or cancels the booking
7. Chooses to pay now (Telegram Payment) or pay later
8. On successful payment, booking is confirmed automatically

## Admin Dashboard

Authorized admins (defined by `ADMIN_IDS` in `.env`) can access:
- **Real-time Analytics**: User growth, language breakdown, revenue, and booking stats.
- **Booking Management**: Approve or reject pending bookings with automatic user notification.
- **Listing Overview**: Browse current properties directly from the bot.
- **Global Broadcast**: Send formatted announcements to all active users.

## Channel Auto-Posting

The bot automatically monitors for new property listings and posts them to a configured Telegram channel (`CHANNEL_ID`).
- **Bilingual Posts**: Automatic Arabic/English formatting.
- **Rich Media**: Includes property photos and location details.
- **Action Buttons**: "View in App", "View on Website", and "Book Now" buttons.

## Enhanced Inline Sharing

Type `@monthlykey_bot` in any chat to search properties. 
- Results include rich property cards with photos.
- Direct links to the Mini App and Booking flow.
- Supports city and price range queries (e.g., `@monthlykey_bot riyadh 4000-6000`).

## Architecture

The bot is built using Node.js and the `telegraf` framework. It connects to the unified Monthly Key backend (tRPC) for real property data.

- **Frontend**: Served from `tg.monthlykey.com` (via the `tg-client/` folder in the main repo).
- **Backend**: Unified Express/Vite backend on Railway.
- **Bot Code**: Contained within this `telegram-bot/` directory.
- **Database**: SQLite (via `better-sqlite3`) for storing user preferences, bookings, alerts, and channel posting logs.

## Getting Started

### Prerequisites

- Node.js (v18+)
- A Telegram Bot Token (from [@BotFather](https://t.me/botfather))
- OpenAI API Key
- Payment Provider Token (Optional, for Phase 2)
- Admin IDs and Channel ID (Optional, for Phase 3)

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/NDMOPRO/mk.git
    cd mk/telegram-bot
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Configure environment variables:
    ```bash
    cp .env.example .env
    # Edit .env with your tokens and IDs
    ```

4.  Run the bot:
    ```bash
    npm start
    ```

## Project Structure

```text
telegram-bot/
├── src/
│   ├── index.js              # Main entry point
│   ├── config.js             # Configuration and constants
│   ├── i18n.js               # Internationalization (5 languages)
│   ├── handlers/
│   │   ├── commands.js       # Command handlers
│   │   ├── callbacks.js      # Inline button callback handlers
│   │   ├── inline.js         # Enhanced Inline query handler (Phase 3)
│   │   ├── booking.js        # Booking flow handler (Phase 2)
│   │   ├── payment.js        # Telegram Payments handler (Phase 2)
│   │   ├── alerts.js         # Property alerts handler (Phase 2)
│   │   └── admin.js          # Admin Dashboard handler (Phase 3)
│   └── services/
│       ├── api.js            # Monthly Key API client (tRPC)
│       ├── database.js       # SQLite database service
│       ├── ai.js             # OpenAI chat service
│       ├── notifications.js  # Push notification service
│       └── channel.js        # Channel auto-posting service (Phase 3)
├── data/
│   └── bot.db                # SQLite database (auto-created)
├── test/
│   ├── test_bot.js           # Phase 1 tests
│   ├── test_phase2.js        # Phase 2 tests
│   └── test_phase3.js        # Phase 3 tests
├── .env.example
├── package.json
└── README.md
```

## Environment Variables

```env
BOT_TOKEN=your_telegram_bot_token
OPENAI_API_KEY=your_openai_api_key
API_BASE_URL=https://monthlykey.com/api/trpc
WEBAPP_URL=https://tg.monthlykey.com
WEBSITE_URL=https://monthlykey.com
PAYMENT_PROVIDER_TOKEN=your_telegram_payment_provider_token
ADMIN_IDS=123456789,987654321
CHANNEL_ID=@your_channel
CHANNEL_CHECK_INTERVAL=300000
```

## Testing

```bash
# Run all tests
npm test

# Run specific phase tests
node test/test_bot.js
node test/test_phase2.js
node test/test_phase3.js
```

## Deployment

The bot is designed to be deployed alongside the main Monthly Key application. On Railway, you can add a new service or run it as a background process.

---
Built for [Monthly Key](https://monthlykey.com)
