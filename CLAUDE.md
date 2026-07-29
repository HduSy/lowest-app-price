# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

App Store 全区比价 - a bilingual (zh-CN / en) web tool where users paste an App Store link or App ID, and the backend concurrently scrapes 40 App Store regions' IAP/subscription prices, converts them to a single currency via live FX rates, and ranks them from cheapest to most expensive. Freemium model: anonymous users see locked results, logged-in unpaid users get 3 free unlocks/day, a $1.99 one-time Stripe payment unlocks unlimited access.

**Stack**: Next.js 15.5 (App Router) + React 19 + TypeScript 5.7 (strict) + Tailwind v4 + Zustand 5 + Auth.js v5 + next-intl + Stripe, deployed to Cloudflare Workers/Pages via `@opennextjs/cloudflare`, backed by Cloudflare D1 (SQLite).

## Common Commands

```bash
# Local dev
npm run dev           # next dev; next.config.mjs calls initOpenNextCloudflareForDev() so D1 bindings are wired locally. Listens on http://localhost:3000 (see "Local Server Port" below)
npm run preview       # OpenNext build + wrangler preview on http://localhost:8787 (full wrangler fidelity; for deploy-only debugging). Mutually exclusive with `npm run dev`.

# Production
npm run deploy        # Build + deploy to Cloudflare Workers
npm run build         # Next.js build only (does NOT deploy)

# Lint / types
npm run lint          # ESLint 9 flat config. NOTE: build ignores lint+type errors (see below)
npm run cf-typegen    # Regenerate Cloudflare binding types from wrangler.toml
tsc --noEmit          # Type-check independently (build skips this)

# Database (D1 binding name: DB, database name: appstore-price)
npm run db:init       # Apply base schema remotely
npm run db:seed       # Seed regions remotely
npm run db:local      # Init + seed the local shadow DB
# Apply a specific migration locally:
wrangler d1 execute appstore-price --local --file=migrations/00NN_xxx.sql
```

There is **no test framework** configured (no jest/vitest, no `*.test.*` files). The `debug/norton360` route is the only manual test hook.

## Critical Build Caveats

`next.config.mjs` deliberately sets `eslint.ignoreDuringBuilds: true` and `typescript.ignoreBuildErrors: true` so deploys aren't blocked by pre-existing issues. **Do not assume a green build means clean code** - run `npm run lint` and `tsc --noEmit` separately to catch real problems. Don't "fix" this by removing the flags unless you've resolved the underlying issues.

Also: OpenNext does not support `export const runtime = "edge"` in route handlers (throws "cannot use the edge runtime"). Cloudflare Workers already runs everything on edge by default - omit the directive.

## Architecture

### Geo-Localized Routing (middleware-first)

`src/middleware.ts` runs on every request: detects the user's IP country (via `req.cf.country` -> `cf-ipcountry` header -> `detected_country` cookie, fallback `"us"`), injects `x-detected-country` / `x-detected-timezone` / `x-geo-source` headers, and 307-redirects any bare URL to `/<country>/...`. Exempts `/api`, `/_next`, legal pages (`/privacy`, `/terms`, `/refunds`, `/legal`), SEO files (`/robots`, `/sitemap`, `/llms`, `/pricing`), and Next metadata routes. **Every public page lives under `src/app/[country]/...`** with one of 40 valid country codes (see `src/lib/regions.ts`).

### i18n (`next-intl`)

The app supports **18 languages**: `messages/{locale}.json` for `ar / de / en / es / fr / hi / id / it / ja / ko / nl / pl / pt-BR / ru / th / tr / vi / zh-CN` (default `en`). `src/i18n/request.ts` exports `getRequestConfig` and resolves locale by: cookie(`language`) > IP-detected country mapping (`src/lib/languages.ts` `languageForCountry()`) > defaultLocale (`en`). The `next-intl/plugin` is wired in `next.config.mjs` via `withNextIntl`. Server components use `getTranslations()` from `next-intl/server`; client components use `useTranslations()`. The `/<country>/...` URL segment carries only the country, never the language - language is cookie-driven. `AppStoreProvider` (client) also mirrors the language in Zustand for the in-page picker.

#### i18n 翻译流程（改任何 UI 文案必须遵守）

**核心原则：任何 UI 文案改动 = 18 种语言全部同步**。漏翻会让对应语言用户看到 fallback 到 `en` 或 raw key 名，体验降级。流程：

1. **加 key**：先在 `messages/zh-CN.json`（中文母语原文）和 `messages/en.json`（英文参考）同时加新 key；JSON 顶层 namespace 按组件分（`PriceTable` / `ShareButton` / `RelatedApps` / `LoginDialog` 等）。
2. **同步 16 种其他语言**：每个新 key 都要翻成 ar/de/es/fr/hi/id/it/ja/ko/nl/pl/pt-BR/ru/th/tr/vi。可写 Node 脚本批量注入（参考历次 `messages/*.json` 注入脚本：`JSON.parse` → 改 `PriceTable`/新 namespace 段 → `JSON.stringify(data, null, 2)` 保留 2 空格缩进）。**幂等保护**：脚本开头先检查 key 是否已存在，已存在则跳过，避免重复执行覆盖手工精修。
3. **代码接入**：client component 用 `const t = useTranslations("Namespace");`，server component（含 `async function`）用 `const t = await getTranslations("Namespace");`。
4. **占位符规范**：
   - 变量插值用 ICU `{varName}`，调用时 `t("key", { varName: value })`。
   - 富文本（含 `<bold>` 等内联 JSX 包裹）用 `t.rich("key", { bold: (chunks) => <span ...>{chunks}</span> })`，messages 里写 `"text <bold>{var}</bold> more"`。
   - **`$1.99` 是品牌价，所有语言保留字面 `$1.99`，不本地化货币符号或换算**。
5. **JSON 验证**：改完跑 `node -e "JSON.parse(require('fs').readFileSync('messages/X.json','utf8'))"` 或循环全部 18 个文件，避免尾随逗号 / 缺逗号导致 next-intl 启动报错。
6. **lint + type check**：`npm run lint` 干净 + `tsc --noEmit` 不引入新错误（预存在的 fetch-返回-unknown 等错误忽略）。

**翻译质量**：拉丁语系（de/es/fr/it/nl/pl/pt-BR/ru）+ 日韩越印尼 把握高；ar/hi/th/tr 用母语化表达（如价格语境 ar 用 `الأرخص/الأغلى` 而非 `الأقل/الأعلى`，hi 弃音译 `सब्सक्रिप्शन` 改母语 `सदस्यता`，th 表头用 `คิดเป็น` 而非 `แปลงแล้ว`）。改这些语种时优先参考已有同类 key 的用词。

**已 i18n 化的组件**：`PriceTable` / `LockedBanner`（PriceTable 内子组件）/ `IapTabs` / `IapPriceList` / `RelatedApps` + `RelatedAppsSkeleton` / `ShareButton`。仍可能有零散硬编码中文，发现就按上述流程补。

### Data Flow

1. User submits App Store URL/ID -> `POST /api/apps` -> `src/lib/parse-input.ts` extracts `appId` -> dedupe -> `src/lib/itunes.ts` `fetchAppMeta()` -> insert into D1 `apps`.
2. On app detail page (`src/app/[country]/apps/[appId]/page.tsx`), `src/app/[country]/apps/[appId]/refresh.ts` lazily refreshes prices if stale (`PRICE_TTL_HOURS = 6` in `src/lib/db.ts`):
   - **Phase 1**: fetch one priority region first for instant meta display.
   - **Phase 2**: crawl remaining regions concurrently via `src/lib/crawler.ts` `crawlAllRegions()`.
   - **Phase 3**: iTunes Lookup fallback to backfill ratings if the HTML scrape missed them.
3. `src/lib/exchange.ts` `getRates("USD")` fetches live FX; `src/lib/currencies.ts` `parsePrice()` normalizes per-region currency strings.
4. `src/lib/compare.ts` aggregates, converts, and ranks.

### Crawler Hardening (`src/lib/crawler.ts`)

Apple serves a 302-to-homepage redirect trap for unknown/unsupported apps - `fetchHtml()` detects and rejects this. `parseAppStoreHtml()` uses **multiple IAP-extraction strategies with fallbacks** because Apple's HTML structure changes over time. `detectPeriod()` infers `monthly`/`yearly`/`weekly`/`lifetime`/`one_time`. When editing the parser, preserve the fallback chain.

### Entitlement Gating (`src/lib/entitlement.ts`)

3-tier freemium logic - read this file before touching access control:
- `DAILY_VIEW_LIMIT = 3` - shared across all apps for unpaid users.
- `getEntitlement()` returns the current user's tier.
- `consumeDailyView()` is an **atomic conditional UPDATE** (don't rewrite as read-then-write).
- `authorizeAppView()` tiers: paid -> full access; anonymous -> locked view; logged-in unpaid -> auto-consume 1 quota + record per-app unlock (idempotent within the same day via `app_unlocks` table).

### D1 Access (`src/lib/db.ts`)

All D1 access goes through `getCloudflareContext()` from OpenNext - never use a direct D1 binding import in app code. Functions: `listRegions`, `listApps`, `getApp`, `insertApp`, `updateAppMeta`, `markAppFetched`, `getPrices`, `upsertPrice`, `isStale`, `upsertUser`, `upsertUserByEmail`, `getUserByProvider`, `getUserById`, `insertPurchase`, `getUserPaidStatus`.

### Schema (`migrations/`)

12 migration files (0001-0011, plus a duplicate `0007_app_screenshots_description.sql` / `0007_apps_screenshots_description.sql` where one filename is a typo). Final tables: `regions`, `apps`, `prices`, `users`, `purchases`, `daily_views`, `app_unlocks`, `magic_link_tokens`. `0009_drop_description_screenshots.sql` reverts columns added by `0007`. `0011_magic_link_tokens.sql` adds the magic-link token table. The `REGIONS` array in `src/lib/regions.ts` (currently 40 entries) must stay in sync with the seeded regions in `0002_seed_regions.sql` + `0010_add_5_european_regions.sql`.

### Auth (`src/lib/auth.ts`)

Auth.js v5 beta, JWT strategy (no database sessions - Cloudflare-friendly). Providers configured:
- **Google OAuth** - shown in `LoginDialog`, primary path.
- **Magic Link** (email) - bridged through a `Credentials` provider with id `magic-link`. Flow: `POST /api/auth/magic/request` generates a token (`src/lib/magic-token.ts`), stores its SHA-256 hash in `magic_link_tokens`, emails it via Resend (`src/lib/email.ts`). User clicks -> `GET /api/auth/magic/verify` checks the hash + expiry, then signs an HMAC over the email with `AUTH_SECRET` and calls `signIn("credentials", {email, sig})`. The `authorize` callback only trusts that HMAC (constant-time compared, see `verifyEmailSignature`). Token plaintext is never stored in DB.
- **Twitter / GitHub** - config retained but **not shown** in `LoginDialog` (developer console review pending). Don't remove their provider entries.

On `signIn`, OAuth providers upsert the user into D1; Magic Link upserts inside `authorize`. The `jwt` callback injects `dbUserId` + `role` ('user' / 'admin') into the JWT. `src/lib/session.ts` `getCurrentUser()` is the canonical accessor.

### API Surface (`src/app/api/`)

All routes are Next.js Route Handlers under `/api/*`:
- `GET /api/apps?q=&page=&limit=&sort=` - public list (sort: `recent` / `rating_count` / `rating` / `name`); `POST` adds (auth required).
- `GET /api/apps/:appId/prices?force=1` - lazily refreshes + enforces entitlement gating.
- `GET /api/apps/search` - local DB + iTunes Search API fallback.
- `GET /api/entitlement`, `POST /api/views/record`.
- `POST /api/stripe/checkout`, `POST /api/stripe/webhook` (records `paid` purchase).
- `GET /api/og/[appId]` - dynamic OG image.
- `/api/admin/*` - require `ADMIN_TOKEN` env: `backfill-period`, `cleanup-no-developer`, `cleanup-unavailable`, `import-from-sitemap`.
- `/api/auth/[...nextauth]` - Auth.js handlers.
- `POST /api/auth/magic/request` (body: `{email}`) + `GET /api/auth/magic/verify?token=...` - magic link send + verify. Both respond 200 even on failure to avoid leaking which emails exist.

### Client State (`src/lib/app-store.tsx`)

`AppStoreProvider` wraps the app in `src/app/layout.tsx`, holding default currency / language / geo source via Zustand. Server components read geo from the middleware-injected headers directly.

## Conventions

- **UI 文案**：通过 next-intl 做 i18n，messages 在 `messages/{locale}.json`（**18 种语言**，详见上文「i18n 翻译流程」小节）。代码注释仍用中文。locale 来源优先级：cookie(`language`) > IP 检测国家映射 > 兜底 en。路由 `/<country>/...` 只承载国家，语种走 cookie 不进路由。**改任何 UI 文案都必须同步全 18 种语言**，不能只改 zh-CN + en。
- **Path alias**: `@/*` -> `./src/*`.
- **Types**: shared interfaces live in `src/lib/types.ts` (`Region`, `App`, `PriceRow`, `IapEntry`, `RegionFetchResult`, `AggregatedIap`, `RegionRankItem`, `PricesResponse`, `ExternalSearchItem`, `SubscriptionPeriod`).
- **Responses**: use `src/lib/api-response.ts` `json()` / `error()` helpers in route handlers.
- **Icons**: Phosphor Icons loaded from unpkg in `src/app/layout.tsx`.
- `env.d.ts` declares the global `CloudflareEnv` interface with `DB` binding + all secret keys (`AUTH_*` incl. `AUTH_GOOGLE_*` / `AUTH_TWITTER_*` / `AUTH_GITHUB_*` / `AUTH_SECRET`, `STRIPE_*`, `ADMIN_TOKEN`, `DEFAULT_CURRENCY`, `RESEND_API_KEY`, `MAIL_FROM`). Keep it in sync when adding bindings/secrets to `wrangler.toml` or `.dev.vars`.

## Local Server Port

**原则：每个功能的服务端口固定，不随机、不并存。** 当前两个功能端口：

| 功能 | 命令 | 端口 | 说明 |
|------|------|------|------|
| 日常开发 | `npm run dev` | **http://localhost:3000** | `next dev` + `initOpenNextCloudflareForDev()`，D1 绑定已内嵌，无需 wrangler sidecar |
| Deploy-only 调试 | `npm run preview` | **http://localhost:8787** | OpenNext build + wrangler preview，完整 wrangler 保真度 |

**强制规则：**

- **3000 与 8787 互斥**：同一时刻只能有一个在跑。要切到另一个，先 kill 当前的整个进程树，确认 `lsof -i:3000 -i:8787 -sTCP:LISTEN -P` 为空，再起另一个。并存会导致浏览器调试到旧构建、D1 数据分裂。
- **端口坏掉时不要绕到其他端口**：先 `kill` 占用进程 → 确认端口空闲 → 用固定命令重启。绝不用 `--port` 改成 3001/8788 之类。
- **默认走 3000**：日常开发永远用 `npm run dev`。`npm run preview` 仅用于排查 deploy-only 问题（构建产物行为 vs 源码行为差异）。
