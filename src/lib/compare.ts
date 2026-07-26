// 比价聚合：把多区抓取结果按 IAP 档位聚合，换算到目标币种，排序
// 从旧 js/compare.js 迁移

import type {
  AggregatedEntry,
  AggregatedIap,
  RegionFetchResult,
  PriceRow,
} from "./types";
import { isSubscriptionIap } from "./crawler";
import { convertSync, getRates, type Rates } from "./exchange";
import { formatCurrency } from "./currencies";

function normalizeIapName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** 聚合多区结果 → 按 IAP 档位分组 */
export function aggregate(
  results: RegionFetchResult[],
  targetCurrency: string,
  rates: Rates
): { iaps: AggregatedIap[]; regionsCovered: string[] } {
  const byKey = new Map<string, { name: string; key: string; entries: Map<string, AggregatedEntry> }>();

  for (const r of results) {
    if (r.status === "error" || !r.data?.iaps?.length) continue;
    const region = r.region;
    for (const iap of r.data.iaps) {
      const key = normalizeIapName(iap.name);
      if (!byKey.has(key)) {
        byKey.set(key, { name: iap.name, key, entries: new Map() });
      }
      const bucket = byKey.get(key)!;
      const converted =
        iap.amount == null
          ? null
          : convertSync(iap.amount, iap.currency, targetCurrency, rates);

      bucket.entries.set(region.code, {
        region,
        priceRaw: iap.priceRaw,
        localAmount: iap.amount,
        localCurrency: iap.currency,
        convertedAmount: converted,
        convertedDisplay:
          converted == null
            ? "—"
            : formatCurrency(converted, targetCurrency),
      });
    }
  }

  const iaps: AggregatedIap[] = [...byKey.values()].map((b) => {
    const entries = [...b.entries.values()].sort((a, c) => {
      if (a.convertedAmount == null) return 1;
      if (c.convertedAmount == null) return -1;
      return a.convertedAmount - c.convertedAmount;
    });
    const lowest = entries.find((e) => e.convertedAmount != null) || null;
    const highest =
      entries.filter((e) => e.convertedAmount != null).slice(-1)[0] || null;
    return { ...b, entries, lowest, highest };
  });

  iaps.sort(
    (a, b) =>
      (a.lowest?.convertedAmount ?? Infinity) -
      (b.lowest?.convertedAmount ?? Infinity)
  );

  const regionsCovered = results
    .filter((r) => r.status !== "error")
    .map((r) => r.region.code);

  return { iaps, regionsCovered };
}

// ============ 适配：从后端扁平 PriceRow 构造 RegionFetchResult ============
// 后端返回扁平价格数组，复用 aggregate() 前需转换
export function adaptPricesForCompare(prices: PriceRow[]): RegionFetchResult[] {
  const byRegion = new Map<string, RegionFetchResult>();
  for (const p of prices) {
    if (!byRegion.has(p.region_code)) {
      byRegion.set(p.region_code, {
        region: {
          code: p.region_code,
          name: p.region_name,
          name_en: "",
          flag: p.flag,
          currency: p.currency,
        },
        status: "ok",
        data: { iaps: [] },
      });
    }
    byRegion.get(p.region_code)!.data!.iaps.push({
      name: p.iap_name,
      priceRaw: p.price_raw,
      amount: p.amount,
      currency: p.currency,
    });
  }
  return [...byRegion.values()];
}

/** 便捷：从 PriceRow[] 直接聚合并加载汇率 */
export async function aggregatePrices(
  prices: PriceRow[],
  targetCurrency: string
) {
  const rates = await getRates("USD");
  const adapted = adaptPricesForCompare(prices);
  return aggregate(adapted, targetCurrency, rates);
}

// ============ 鉴权过滤：按权益裁剪 prices ============

/**
 * 过滤出真正的"订阅档位" prices（剔除一次性购买 + 创作者订阅 + 未分类项）
 * 在鉴权过滤之前应用，确保 totalIaps / freeCount / iaps metadata 都基于
 * 干净的订阅档位集合，UI tab 不会出现 Promote Post / @xxx Subscription 等噪声
 */
export function filterSubscriptionIaps(prices: PriceRow[]): PriceRow[] {
  return prices.filter((p) => isSubscriptionIap(p.iap_name, p.period));
}

/**
 * 区域覆盖度过滤：丢掉只在 1-2 个区域出现的 IAP
 *
 * 根因：Apple 的 IAP shelf 是异质混合体 —— 真订阅档位（YouTube Premium / Netflix Standard）
 * 通常跨多个销售区可用；而地区限定的创作者会员包 / 区域历史遗留档位 / 区域限定打赏功能
 * （如 CazéTV / Sean的树洞 / Aslan Paketi）只在 1-2 个区可见。
 *
 * 阈值策略（保守，宁可放过不可误伤）：
 *   - 绝对阈值 3 区：IAP 必须在 >= 3 区有价格才保留
 *   - 小 App 豁免：App 最大覆盖区数 < 5 时完全不过滤，保护独占 App / 本地化 App 的真实档位
 *
 * 不采用相对阈值（如 maxCov/5）的原因：
 *   会误伤 Netflix "Standard with Ads"（受广告法规限制只在 ~12 区）、
 *   Spotify "Premium Student"（学生验证只在 ~20 区）、
 *   Apple Music Voice Plan 启动初期（仅 4 区）、新 tier 滚动发布期等真实档位
 *
 * 注意：必须在 filterSubscriptionIaps 之后调用，否则 one_time 项的覆盖会拉高统计
 */
export function filterSparseIaps(prices: PriceRow[]): PriceRow[] {
  if (prices.length === 0) return prices;
  const cov = new Map<string, Set<string>>();
  for (const p of prices) {
    let set = cov.get(p.iap_key);
    if (!set) {
      set = new Set<string>();
      cov.set(p.iap_key, set);
    }
    set.add(p.region_code);
  }
  let maxCov = 0;
  for (const set of cov.values()) {
    if (set.size > maxCov) maxCov = set.size;
  }
  // 小 App 豁免：最大覆盖 < 5 区（独占 / 本地化 App），保留所有 IAP
  if (maxCov < 5) return prices;
  // 绝对阈值 3 区：drop 仅在 1-2 区出现的地区限定噪音
  const threshold = 3;
  return prices.filter((p) => (cov.get(p.iap_key)?.size ?? 0) >= threshold);
}

/**
 * 从全量 prices 提取所有 IAP 元数据（key + name），按最低 amount_usd 升序排
 * 排序保证前 N 个 = filterPricesByAuth 下发的那 N 档，
 * 前端 IapTabs 的 idx >= freeCount 判断才正确（可点 tab 和有数据的 tab 对齐）
 */
export function extractIapMetadata(
  prices: PriceRow[]
): { key: string; name: string }[] {
  const byKey = new Map<string, { name: string; minUsd: number | null }>();
  for (const p of prices) {
    const cur = byKey.get(p.iap_key);
    if (cur == null) {
      byKey.set(p.iap_key, { name: p.iap_name, minUsd: p.amount_usd });
    } else if (p.amount_usd != null && (cur.minUsd == null || p.amount_usd < cur.minUsd)) {
      cur.minUsd = p.amount_usd;
    }
  }
  return [...byKey.entries()]
    .sort((a, b) => {
      const aUsd = a[1].minUsd;
      const bUsd = b[1].minUsd;
      if (aUsd == null) return 1;
      if (bUsd == null) return -1;
      return aUsd - bUsd;
    })
    .map(([key, { name }]) => ({ key, name }));
}

/**
 * 非会员阶梯式可见档位数：
 *   1~3 档 -> 1 个；4 档 -> 2 个；5+ 档 -> 3 个
 */
export function computeFreeCount(totalIaps: number): number {
  return totalIaps <= 3 ? 1 : totalIaps === 4 ? 2 : 3;
}

/**
 * 按鉴权过滤 prices
 * - canViewFull=true -> 返回全量
 * - canViewFull=false -> 只保留最便宜 freeCount 档 IAP 的 prices（按 amount_usd 最低判断）
 *   锁定档位的 prices 完全不下发，防止 view-source / curl 泄露价格
 */
export function filterPricesByAuth(
  prices: PriceRow[],
  canViewFull: boolean,
  freeCount: number
): PriceRow[] {
  if (canViewFull) return prices;
  if (prices.length === 0) return prices;
  // 按 iap_key 分组，找各 IAP 的最低 amount_usd
  const iapMinUsd = new Map<string, number>();
  for (const p of prices) {
    if (p.amount_usd == null) continue;
    const cur = iapMinUsd.get(p.iap_key);
    if (cur == null || p.amount_usd < cur) {
      iapMinUsd.set(p.iap_key, p.amount_usd);
    }
  }
  // 无 USD 价格数据（边缘情况）-> 返回全量，避免误锁
  if (iapMinUsd.size === 0) return prices;
  // 按 lowest usd 升序，取前 freeCount 个 key（最便宜的 N 档）
  const sortedIaps = [...iapMinUsd.entries()].sort((a, b) => a[1] - b[1]);
  const n = Math.max(1, freeCount);
  const visibleKeys = new Set(sortedIaps.slice(0, n).map(([k]) => k));
  return prices.filter((p) => visibleKeys.has(p.iap_key));
}
