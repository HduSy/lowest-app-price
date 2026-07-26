import { json, error } from "@/lib/api-response";
import { getDb, listApps, listRegions, insertApp, getApp, type AppSortKey } from "@/lib/db";
import { parseAppInput } from "@/lib/parse-input";
import { fetchAppMeta } from "@/lib/itunes";
import { crawlAllRegions } from "@/lib/crawler";
import { auth } from "@/lib/auth";

const VALID_SORTS = new Set<AppSortKey>(["recent", "rating_count", "rating", "name"]);

// GET /api/apps?q=&page=&limit=&sort=
// 公开列表，无需登录
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const params = url.searchParams;
    const sortRaw = params.get("sort") || "rating_count";
    const sort: AppSortKey = VALID_SORTS.has(sortRaw as AppSortKey)
      ? (sortRaw as AppSortKey)
      : "rating_count";
    const db = await getDb();
    const result = await listApps(db, {
      q: params.get("q") || "",
      page: Number(params.get("page") || 1),
      limit: Number(params.get("limit") || 60),
      sort,
    });
    return json(result);
  } catch (e) {
    return json(
      { error: e instanceof Error ? e.message : String(e) },
      500
    );
  }
}

// POST /api/apps  { input: "appid 或链接" }
// 解析 -> 查重 -> iTunes Lookup 拿基本信息 -> 预爬 US 区判定是否值得收录 -> 入库
// 鉴权：必须登录（防止匿名批量提交触发外部抓取 DoS）
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return error("Unauthorized", 401);
    }
    const body = (await req.json().catch(() => ({}))) as { input?: string };
    const parsed = parseAppInput(body.input || "");
    if (!parsed) {
      return error("无法识别输入。请粘贴 App Store 链接或纯 App ID。", 400);
    }
    const appId = parsed.appId;

    const db = await getDb();

    // 查重
    const existing = await getApp(db, appId);
    if (existing) {
      return json({ ok: true, duplicate: true, app: existing });
    }

    // 抓基本信息（iTunes Lookup：稳）
    const meta = await fetchAppMeta(appId);
    if (!meta.name) {
      return error(
        "Apple 接口未找到该 App，请确认 App ID 正确。",
        404
      );
    }

    // 预爬判定：免费下载 App 需爬 US 区确认有无 IAP/订阅；
    // 付费下载 App（price > 0）必有买断价可比，直接放行跳过预爬。
    // 爬虫失败时放行（宁可错放不可错杀）；确认无 IAP 时拒绝并返回 App Store 链接。
    const isPaidApp = typeof meta.price === "number" && meta.price > 0;
    if (!isPaidApp) {
      const appStoreUrl = `https://apps.apple.com/us/app/id${appId}`;
      try {
        const regions = await listRegions(db);
        const usRegion = regions.find((r) => r.code === "us");
        if (usRegion) {
          const { results } = await crawlAllRegions([usRegion], appId);
          const usResult = results[0];
          if (usResult?.status === "no-iap") {
            return json(
              {
                error: "这款 App 完全免费，没有内购或订阅，无需比价。",
                reason: "no_pricing",
                appStoreUrl,
              },
              400
            );
          }
        }
      } catch (e) {
        // 预爬异常（网络/重定向/解析）：不拦截，继续入库让详情页正常流程兜底
        console.error(`[POST /api/apps] pre-crawl ${appId} failed:`, e);
      }
    }

    await insertApp(db, {
      app_id: appId,
      name: meta.name,
      developer: meta.developer,
      icon_url: meta.iconUrl,
      bundle_id: meta.bundleId,
      category: meta.category,
      genres: meta.genres,
      compatibility: meta.compatibility,
      rating: meta.rating,
      ratingCount: meta.ratingCount,
    });

    const app = await getApp(db, appId);
    return json({ ok: true, duplicate: false, app });
  } catch (e) {
    return json(
      { error: e instanceof Error ? e.message : String(e) },
      500
    );
  }
}
