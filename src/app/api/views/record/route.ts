// POST /api/views/record - 扣减一次当日免费查看配额，并记录 App 解锁
// 仅登录未付费用户需要调用；付费用户直接返回 success
// body: { appId: string }
// 幂等：今天已解锁过此 App 不重复扣费
import { auth } from "@/lib/auth";
import {
  getEntitlement,
  consumeDailyView,
  recordAppUnlock,
  hasUnlockedApp,
  todayUTC,
  DAILY_VIEW_LIMIT,
} from "@/lib/entitlement";
import { json, error } from "@/lib/api-response";

export async function POST(req: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return error("Unauthorized", 401);
    }

    // 解析 appId
    const body = await req.json().catch(() => ({}));
    const appId = typeof body?.appId === "string" ? body.appId : null;
    if (!appId) {
      return error("Missing appId", 400);
    }

    // 付费用户 / B 版会员无需扣减
    const ent = await getEntitlement(userId);
    if (ent.paid || ent.member) {
      return json({ success: true, paid: ent.paid, dailyUsed: 0, dailyLimit: DAILY_VIEW_LIMIT });
    }

    // 幂等：今天已解锁过此 App，直接返回成功（不重复扣费）
    const today = todayUTC();
    const alreadyUnlocked = await hasUnlockedApp(userId, appId, today);
    if (alreadyUnlocked) {
      return json({
        success: true,
        paid: false,
        dailyUsed: ent.dailyUsed,
        dailyLimit: DAILY_VIEW_LIMIT,
      });
    }

    // 扣减全局配额（原子条件 +1，并发安全）
    const result = await consumeDailyView(userId);
    if (!result.success) {
      return error("Daily limit exceeded", 429);
    }

    // 记录 App 解锁（幂等，ON CONFLICT DO NOTHING）
    await recordAppUnlock(userId, appId);

    return json({
      success: true,
      paid: false,
      dailyUsed: result.dailyUsed,
      dailyLimit: DAILY_VIEW_LIMIT,
    });
  } catch (e) {
    console.error("[api/views/record] failed:", e);
    return error("Failed to record view", 500);
  }
}
