# Monthly Key Telegram Bot (المفتاح الشهري) 🔑

The official Telegram Bot for [Monthly Key](https://monthlykey.com) — the leading monthly rental platform in Saudi Arabia.

## Features

### Phase 1 (Core)
1.  **AI Customer Support Chatbot** — Powered by OpenAI GPT-4.1-mini, providing instant support in both Arabic and English.
2.  **Inline Property Search** — Search and share properties directly in any Telegram chat using `@YourBotName`.
3.  **Telegram Mini App Integration** — Integrated directly with the [tg.monthlykey.com](https://tg.monthlykey.com) Mini App.
4.  **Push Notifications** — Real-time updates for new properties, price drops, and booking confirmations.
5.  **Bilingual Support** — Fully localized in Arabic and English with automatic language detection.

### Phase 2 (New)
6.  **Booking System** — Complete in-chat booking flow with property selection, date picking, cost breakdown (rent, deposit, service fee, VAT), and confirmation.
7.  **Payment Integration** — Telegram Payments API for in-chat invoice-based payments with pre-checkout validation and automatic booking confirmation.
8.  **Property Alerts** — Subscribe to alerts for specific cities, price ranges, and property types. Get notified instantly when matching properties are listed.

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
| `/language` | Change language (AR/EN) |
| `/help` | Show help guide |

## Booking Flow

1. User runs `/book` or taps "Book This Property" on a search result
2. Selects a city and property (or provides property ID directly: `/book 123`)
3. Enters check-in date (YYYY-MM-DD format)
4. Enters check-out date (YYYY-MM-DD format)
5. Reviews booking summary with full cost breakdown (rent, deposit, service fee, VAT)
6. Confirms or cancels the booking
7. Chooses to pay now (Telegram Payment) or pay later

## Payment Integration

The bot uses Telegram's built-in Payments API:

1. Bot sends an invoice with itemized price breakdown
2. User taps "Pay" and enters payment details
3. Bot validates the pre-checkout query
4. On successful payment, booking is confirmed automatically
5. User receives payment confirmation with booking details

**Setup:** Configure `PAYMENT_PROVIDER_TOKEN` from @BotFather (Payments section).

## Property Alerts

Users can subscribe to alerts with specific criteria:

- **City filter** — Riyadh, Jeddah, Madinah, or all cities
- **Price range** — Minimum and maximum monthly rent (e.g., 3000-8000 SAR)
- **Property type** — Apartment, villa, studio, etc.

Quick subscribe: `/subscribe riyadh 3000-8000`

## Architecture

The bot is built using Node.js and the `telegraf` framework. It connects to the unified Monthly Key backend (tRPC) for real property data.

- **Frontend**: Served from `tg.monthlykey.com` (via the `tg-client/` folder in the main repo).
- **Backend**: Unified Express/Vite backend on Railway.
- **Bot Code**: Contained within this `telegram-bot/` directory.
- **Database**: SQLite (via `better-sqlite3`) for storing user preferences and notification subscriptions.

## Getting Started

### Prerequisites

- Node.js (v18+)
- A Telegram Bot Token (from [@BotFather](https://t.me/botfather))
- OpenAI API Key

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
    # Edit .env with your tokens
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
│   ├── i18n.js               # Internationalization (AR/EN)
│   ├── handlers/
│   │   ├── commands.js       # Command handlers (start, search, help, etc.)
│   │   ├── callbacks.js      # Inline button callback handlers
│   │   ├── inline.js         # Inline query handler
│   │   ├── booking.js        # Booking flow handler (Phase 2)
│   │   ├── payment.js        # Telegram Payments handler (Phase 2)
│   │   └── alerts.js         # Property alerts handler (Phase 2)
│   └── services/
│       ├── api.js            # Monthly Key API client (tRPC)
│       ├── database.js       # SQLite database service
│       ├── ai.js             # OpenAI chat service
│       └── notifications.js  # Push notification service
├── data/
│   └── bot.db                # SQLite database (auto-created)
├── test/
│   ├── test_bot.js           # Phase 1 tests
│   └── test_phase2.js        # Phase 2 tests (28 tests)
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
```

## Testing

```bash
# Run Phase 1 tests
node test/test_bot.js

# Run Phase 2 tests
node test/test_phase2.js
```

## Deployment

The bot is designed to be deployed alongside the main Monthly Key application. On Railway, you can add a new service or run it as a background process.

---
Built for [Monthly Key](https://monthlykey.com)
