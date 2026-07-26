// 权限分层 helper：付费状态 + 每日免费查看配额
// 规则：
//   未登录 -> 看不到完整价格（PriceTable locked，只显示 top3）
//   登录未付费 -> 每天 3 次免费查看完整价格（跨 App 共享，UTC 日切）
//   $1.99 付费 -> 永久无限查看
import { getDb } from "./db";

export const DAILY_VIEW_LIMIT = 3;

export interface Entitlement {
  loggedIn: boolean;
  paid: boolean;
  dailyUsed: number;
  dailyLimit: number;
  /** 是否可查看完整价格（已付费 或 当日配额未用完） */
  canViewFull: boolean;
}

/** 获取今日 UTC 日期字符串 'YYYY-MM-DD' */
export function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

/** 查用户权益：付费状态 + 今日已用次数 */
export async function getEntitlement(userId: string | null): Promise<Entitlement> {
  if (!userId) {
    return {
      loggedIn: false,
      paid: false,
      dailyUsed: 0,
      dailyLimit: DAILY_VIEW_LIMIT,
      canViewFull: false,
    };
  }
  const db = await getDb();
  // 付费状态：查 purchases 表是否有 paid 记录
  const paidRow = await db
    .prepare("SELECT 1 FROM purchases WHERE user_id = ?1 AND status = 'paid' LIMIT 1")
    .bind(userId)
    .first<{ "1": number }>();
  const paid = !!paidRow;
  // 今日已用次数
  const today = todayUTC();
  const viewRow = await db
    .prepare("SELECT count FROM daily_views WHERE user_id = ?1 AND view_date = ?2")
    .bind(userId, today)
    .first<{ count: number }>();
  const dailyUsed = viewRow?.count ?? 0;
  const canViewFull = paid; // 只有付费用户可直接查看完整；未付费需点"消耗1次"解锁
  return { loggedIn: true, paid, dailyUsed, dailyLimit: DAILY_VIEW_LIMIT, canViewFull };
}

/**
 * 扣减一次当日配额（仅登录未付费用户需要）
 * 用 INSERT ON CONFLICT DO UPDATE WHERE 做原子条件扣减
 * @returns success 是否扣减成功（配额未满），dailyUsed 扣减后次数
 */
export async function consumeDailyView(
  userId: string
): Promise<{ success: boolean; dailyUsed: number }> {
  const db = await getDb();
  const today = todayUTC();
  // 原子条件扣减：仅当 count < limit 时 count+1
  // 首次（无行）走 INSERT，count=1；已有行走 UPDATE，仅当 count<limit 时 +1
  const result = await db
    .prepare(
      `INSERT INTO daily_views (user_id, view_date, count) VALUES (?1, ?2, 1)
       ON CONFLICT(user_id, view_date) DO UPDATE SET count = count + 1
       WHERE count < ?3`
    )
    .bind(userId, today, DAILY_VIEW_LIMIT)
    .run();
  // changes > 0 表示 INSERT 或 UPDATE 执行了（扣减成功）
  const success = result.meta.changes > 0;
  // 重新查当前 count
  const row = await db
    .prepare("SELECT count FROM daily_views WHERE user_id = ?1 AND view_date = ?2")
    .bind(userId, today)
    .first<{ count: number }>();
  const dailyUsed = row?.count ?? 0;
  return { success, dailyUsed };
}

// ============ App 级鉴权：是否可查看某 App 的全量价格 ============

export type ViewAuthReason =
  | "paid"
  | "unlocked_today"
  | "quota_consumed"
  | "quota_exhausted"
  | "anonymous";

export interface AppViewAuth {
  /** 是否可查看全量价格 */
  canViewFull: boolean;
  /** 为什么可以/不可以看 */
  reason: ViewAuthReason;
  dailyUsed: number;
  dailyLimit: number;
  paid: boolean;
  loggedIn: boolean;
}

/** 查今天是否已解锁过某 App（幂等判断，不扣配额） */
export async function hasUnlockedApp(
  userId: string,
  appId: string,
  date: string
): Promise<boolean> {
  const db = await getDb();
  const row = await db
    .prepare(
      "SELECT 1 FROM app_unlocks WHERE user_id = ?1 AND app_id = ?2 AND view_date = ?3 LIMIT 1"
    )
    .bind(userId, appId, date)
    .first<{ "1": number }>();
  return !!row;
}

/** 记录今日已解锁某 App（幂等：ON CONFLICT DO NOTHING） */
export async function recordAppUnlock(
  userId: string,
  appId: string
): Promise<void> {
  const db = await getDb();
  const today = todayUTC();
  await db
    .prepare(
      `INSERT INTO app_unlocks (user_id, app_id, view_date, unlocked_at) VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT(user_id, app_id, view_date) DO NOTHING`
    )
    .bind(userId, appId, today, new Date().toISOString())
    .run();
}

/**
 * 鉴权：当前用户能否查看某 App 的全量价格
 * 自然访问即扣减，无需手动点"解锁"按钮：
 * - 付费 -> 全量
 * - 未登录 -> 锁定（引导登录）
 * - 已登录未付费 + 今天已解锁此 App -> 全量（不重复扣费）
 * - 已登录未付费 + 今天未解锁 + 配额未满 -> 自动扣 1 次 + 记录解锁 + 返回全量
 * - 已登录未付费 + 今天未解锁 + 配额已满 -> 锁定，引导付费
 */
export async function authorizeAppView(
  userId: string | null,
  appId: string
): Promise<AppViewAuth> {
  const ent = await getEntitlement(userId);
  if (ent.paid) {
    return {
      canViewFull: true,
      reason: "paid",
      dailyUsed: 0,
      dailyLimit: DAILY_VIEW_LIMIT,
      paid: true,
      loggedIn: true,
    };
  }
  if (!userId) {
    return {
      canViewFull: false,
      reason: "anonymous",
      dailyUsed: 0,
      dailyLimit: DAILY_VIEW_LIMIT,
      paid: false,
      loggedIn: false,
    };
  }
  // 已登录未付费：检查今天是否已解锁此 App
  const today = todayUTC();
  const unlocked = await hasUnlockedApp(userId, appId, today);
  if (unlocked) {
    return {
      canViewFull: true,
      reason: "unlocked_today",
      dailyUsed: ent.dailyUsed,
      dailyLimit: DAILY_VIEW_LIMIT,
      paid: false,
      loggedIn: true,
    };
  }
  // 今天未解锁此 App
  if (ent.dailyUsed < DAILY_VIEW_LIMIT) {
    // 自动扣减 + 记录解锁（自然访问即消耗配额）
    const result = await consumeDailyView(userId);
    if (result.success) {
      await recordAppUnlock(userId, appId);
      return {
        canViewFull: true,
        reason: "quota_consumed",
        dailyUsed: result.dailyUsed,
        dailyLimit: DAILY_VIEW_LIMIT,
        paid: false,
        loggedIn: true,
      };
    }
  }
  // 配额已满
  return {
    canViewFull: false,
    reason: "quota_exhausted",
    dailyUsed: ent.dailyUsed,
    dailyLimit: DAILY_VIEW_LIMIT,
    paid: false,
    loggedIn: true,
  };
}
