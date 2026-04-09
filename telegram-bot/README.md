# Monthly Key Telegram Bot (المفتاح الشهري) 🔑

The official Telegram Bot for [Monthly Key](https://monthlykey.com) — the leading monthly rental platform in Saudi Arabia.

## Features

1.  **AI Customer Support Chatbot** — Powered by OpenAI GPT-4.1-mini, providing instant support in both Arabic and English.
2.  **Inline Property Search** — Search and share properties directly in any Telegram chat using `@YourBotName`.
3.  **Telegram Mini App Integration** — Integrated directly with the [tg.monthlykey.com](https://tg.monthlykey.com) Mini App.
4.  **Push Notifications** — Real-time updates for new properties, price drops, and booking confirmations.
5.  **Bilingual Support** — Fully localized in Arabic and English with automatic language detection.

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
│   ├── handlers/      # Command, callback, and inline query handlers
│   ├── services/      # AI, API, Database, and Notification services
│   ├── config.js      # Configuration and constants
│   ├── i18n.js        # Internationalization (AR/EN)
│   └── index.js       # Main entry point
├── data/              # SQLite database storage
├── .env               # Environment variables
└── package.json       # Dependencies and scripts
```

## Deployment

The bot is designed to be deployed alongside the main Monthly Key application. On Railway, you can add a new service or run it as a background process.

---
Built for [Monthly Key](https://monthlykey.com) 🔑
