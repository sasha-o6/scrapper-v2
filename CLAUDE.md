# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Telegram channel monitoring system: a single central mtcute userbot scrapes configured channels, filters messages per user, and forwards matches to each user's target chat. Users configure everything through a Telegram Mini App (TMA). Stack: Bun + Hono (API), Preact + Vite (TMA frontend), Prisma + PostgreSQL, mtcute (Telegram MTProto).

Note: `DOCUMENTATION.md` is the original spec (in Ukrainian) and describes a multi-userbot design with per-user MTProto login. The actual implementation diverged: there is **one central userbot** whose session lives in the `SystemState` table, authorized by the admin only. `README.md` reflects the current reality. Config/filtering is still multi-tenant per `telegram_id`.

## Commands

```bash
bun install                        # install deps
docker compose up postgres         # local Postgres on localhost:5433 (not 5432, to avoid conflicts)
bunx prisma generate && bunx prisma db push   # prepare DB
bun run dev                        # API with hot reload (port 3000)
bun run dev:web                    # Vite frontend dev server (port 5173, proxies /api to 3000)

bun run typecheck                  # tsc --noEmit
bun test                           # all tests (bun:test, in tests/)
bun test tests/formatter.test.ts   # single test file
bun run build                      # vite build (dist/client) + bun build (dist/server)

docker compose up --build                      # full app in Docker (port 3000)
docker compose --profile tunnel up -d --build  # with Cloudflare tunnel
```

Local dev without a real Mini App: set `ALLOW_DEV_AUTH=true` and `DEV_TELEGRAM_ID` in `.env` — the auth middleware then accepts requests without initData. Copy `.env.example` to `.env` first; `BOT_TOKEN`, `ADMIN_PHONE`, `ADMIN_TELEGRAM_ID`, `TELEGRAM_API_ID`, `TELEGRAM_API_HASH` are required at startup (`src/backend/env.ts` throws on missing vars).

## Architecture

Path aliases (tsconfig + vite): `@backend/*`, `@frontend/*`, `@shared/*` → `src/backend`, `src/frontend`, `src/shared`. `src/shared/types.ts` holds the DTO contracts used by both sides.

### Backend wiring

All services are instantiated once in `src/backend/services/container.ts` (constructor injection, no DI framework) and consumed by `src/backend/app.ts` (Hono routes) and `src/backend/main.ts` (startup: restore userbot session → start queue worker → start admin bot polling → serve).

### Message pipeline (the core flow)

1. `ClientManager` holds the single mtcute `TelegramClient`; its session string is persisted in Postgres via `SystemSessionStorageAdapter` (no `.session` files). A mtcute Dispatcher `newMessage` handler feeds every incoming message to `ScraperService`.
2. `ScraperService.handleIncomingMessage`: normalize (`TelegramMessageNormalizer`) → find active configs whose channel list matches the source (`ChannelMatcher`) → filter (`MessageFilter`: ban words reject first, then key words are OR-matched, then additional words AND-matched when `strictMode` is on) → dedupe via `ProcessedMessage` unique constraint (`P2002` = already processed) → format (`Formatter`, MarkdownV2-style with escaping) → insert into `MessageQueue` as `PENDING`.
3. `MessageQueueWorker` polls every `QUEUE_INTERVAL_MS` (one item per tick, no in-memory queues), sends via the userbot, and marks `SENT`/`FAILED`. Special case: if the target chat is the bot itself, it sends through the Bot API (`BotApiClient`) to the queue owner's DM instead.
4. `HistoricalFetcher` runs the same filtering over channel history with paginated fetches and sleeps between batches to avoid `FLOOD_WAIT`.

### Auth (two separate flows)

- **TMA users**: `src/backend/middleware/auth.ts` validates Telegram `initData` HMAC (from `Authorization: tma <initData>` or `x-telegram-init-data` header) and resolves/creates the user; all `/api/*` routes under `protectedApi` are scoped to that user. Dev bypass via `ALLOW_DEV_AUTH`.
- **Central userbot login (admin only)**: `AdminBotService` long-polls the Bot API; when the admin (`ADMIN_TELEGRAM_ID`) sends `/login`, it replies with a one-time link to a web login page (`AdminLoginWebService` + `routes/adminLogin.ts`) where the Telegram code and 2FA password are entered — never in the chat (Telegram invalidates codes pasted into chats).

### Channel joining

`ConfigService` diffs channel lists on config update and asks `ClientManager` to join new channels, spacing joins by `JOIN_INTERVAL_MS` to avoid `FLOOD_WAIT`. Per-channel join status (`IChannelConfig.joinStatus`) is stored in `Config.channelItems` (JSON) and surfaced in the UI.

## Code style (mandatory per DOCUMENTATION.md §3)

- TypeScript strict; interfaces prefixed `I`, type aliases prefixed `T`; use `import type`.
- Preact: destructure props; extract logic into custom hooks (`src/frontend/hooks/`); memoize heavy computations and callbacks (`useMemo`/`useCallback`/`memo`); lazy-load components via the `dynamic()` util; show Skeleton loaders while loading.
- Styling: Tailwind + SCSS modules, combined with the `cn()` util (`clsx` + `tailwind-merge`); desktop-first breakpoints.
- Animations: pure CSS, `transform`/`opacity` only — no animation libraries.
- Backend: single-responsibility services, pure functions for filtering/formatting, no dead code.
