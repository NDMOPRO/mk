# المفتاح الشهري — Telegram Mini App

A Telegram Mini App for [Monthly Key (المفتاح الشهري)](https://monthlykey.com) — the leading monthly rental platform in Saudi Arabia.

## Live URL

**https://monthlykey-fssfos8r.manus.space**

Use this URL in [@BotFather](https://t.me/BotFather) via `/newapp` or `/setmenubutton` to register it as a Telegram Mini App.

## Features

- **Telegram Mini App SDK** integrated (`telegram-web-app.js`)
- **Smart redirect**: opens `monthlykey.com` via `Telegram.WebApp.openLink()` inside Telegram, or `window.location.href` outside
- **Auto-redirect countdown** (3 seconds) with manual override buttons
- **RTL Arabic layout** as primary with English support
- **Fonts**: Cairo, Tajawal (Arabic) · DM Sans, Inter (English)
- **Responsive** — optimized for Telegram mobile Mini App dimensions
- **Framer Motion** animations with entrance effects

## Stack

- React 19 + TypeScript
- Tailwind CSS 4
- Framer Motion
- Vite

## Development

```bash
pnpm install
pnpm dev
```

## Build

```bash
pnpm build
```

## Telegram Bot Setup

1. Open [@BotFather](https://t.me/BotFather) on Telegram
2. Use `/newapp` to create a new Mini App, or `/setmenubutton` to add it to an existing bot
3. Set the Web App URL to: `https://monthlykey-fssfos8r.manus.space`
4. The app will auto-open `monthlykey.com` for users

## How It Works

Inside Telegram, the app uses `Telegram.WebApp.openLink(url)` to open the real Monthly Key website in the user's default browser. Outside Telegram, it falls back to `window.location.href`. A branded splash screen with a 3-second countdown is shown while the redirect is prepared.
