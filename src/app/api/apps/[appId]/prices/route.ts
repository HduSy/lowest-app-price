import { json, error } from "@/lib/api-response";
import { getDb, getApp, getPrices, markAppFetched, isStale } from "@/lib/db";
import { refreshPrices } from "@/app/[locale]/apps/[appId]/refresh";
import { auth } from "@/lib/auth";
import { authorizeAppView } from "@/lib/entitlement";
import { readCookie } from "@/lib/cookie";
import {
  filterPricesByAuth,
  extractIapMetadata,
  computeFreeCount,
  filterSubscriptionIaps,
} from "@/lib/compare";

const PRICE_TTL_HOURS = 6;

// GET /api/apps/:appid/prices?force=1
// 缓存未命中或过期时懒抓全区价格入库
// 按用户权益过滤：未付费且今日未解锁此 App 时，只返回最便宜 N 档价格（阶梯式）
// curl / fetch / 任何方式访问都走同一套鉴权，锁定档位价格不下发
export async function GET(
  req: Request,
  { params }: { params: Promise<{ appId: string }> }
) {
  try {
    const { appId } = await params;
    const url = new URL(req.url);
    const force = url.searchParams.get("force") === "1";

    const db = await getDb();
    const app = await getApp(db, appId);
    if (!app) {
      return error("App not in our database. Please add it first.", 404);
    }

    const needFetch = force || isStale(app.last_fetched_at, PRICE_TTL_HOURS);

    // force=1 去抖：即便客户端发 force=1，若距上次成功抓取不足 FORCE_DEBOUNCE_SECONDS，
    // 也跳过全区抓取（直接走缓存返回）。避免 SSR 给 needsRefresh=true 时客户端每次进页面
    // 都触发 40 区重抓（尤其是免费 App 之前因 written=0 永不 markAppFetched 的历史遗留）。
    const FORCE_DEBOUNCE_SECONDS = 60;
    let debouncedSkip = false;
    if (needFetch && app.last_fetched_at) {
      const lastTs = new Date(
        app.last_fetched_at.replace(" ", "T") + "Z"
      ).getTime();
      if (!Number.isNaN(lastTs) && Date.now() - lastTs < FORCE_DEBOUNCE_SECONDS * 1000) {
        debouncedSkip = true;
      }
    }

    if (needFetch && !debouncedSkip) {
      // 优先抓取用户所在区：从 cookie 或 query 参数取国家 code
      const country =
        url.searchParams.get("country") ||
        readCookie(req.headers.get("cookie") || "", "detected_country") ||
        undefined;
      const { attemptedRegions } = await refreshPrices(db, appId, country || undefined);
      // 只要爬虫成功拿到页面（attempted>0）就更新 last_fetched_at，
      // 即便该 App 无 IAP（written=0）。否则免费 App 永远 stale，每次进页面都重抓 40 区。
      if (attemptedRegions > 0) {
        await markAppFetched(db, appId);
      }
    }

    const [refreshedApp, rawPrices] = await Promise.all([
      getApp(db, appId),
      getPrices(db, appId),
    ]);

    // 先剔除一次性购买 + 创作者订阅 + 未分类项，只保留真正的订阅档位
    // 这样 totalIaps / freeCount / iaps metadata 都基于干净集合，UI tab 不出现噪声
    const allPrices = filterSubscriptionIaps(rawPrices);

    // 鉴权：当前用户能否查看全量价格
    const session = await auth();
    const userId = session?.user?.id ?? null;
    const authResult = await authorizeAppView(userId, appId);

    // 阶梯式可见档位数（1~3档→1，4档→2，5+档→3）
    const totalIaps = new Set(allPrices.map((p) => p.iap_key)).size;
    const freeCount = computeFreeCount(totalIaps);
    // 按鉴权过滤 prices（canViewFull=false 时只返回最便宜 freeCount 档）
    const prices = filterPricesByAuth(allPrices, authResult.canViewFull, freeCount);
    // IAP 元数据（所有档位 key+name，用于前端渲染 tab；锁定档位价格不下发）
    const iaps = extractIapMetadata(allPrices);

    return json({
      app: refreshedApp,
      prices,
      iaps,
      cached: !needFetch,
      auth: authResult,
    });
  } catch (e) {
    return json(
      { error: e instanceof Error ? e.message : String(e) },
      500
    );
  }
}
