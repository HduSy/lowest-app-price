import { json, error } from "@/lib/api-response";
import { getDb, getApp, getPrices, markAppFetched, isStale } from "@/lib/db";
import { refreshPrices } from "@/app/[country]/apps/[appId]/refresh";
import { auth } from "@/lib/auth";
import { authorizeAppView } from "@/lib/entitlement";
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
      return error("App 不存在，请先添加。", 404);
    }

    const needFetch = force || isStale(app.last_fetched_at, PRICE_TTL_HOURS);

    if (needFetch) {
      // 优先抓取用户所在区：从 cookie 或 query 参数取国家 code
      const country =
        url.searchParams.get("country") ||
        req.headers
          .get("cookie")
          ?.match(/(?:^|;\s*)detected_country=([^;]+)/)?.[1] ||
        undefined;
      await refreshPrices(db, appId, country || undefined);
      await markAppFetched(db, appId);
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
