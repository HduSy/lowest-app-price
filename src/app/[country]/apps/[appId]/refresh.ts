// 服务端懒抓：在 SSR 中调用，分两批抓取--优先区先抓（拿 app info），其余后抓（拿价格）
import { listRegions, upsertPrice, updateAppMeta, getApp, insertApp } from "@/lib/db";
import { crawlAllRegions, normalizeKey } from "@/lib/crawler";
import { fetchAppMeta } from "@/lib/itunes";
import type { RegionFetchResult } from "@/lib/types";
import { getRates, type Rates } from "@/lib/exchange";

export async function refreshPrices(
  db: D1Database,
  appId: string,
  priorityCountry?: string
): Promise<{ writtenRegions: number; attemptedRegions: number }> {
  const regions = await listRegions(db);
  const rates = await getRates("USD");
  // 新库空 / 首次抓取时 app 不在 apps 表里，refreshPrices 需自行 insertApp
  // （旧流程依赖 /api/apps POST 的 insertApp，但 CF Workers 上 iTunes Lookup 被 403，
  //   POST 拿不到 meta；这里改用 crawlAllRegions 的 HTML meta 兜底初始化）
  const appExists = !!(await getApp(db, appId));

  // 分两批：优先区先抓（拿 app info），其余后抓（拿价格）
  let priorityRegions = regions;
  let restRegions: typeof regions = [];
  if (priorityCountry) {
    priorityRegions = regions.filter((r) => r.code === priorityCountry);
    restRegions = regions.filter((r) => r.code !== priorityCountry);
    if (priorityRegions.length === 0) {
      // priorityCountry 不在列表里，回退到全部
      priorityRegions = regions;
      restRegions = [];
    }
  }

  let writtenRegions = 0;
  // attemptedRegions：成功拿到页面（status=ok 或 no-iap）的区域数。
  // 区别于 writtenRegions（实际写出 IAP 价格的区域数）——免费 App 无 IAP，
  // written=0 但 attempted>0，此时应视为"已抓取过"并更新 last_fetched_at，
  // 否则免费 App 的 last_fetched_at 永远 null -> 每次进页面都触发刷新。
  let attemptedRegions = 0;

  // Phase 1: 优先区（用户所选语种国家）--立即写 meta + 价格
  const { results: pResults, meta: pMeta } = await crawlAllRegions(
    priorityRegions,
    appId
  );
  writtenRegions += await writePrices(db, appId, pResults, rates);
  attemptedRegions += countAttempted(pResults);
  try {
    if (!appExists && pMeta.name) {
      // app 不在库：用 HTML 解析到的完整 meta insertApp（bundle_id/category/genres HTML 不解析，留 null 后续补）
      await insertApp(db, {
        app_id: appId,
        name: pMeta.name,
        developer: pMeta.developer,
        icon_url: pMeta.iconUrl,
        bundle_id: null,
        category: null,
        genres: null,
        compatibility: pMeta.compatibility,
        subtitle: pMeta.subtitle,
        priceLabel: pMeta.priceLabel,
        rating: pMeta.rating,
        ratingCount: pMeta.ratingCount,
      });
    } else {
      await updateAppMeta(db, appId, pMeta);
    }
  } catch (e) {
    console.error(`[refresh ${appId}] updateAppMeta (priority) failed:`, e);
  }
  console.log(
    `[refresh ${appId}] phase-1 priority=${priorityCountry || "all"} written=${writtenRegions} attempted=${attemptedRegions}`
  );

  // Phase 2: 其余区--补全价格，补充 meta（优先区没拿到的字段）
  if (restRegions.length > 0) {
    const { results: rResults, meta: rMeta } = await crawlAllRegions(
      restRegions,
      appId
    );
    writtenRegions += await writePrices(db, appId, rResults, rates);
    attemptedRegions += countAttempted(rResults);
    try {
      await updateAppMeta(db, appId, rMeta);
    } catch (e) {
      console.error(`[refresh ${appId}] updateAppMeta (rest) failed:`, e);
    }
    console.log(
      `[refresh ${appId}] phase-2 done total-written=${writtenRegions}/${regions.length} attempted=${attemptedRegions}`
    );
  }

  // Phase 3: iTunes Lookup 兜底补全 HTML 爬取缺失的评分
  // 评分（rating / ratingCount）HTML 不一定稳定拿到，用 iTunes US 区兜底，真值保护下只补 HTML 没抓到的。
  try {
    const meta = await fetchAppMeta(appId);
    if (meta.name) {
      await updateAppMeta(db, appId, {
        rating: meta.rating,
        ratingCount: meta.ratingCount,
      });
    }
  } catch (e) {
    console.error(`[refresh ${appId}] iTunes fallback meta failed:`, e);
  }

  return { writtenRegions, attemptedRegions };
}

/** 统计"成功拿到 App Store 页面"的区域数（status=ok 或 no-iap）。
 *  排除 error（网络失败 / redirect trap）和 parse-fail（页面拿到但解析挂了）。
 *  用于决定是否更新 last_fetched_at：免费 App 无 IAP -> written=0 但 attempted>0。 */
function countAttempted(results: RegionFetchResult[]): number {
  return results.filter(
    (r) => r.status === "ok" || r.status === "no-iap"
  ).length;
}

/** 将抓取结果写入 prices 表，返回成功写入的地区数 */
async function writePrices(
  db: D1Database,
  appId: string,
  results: RegionFetchResult[],
  rates: Rates
): Promise<number> {
  let written = 0;
  for (const r of results) {
    if (r.status !== "ok" || !r.data?.iaps?.length) continue;
    try {
      for (const iap of r.data.iaps) {
        const iapKey = normalizeKey(iap.name);
        const rate = rates[iap.currency] || null;
        const usd = rate && iap.amount != null ? iap.amount / rate : null;
        await upsertPrice(db, {
          app_id: appId,
          region_code: r.region.code,
          iap_key: iapKey,
          iap_name: iap.name,
          price_raw: iap.priceRaw,
          amount: iap.amount,
          currency: iap.currency,
          amount_usd: usd,
          period: iap.period,
        });
      }
      written++;
    } catch (e) {
      console.error(
        `[refresh ${appId}] writePrice ${r.region.code} failed:`,
        e instanceof Error ? e.message : String(e)
      );
    }
  }
  return written;
}
