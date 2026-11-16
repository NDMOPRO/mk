# Monthly Key — المفتاح الشهري

Monthly furnished-rental platform for Saudi Arabia: [monthlykey.com](https://monthlykey.com).

## What is deployed

Two Railway services in the **Monthly Key App** project, plus MySQL:

| Service | Source | Start |
|---|---|---|
| Monthly Key App (website + API) | repo root (`Dockerfile`, `start.sh`) | `./start.sh` |
| Telegram Bot | `telegram-bot/` | `node src/index.js` |

Pushing to `main` deploys both.

## Layout of the deployed app

| Path | Contents |
|---|---|
| `client/src/` | React + Vite front end (pages, components, `lib/i18n.tsx` for Arabic/English) |
| `server/` | Express + tRPC API. Routers in `server/routers/`, data access in `server/db.ts` |
| `drizzle/` | Database schema (`schema.ts`) and migrations |
| `shared/` | Code shared by client and server |
| `tests/`, `server/*.test.ts` | Vitest suites (`pnpm test`) |

## Not deployed

`tg-client/` **is** deployed: the website serves it as the Telegram Mini App on `tg.monthlykey.com`.

An unfinished multi-service platform (`apps/`, `services/`, `packages/`, `telegram-miniapp/`, `docker-compose.yml`), its tests, and one-off Telegram maintenance scripts were removed from `main` because nothing deployed uses them. They are preserved unchanged on the branch **`archive/pre-cleanup-2026-11`**.

## Commands

```bash
pnpm install
pnpm dev        # local server with hot reload
pnpm test       # all tests
pnpm check      # TypeScript type check
pnpm build      # production build
```

Configuration is read from environment variables; see `.env.example`. Never commit tokens or keys.

## Database schema

All schema changes go in a new `drizzle/NNNN_*.sql` migration (registered in `drizzle/meta/_journal.json`). `start.sh` runs them before the app starts, and a failed migration stops the deploy. The app itself never alters tables. Write MySQL syntax (no `ADD COLUMN IF NOT EXISTS`), separate statements with `--> statement-breakpoint`, and make changes safe to re-run (see `0027` for the guarded pattern). `server/migrations-integrity.test.ts` checks these rules.

## Documentation

- `docs/guides/`: developer, deployment and setup guides
- `docs/archive/`: past AI-session notes, reports and to-do lists, kept for history
- `scripts/legacy/`: one-off maintenance scripts (they read `RAILWAY_TOKEN` / `BOT_TOKEN` from the environment)
