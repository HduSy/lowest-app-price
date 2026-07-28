// Admin 强制刷新某个 App 的全区价格
// 鉴权：登录用户 role=admin，或提供 ADMIN_TOKEN
// 与 /api/apps/[appId]/prices 的 stale 懒刷新不同，本端点：
//   1. 强制忽略 TTL 重新抓取；
//   2. 跳过 entitlement 过滤——admin 直接拿到全量 prices（含锁定档位）；
//   3. 返回写入统计，便于前端展示。
import { NextRequest } from "next/server";
import { getDb, getApp, getPrices, markAppFetched } from "@/lib/db";
import { refreshPrices } from "@/app/[country]/apps/[appId]/refresh";
import { json, error } from "@/lib/api-response";
import { auth } from "@/lib/auth";
import { filterSubscriptionIaps, extractIapMetadata } from "@/lib/compare";

export async function GET(req: NextRequest) {
  // 鉴权
  const session = await auth();
  const isAdmin = session?.user?.role === "admin";
  if (!isAdmin) {
    const token = req.nextUrl.searchParams.get("token");
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const ctx = getCloudflareContext();
    const env = ctx?.env as { ADMIN_TOKEN?: string } | undefined;
    if (!env?.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) {
      return error("Unauthorized", 401);
    }
  }

  const appId = req.nextUrl.searchParams.get("appId");
  if (!appId) return error("Missing appId", 400);

  const db = await getDb();
  const app = await getApp(db, appId);
  if (!app) return error("App not found", 404);

  // 优先抓用户所在区：从 query 参数取，没有就 fallback 到 us
  const country = req.nextUrl.searchParams.get("country") || "us";
  const { writtenRegions } = await refreshPrices(db, appId, country);
  if (writtenRegions > 0) {
    await markAppFetched(db, appId);
  }

  const [refreshedApp, rawPrices] = await Promise.all([
    getApp(db, appId),
    getPrices(db, appId),
  ]);
  const allPrices = filterSubscriptionIaps(rawPrices);
  const iaps = extractIapMetadata(allPrices);

  return json({
    app: refreshedApp,
    prices: allPrices,
    iaps,
    cached: false,
    writtenRegions,
    refreshedAt: new Date().toISOString(),
  });
}
