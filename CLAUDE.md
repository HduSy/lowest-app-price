# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

App Store 全区比价 — a Chinese-language web tool where users paste an App Store link or App ID, and the backend concurrently scrapes 35 App Store regions' IAP/subscription prices, converts them to a single currency via live FX rates, and ranks them from cheapest to most expensive. Freemium model: anonymous users see locked results, logged-in unpaid users get 3 free unlocks/day, a $1.99 one-time Stripe payment unlocks unlimited access.

**Stack**: Next.js 15.5 (App Router) + React 19 + TypeScript 5.7 (strict) + Tailwind v4 + Zustand 5 + Auth.js v5 + Stripe, deployed to Cloudflare Workers/Pages via `@opennextjs/cloudflare`, backed by Cloudflare D1 (SQLite).

## Common Commands

```bash
# Local dev — use preview, NOT dev. Plain `npm run dev` lacks D1 bindings.
npm run preview        # OpenNext build + wrangler preview on port 8788 with full D1 bindings

# Production
npm run deploy         # Build + deploy to Cloudflare Workers
npm run build          # Next.js build only (does NOT deploy)

# Lint / types
npm run lint           # ESLint 9 flat config. NOTE: build ignores lint+type errors (see below)
npm run cf-typegen     # Regenerate Cloudflare binding types from wrangler.toml

# Database (D1 binding name: DB, database name: appstore-price)
npm run db:init        # Apply base schema remotely
npm run db:seed        # Seed 35 regions remotely
npm run db:local       # Init + seed the local shadow DB
# Apply a specific migration locally:
wrangler d1 execute appstore-price --local --file=migrations/00NN_xxx.sql
```

There is **no test framework** configured (no jest/vitest, no `*.test.*` files).

## Critical Build Caveats

`next.config.mjs` deliberately sets `eslint.ignoreDuringBuilds: true` and `typescript.ignoreBuildErrors: true` so deploys aren't blocked by pre-existing issues. **Do not assume a green build means clean code** — run `npm run lint` and `tsc --noEmit` separately to catch real problems. Don't "fix" this by removing the flags unless you've resolved the underlying issues.

## Architecture

### Geo-Localized Routing (middleware-first)

`src/middleware.ts` runs on every request: detects the user's IP country (via `req.cf.country` → `cf-ipcountry` header → `detected_country` cookie, fallback `"us"`), injects `x-detected-country` / `x-detected-timezone` / `x-geo-source` headers, and 307-redirects any bare URL to `/<country>/...`. Exempts `/api`, `/_next`, legal pages (`/privacy`, `/terms`, `/refunds`, `/legal`), SEO files (`/robots`, `/sitemap`, `/llms`, `/pricing`), and Next metadata routes. **Every public page lives under `src/app/[country]/...`** with one of 35 valid country codes (see `src/lib/regions.ts`).

### Data Flow

1. User submits App Store URL/ID → `POST /api/apps` → `src/lib/parse-input.ts` extracts `appId` → dedupe → `src/lib/itunes.ts` `fetchAppMeta()` → insert into D1 `apps`.
2. On app detail page (`src/app/[country]/apps/[appId]/page.tsx`), `src/app/[country]/apps/[appId]/refresh.ts` lazily refreshes prices if stale (`PRICE_TTL_HOURS = 6` in `src/lib/db.ts`):
   - **Phase 1**: fetch one priority region first for instant meta display.
   - **Phase 2**: crawl remaining regions concurrently via `src/lib/crawler.ts` `crawlAllRegions()`.
   - **Phase 3**: iTunes Lookup fallback to backfill ratings if the HTML scrape missed them.
3. `src/lib/exchange.ts` `getRates("USD")` fetches live FX; `src/lib/currencies.ts` `parsePrice()` normalizes per-region currency strings.
4. `src/lib/compare.ts` aggregates, converts, and ranks.

### Crawler Hardening (`src/lib/crawler.ts`)

Apple serves a 302-to-homepage redirect trap for unknown/unsupported apps — `fetchHtml()` detects and rejects this. `parseAppStoreHtml()` uses **multiple IAP-extraction strategies with fallbacks** because Apple's HTML structure changes over time. `detectPeriod()` infers `monthly`/`yearly`/`weekly`/`lifetime`/`one_time`. When editing the parser, preserve the fallback chain.

### Entitlement Gating (`src/lib/entitlement.ts`)

3-tier freemium logic — read this file before touching access control:
- `DAILY_VIEW_LIMIT = 3` — shared across all apps for unpaid users.
- `getEntitlement()` returns the current user's tier.
- `consumeDailyView()` is an **atomic conditional UPDATE** (don't rewrite as read-then-write).
- `authorizeAppView()` tiers: paid → full access; anonymous → locked view; logged-in unpaid → auto-consume 1 quota + record per-app unlock (idempotent within the same day via `app_unlocks` table).

### D1 Access (`src/lib/db.ts`)

All D1 access goes through `getCloudflareContext()` from OpenNext — never use a direct D1 binding import in app code. Functions: `listRegions`, `listApps`, `getApp`, `insertApp`, `updateAppMeta`, `markAppFetched`, `getPrices`, `upsertPrice`, `isStale`, `upsertUser`, `getUserByProvider`, `getUserById`, `insertPurchase`, `getUserPaidStatus`.

### Schema (`migrations/`)

11 SQL migrations. Final tables: `regions`, `apps`, `prices`, `users`, `purchases`, `daily_views`, `app_unlocks`. Note `0007_app_screenshots_description.sql` and `0007_apps_screenshots_description.sql` are **duplicate migrations** (one is a typo), and `0009_drop_description_screenshots.sql` reverts columns added by `0007`. The `REGIONS` array in `src/lib/regions.ts` must stay in sync with the seeded regions in `0002_seed_regions.sql` + `0010_add_5_european_regions.sql`.

### Auth (`src/lib/auth.ts`)

Auth.js v5 beta with Google / Twitter / GitHub providers, JWT strategy (no database sessions). On `signIn`, upserts the user into D1 and injects `role` ('user' / 'admin') into the JWT. `src/lib/session.ts` `getCurrentUser()` is the canonical accessor.

### API Surface (`src/app/api/`)

All routes are Next.js Route Handlers under `/api/*`:
- `GET /api/apps?q=&page=&limit=&sort=` — public list (sort: `recent` / `rating_count` / `rating` / `name`); `POST` adds (auth required).
- `GET /api/apps/:appId/prices?force=1` — lazily refreshes + enforces entitlement gating.
- `GET /api/apps/search` — local DB + iTunes Search API fallback.
- `GET /api/entitlement`, `POST /api/views/record`.
- `POST /api/stripe/checkout`, `POST /api/stripe/webhook` (records `paid` purchase).
- `GET /api/og/[appId]` — dynamic OG image.
- `/api/admin/*` — require `ADMIN_TOKEN` env: `backfill-period`, `cleanup-no-developer`, `cleanup-unavailable`, `import-from-sitemap`.
- `/api/auth/[...nextauth]` — Auth.js handlers.

### Client State (`src/lib/app-store.tsx`)

`AppStoreProvider` wraps the app in `src/app/layout.tsx`, holding default currency / language / geo source via Zustand. Server components read geo from the middleware-injected headers directly.

## Conventions

- **UI 文案**：通过 next-intl 做 i18n，messages 在 `messages/{locale}.json`（当前支持 zh-CN / en）。代码注释仍用中文。locale 来源优先级：cookie(`language`) > IP 检测国家映射 > 兜底 en。路由 `/<country>/...` 只承载国家，语种走 cookie 不进路由。
- **Path alias**: `@/*` → `./src/*`.
- **Types**: shared interfaces live in `src/lib/types.ts` (`Region`, `App`, `PriceRow`, `IapEntry`, `RegionFetchResult`, `AggregatedIap`, `RegionRankItem`, `PricesResponse`, `ExternalSearchItem`, `SubscriptionPeriod`).
- **Responses**: use `src/lib/api-response.ts` `json()` / `error()` helpers in route handlers.
- **Icons**: Phosphor Icons loaded from unpkg in `src/app/layout.tsx`.
- `env.d.ts` declares the global `CloudflareEnv` interface with `DB` binding + all secret keys (`AUTH_*`, `STRIPE_*`, `ADMIN_TOKEN`, `DEFAULT_CURRENCY`). Keep it in sync when adding bindings/secrets to `wrangler.toml` or `.dev.vars`.
