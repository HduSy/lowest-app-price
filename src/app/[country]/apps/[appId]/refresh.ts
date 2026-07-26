// 服务端懒抓：在 SSR 中调用，分两批抓取--优先区先抓（拿 app info），其余后抓（拿价格）
import { listRegions, upsertPrice, updateAppMeta } from "@/lib/db";
import { crawlAllRegions, normalizeKey } from "@/lib/crawler";
import { fetchAppMeta } from "@/lib/itunes";
import type { RegionFetchResult } from "@/lib/types";
import { getRates, type Rates } from "@/lib/exchange";

export async function refreshPrices(
  db: D1Database,
  appId: string,
  priorityCountry?: string
): Promise<void> {
  const regions = await listRegions(db);
  const rates = await getRates("USD");

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

  // Phase 1: 优先区（用户所选语种国家）--立即写 meta + 价格
  const { results: pResults, meta: pMeta } = await crawlAllRegions(
    priorityRegions,
    appId
  );
  writtenRegions += await writePrices(db, appId, pResults, rates);
  try {
    await updateAppMeta(db, appId, pMeta);
  } catch (e) {
    console.error(`[refresh ${appId}] updateAppMeta (priority) failed:`, e);
  }
  console.log(
    `[refresh ${appId}] phase-1 priority=${priorityCountry || "all"} written=${writtenRegions}`
  );

  // Phase 2: 其余区--补全价格，补充 meta（优先区没拿到的字段）
  if (restRegions.length > 0) {
    const { results: rResults, meta: rMeta } = await crawlAllRegions(
      restRegions,
      appId
    );
    writtenRegions += await writePrices(db, appId, rResults, rates);
    try {
      await updateAppMeta(db, appId, rMeta);
    } catch (e) {
      console.error(`[refresh ${appId}] updateAppMeta (rest) failed:`, e);
    }
    console.log(
      `[refresh ${appId}] phase-2 done total-written=${writtenRegions}/${regions.length}`
    );
  }

  // Phase 3: iTunes Lookup 兜底补全 HTML 爬取缺失的评分
  // description / screenshots 主要靠 HTML 爬取（各区本地化文案），不再从 iTunes Lookup 持久化。
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
