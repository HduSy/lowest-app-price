// D1 数据库查询封装
// 在 OpenNext for Cloudflare 里，通过 getCloudflareContext() 拿到 env

import type { App, PriceRow, Region, SubscriptionPeriod } from "./types";

/** 获取 D1 binding（通过 OpenNext 的 getCloudflareContext） */
export async function getDb(): Promise<D1Database> {
  const { getCloudflareContext } = await import("@opennextjs/cloudflare");
  const ctx = getCloudflareContext();
  if (!ctx?.env?.DB) {
    throw new Error(
      "D1 binding 未找到。请确保已配置 wrangler.toml 且通过 opennextjs-cloudflare preview 运行，或已部署到 Cloudflare Pages。"
    );
  }
  return ctx.env.DB;
}

// ============ 序列化：genres/compatibility 在 DB 存 JSON 字符串 ============
function parseArr(s: unknown): string[] | null {
  if (typeof s !== "string") return null;
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : null;
  } catch {
    return null;
  }
}

interface RawAppRow {
  app_id: string;
  name: string;
  developer: string | null;
  icon_url: string | null;
  bundle_id: string | null;
  category: string | null;
  genres: string | null;
  compatibility: string | null;
  subtitle: string | null;
  price_label: string | null;
  rating: number | null;
  rating_count: number | null;
  last_fetched_at: string | null;
  submitted_at: string;
}

function mapApp(r: RawAppRow): App {
  return {
    app_id: r.app_id,
    name: r.name,
    developer: r.developer,
    icon_url: r.icon_url,
    bundle_id: r.bundle_id,
    category: r.category,
    genres: parseArr(r.genres),
    compatibility: parseArr(r.compatibility),
    subtitle: r.subtitle,
    priceLabel: r.price_label,
    rating: r.rating,
    ratingCount: r.rating_count,
    last_fetched_at: r.last_fetched_at,
    submitted_at: r.submitted_at,
  };
}

const APP_COLUMNS =
  "app_id, name, developer, icon_url, bundle_id, category, genres, compatibility, subtitle, price_label, rating, rating_count, last_fetched_at, submitted_at";

// ============ 地区 ============
export async function listRegions(db: D1Database): Promise<Region[]> {
  const rows = await db
    .prepare(
      "SELECT code, name, name_en, flag, currency, sort_order FROM regions ORDER BY sort_order"
    )
    .all<Region>();
  return rows.results;
}

// ============ App 列表 ============
/** 排序方式：Apple 不公开下载量/安装量/订阅量，rating_count（评分数）是最接近热度的指标 */
export type AppSortKey = "recent" | "rating_count" | "rating" | "name";

const SORT_CLAUSES: Record<AppSortKey, string> = {
  recent: "submitted_at DESC",
  rating_count: "rating_count DESC, submitted_at DESC",
  rating: "rating DESC, submitted_at DESC",
  name: "name COLLATE NOCASE ASC",
};

export interface ListAppsParams {
  q?: string;
  page?: number;
  limit?: number;
  sort?: AppSortKey;
}

export async function listApps(
  db: D1Database,
  { q = "", page = 1, limit = 60, sort = "rating_count" }: ListAppsParams
): Promise<{ items: App[]; total: number; page: number; limit: number }> {
  const safeLimit = Math.min(100, Math.max(10, limit));
  const offset = (Math.max(1, page) - 1) * safeLimit;
  const orderClause = SORT_CLAUSES[sort] || SORT_CLAUSES.recent;
  if (q) {
    const like = `%${q}%`;
    const items = await db
      .prepare(
        `SELECT ${APP_COLUMNS} FROM apps
         WHERE name LIKE ?1 OR developer LIKE ?2 OR app_id LIKE ?3
         ORDER BY ${orderClause} LIMIT ?4 OFFSET ?5`
      )
      .bind(like, like, like, safeLimit, offset)
      .all<RawAppRow>();
    const total =
      (
        await db
          .prepare(
            `SELECT COUNT(*) as c FROM apps
             WHERE name LIKE ?1 OR developer LIKE ?2 OR app_id LIKE ?3`
          )
          .bind(like, like, like)
          .first<{ c: number }>()
      )?.c || 0;
    return {
      items: items.results.map(mapApp),
      total,
      page,
      limit: safeLimit,
    };
  }
  const items = await db
    .prepare(
      `SELECT ${APP_COLUMNS} FROM apps ORDER BY ${orderClause} LIMIT ?1 OFFSET ?2`
    )
    .bind(safeLimit, offset)
    .all<RawAppRow>();
  const total =
    (await db.prepare("SELECT COUNT(*) as c FROM apps").first<{ c: number }>())?.c ||
    0;
  return { items: items.results.map(mapApp), total, page, limit: safeLimit };
}

export async function getApp(db: D1Database, appId: string): Promise<App | null> {
  const r = await db
    .prepare(`SELECT ${APP_COLUMNS} FROM apps WHERE app_id=?1`)
    .bind(appId)
    .first<RawAppRow>();
  return r ? mapApp(r) : null;
}

/** 批量检查哪些 appId 已在库中（用于 App Store 搜索结果标记"已收录"） */
export async function getExistingAppIds(
  db: D1Database,
  appIds: string[]
): Promise<Set<string>> {
  if (appIds.length === 0) return new Set();
  const placeholders = appIds.map((_, i) => `?${i + 1}`).join(",");
  const r = await db
    .prepare(`SELECT app_id FROM apps WHERE app_id IN (${placeholders})`)
    .bind(...appIds)
    .all<{ app_id: string }>();
  return new Set(r.results.map((row) => row.app_id));
}

export interface InsertAppInput {
  app_id: string;
  name: string;
  developer: string | null;
  icon_url: string | null;
  bundle_id: string | null;
  category: string | null;
  genres: string[] | null;
  compatibility: string[] | null;
  subtitle?: string | null;
  priceLabel?: string | null;
  rating?: number | null;
  ratingCount?: number | null;
}

export async function insertApp(db: D1Database, app: InsertAppInput): Promise<void> {
  await db
    .prepare(
      `INSERT INTO apps
         (app_id, name, developer, icon_url, bundle_id, category, genres, compatibility,
          subtitle, price_label, rating, rating_count, submitted_at, updated_at)
       VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,datetime('now'),datetime('now'))`
    )
    .bind(
      app.app_id,
      app.name,
      app.developer,
      app.icon_url,
      app.bundle_id,
      app.category,
      app.genres ? JSON.stringify(app.genres) : null,
      app.compatibility ? JSON.stringify(app.compatibility) : null,
      app.subtitle ?? null,
      app.priceLabel ?? null,
      app.rating ?? null,
      app.ratingCount ?? null
    )
    .run();
}

/** 抓取后回填简介 / 价格摘要 / 兼容设备 / 评分（仅写入非空值，避免覆盖已有数据） */
export async function updateAppMeta(
  db: D1Database,
  appId: string,
  meta: {
    subtitle?: string | null;
    priceLabel?: string | null;
    compatibility?: string[] | null;
    rating?: number | null;
    ratingCount?: number | null;
  }
): Promise<void> {
  const sets: string[] = [];
  const binds: (string | number | null)[] = [];
  if (meta.subtitle) {
    sets.push("subtitle = ?");
    binds.push(meta.subtitle);
  }
  if (meta.priceLabel) {
    sets.push("price_label = ?");
    binds.push(meta.priceLabel);
  }
  if (meta.compatibility) {
    sets.push("compatibility = ?");
    binds.push(JSON.stringify(meta.compatibility));
  }
  if (meta.rating != null && meta.rating > 0) {
    sets.push("rating = ?");
    binds.push(meta.rating);
  }
  if (meta.ratingCount != null && meta.ratingCount > 0) {
    sets.push("rating_count = ?");
    binds.push(meta.ratingCount);
  }
  if (!sets.length) return;
  sets.push("updated_at = datetime('now')");
  binds.push(appId);
  await db
    .prepare(`UPDATE apps SET ${sets.join(", ")} WHERE app_id = ?`)
    .bind(...binds)
    .run();
}

export async function markAppFetched(
  db: D1Database,
  appId: string
): Promise<void> {
  await db
    .prepare(
      "UPDATE apps SET last_fetched_at=datetime('now'), updated_at=datetime('now') WHERE app_id=?1"
    )
    .bind(appId)
    .run();
}

// ============ 价格 ============
export async function getPrices(
  db: D1Database,
  appId: string
): Promise<PriceRow[]> {
  const rows = await db
    .prepare(
      `SELECT p.app_id, p.region_code, p.iap_key, p.iap_name, p.price_raw,
              p.amount, p.currency, p.amount_usd, p.period, p.fetched_at,
              r.name AS region_name, r.flag
       FROM prices p
       JOIN regions r ON r.code = p.region_code
       WHERE p.app_id = ?1
       ORDER BY p.iap_key, p.amount_usd`
    )
    .bind(appId)
    .all<PriceRow>();
  return rows.results;
}

export async function upsertPrice(
  db: D1Database,
  p: {
    app_id: string;
    region_code: string;
    iap_key: string;
    iap_name: string;
    price_raw: string;
    amount: number;
    currency: string;
    amount_usd: number | null;
    period: SubscriptionPeriod;
  }
): Promise<void> {
  await db
    .prepare(
      `INSERT OR REPLACE INTO prices
         (app_id, region_code, iap_key, iap_name, price_raw, amount, currency, amount_usd, period, fetched_at)
       VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,datetime('now'))`
    )
    .bind(
      p.app_id,
      p.region_code,
      p.iap_key,
      p.iap_name,
      p.price_raw,
      p.amount,
      p.currency,
      p.amount_usd,
      p.period
    )
    .run();
}

// ============ 工具：判断时间戳是否过期 ============
export function isStale(ts: string | null, ttlHours: number): boolean {
  if (!ts) return true;
  const t = new Date(ts.replace(" ", "T") + "Z").getTime();
  return Date.now() - t > ttlHours * 3600 * 1000;
}

// ============ 用户（OAuth 登录） ============
export interface UserRow {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
  oauth_provider: string;
  oauth_account_id: string;
  role: string;
}

/** upsert 用户：存在则更新 email/name/image，不存在则插入新行 */
export async function upsertUser(
  db: D1Database,
  input: {
    oauth_provider: string;
    oauth_account_id: string;
    email: string | null;
    name: string | null;
    image: string | null;
  }
): Promise<{ id: string }> {
  const existing = await db
    .prepare("SELECT id FROM users WHERE oauth_provider = ?1 AND oauth_account_id = ?2")
    .bind(input.oauth_provider, input.oauth_account_id)
    .first<{ id: string }>();

  if (existing) {
    await db
      .prepare(
        `UPDATE users SET email = ?1, name = ?2, image = ?3, updated_at = datetime('now')
         WHERE id = ?4`
      )
      .bind(input.email, input.name, input.image, existing.id)
      .run();
    return { id: existing.id };
  }

  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO users (id, email, name, image, oauth_provider, oauth_account_id, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, datetime('now'), datetime('now'))`
    )
    .bind(id, input.email, input.name, input.image, input.oauth_provider, input.oauth_account_id)
    .run();
  return { id };
}

export async function getUserByProvider(
  db: D1Database,
  provider: string,
  providerAccountId: string
): Promise<UserRow | null> {
  return await db
    .prepare(
      "SELECT id, email, name, image, oauth_provider, oauth_account_id, role FROM users WHERE oauth_provider = ?1 AND oauth_account_id = ?2"
    )
    .bind(provider, providerAccountId)
    .first<UserRow>();
}

export async function getUserById(db: D1Database, id: string): Promise<UserRow | null> {
  return await db
    .prepare(
      "SELECT id, email, name, image, oauth_provider, oauth_account_id, role FROM users WHERE id = ?1"
    )
    .bind(id)
    .first<UserRow>();
}

// ============ 购买记录（$1.99 买断） ============

/** 插入购买记录（幂等：stripe_session_id 冲突时忽略） */
export async function insertPurchase(
  db: D1Database,
  input: {
    id: string;
    user_id: string;
    stripe_session_id: string;
    stripe_customer_id: string | null;
    amount_cents: number;
    currency: string;
    status: string;
  }
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO purchases (id, user_id, stripe_session_id, stripe_customer_id, amount_cents, currency, status, purchased_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, datetime('now'))
       ON CONFLICT(stripe_session_id) DO NOTHING`
    )
    .bind(
      input.id,
      input.user_id,
      input.stripe_session_id,
      input.stripe_customer_id,
      input.amount_cents,
      input.currency,
      input.status
    )
    .run();
}

/** 查用户是否已付费（有 paid 记录） */
export async function getUserPaidStatus(
  db: D1Database,
  userId: string
): Promise<boolean> {
  const row = await db
    .prepare("SELECT 1 FROM purchases WHERE user_id = ?1 AND status = 'paid' LIMIT 1")
    .bind(userId)
    .first<{ "1": number }>();
  return !!row;
}
