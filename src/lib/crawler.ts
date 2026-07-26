// App Store HTML 抓取与解析（从旧 js/fetcher.js + worker/api.js 迁移）
// 在 edge runtime 跑：Worker 端直连 apps.apple.com 无 CORS 问题

import type { IapEntry, Region, RegionFetchResult, SubscriptionPeriod } from "./types";
import { parsePrice, resolveCurrency } from "./currencies";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

/** 抓单区 HTML（Worker 端用，直连）
 *  Apple 的行为：请求某区详情页但该 App 在此区不存在时，会 302 到该区首页
 *  （如 /cn/app/idxxx -> /cn 或 /cn/iphone/today）。首页 HTML 喂给解析器会得到空字段，
 *  却不报错，导致静默失败。这里通过检查最终落地 URL 是否仍是详情页来拦截。 */
export async function fetchHtml(country: string, appId: string): Promise<string> {
  const resp = await fetch(`https://apps.apple.com/${country}/app/id${appId}?l=en`, {
    headers: {
      "User-Agent": UA,
      "Accept-Language": "en-US,en;q=0.9",
      Accept: "text/html,*/*",
    },
    redirect: "follow",
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  // 落地 URL 必须仍是该 app 的详情页（含 /app/ 且含 id{appId}）。
  // 被重定向到区首页（/cn、/us/iphone/today 等）时视为该区无此 App。
  const finalUrl = resp.url;
  if (!/\/app\/[^/]*\/id${appId}(?:[/?#]|$)/.test(finalUrl) && !/\/app\/id${appId}(?:[/?#]|$)/.test(finalUrl)) {
    throw new Error(`redirected to non-app page: ${finalUrl}`);
  }
  return await resp.text();
}

/** 调 iTunes Lookup 拿 App 本身的买断价格（付费下载 App 才有，免费 App 返回 null）
 *  同时提取 averageUserRating / userRatingCount（iTunes API 比 HTML 爬取稳定） */
async function fetchLookupMeta(
  country: string,
  appId: string
): Promise<{
  price: { price: number; currency: string; formattedPrice: string } | null;
  rating: number | null;
  ratingCount: number | null;
}> {
  try {
    const resp = await fetch(
      `https://itunes.apple.com/lookup?id=${appId}&country=${country}`
    );
    if (!resp.ok) return { price: null, rating: null, ratingCount: null };
    const data = (await resp.json()) as {
      results?: {
        price?: number;
        currency?: string;
        formattedPrice?: string;
        averageUserRating?: number;
        userRatingCount?: number;
      }[];
    };
    const r = data.results?.[0];
    if (!r) return { price: null, rating: null, ratingCount: null };
    const rating = typeof r.averageUserRating === "number" ? r.averageUserRating : null;
    const ratingCount = typeof r.userRatingCount === "number" ? r.userRatingCount : null;
    // price > 0 表示付费下载（买断制），免费 App price=0 跳过
    if (
      typeof r.price === "number" &&
      r.price > 0 &&
      r.currency &&
      r.formattedPrice
    ) {
      return {
        price: {
          price: r.price,
          currency: r.currency,
          formattedPrice: r.formattedPrice,
        },
        rating,
        ratingCount,
      };
    }
    return { price: null, rating, ratingCount };
  } catch {
    return { price: null, rating: null, ratingCount: null };
  }
}

export interface ParsedAppStoreHtml {
  name: string | null;
  developer: string | null;
  iconUrl: string | null;
  subtitle: string | null;
  priceLabel: string | null;
  compatibility: string[] | null;
  iaps: IapEntry[];
  relatedAppIds: string[];
}

/** 从 App Store HTML 解析 App 元信息 + IAP 档位 */
export function parseAppStoreHtml(
  html: string,
  storefrontCurrency?: string
): ParsedAppStoreHtml {
  const out: ParsedAppStoreHtml = {
    name: null,
    developer: null,
    iconUrl: null,
    subtitle: null,
    priceLabel: null,
    compatibility: null,
    iaps: [],
    relatedAppIds: [],
  };

  // App 名称：og:title 去后缀
  const og = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/);
  if (og) {
    out.name = og[1]
      .replace(/\s*(?:App\s*)?[-‑–—]\s*App\s*Store$/i, "")
      .replace(/on the App Store$/i, "")
      .trim();
  }
  if (!out.name) {
    const t = html.match(/<title>\s*‎?(.+?)\s+(?:App\s*[-‑–]\s*App Store|on the App Store)/);
    if (t) out.name = t[1].trim();
  }

  // 开发者
  const dev = html.match(/"developerName":"([^"]+)"/);
  if (dev) out.developer = dev[1].trim();

  // 图标
  const icon = html.match(/"artworkUrl\d+":"(https:[^"]+100x100[^"]+)"/);
  if (icon) out.iconUrl = icon[1];

  // 简介（subtitle）：取 SSR <p> 元素内容
  //   优先精确匹配 svelte-1up5qog（当前 hash），再兜底 subtitle + svelte-xxx，最后 itemDescription JSON
  const subMatch =
    html.match(/<p class="svelte-1up5qog">([^<]+)<\/p>/) ||
    html.match(/<p class="[^"]*subtitle[^"]*svelte-[a-z0-9]+[^"]*">([^<]+)<\/p>/);
  if (subMatch) out.subtitle = unescape(subMatch[1]).trim();
  if (!out.subtitle) {
    const itemDesc = html.match(/"itemDescription":"((?:[^"\\]|\\.)*)"/);
    if (itemDesc) out.subtitle = unescape(itemDesc[1]).trim();
  }

  // 价格摘要（如 "Free · In‑App Purchases"）：取 SSR <p class="...attributes">
  const attr = html.match(/<p class="[^"]*attributes[^"]*">([^<]+)<\/p>/);
  if (attr) out.priceLabel = attr[1].trim();

  // 兼容设备：从 <div class="all-platforms ..."> 块提取已知平台名
  const apIdx = html.indexOf("all-platforms");
  if (apIdx >= 0) {
    const block = html.slice(apIdx, apIdx + 3000);
    const platforms: string[] = [];
    const add = (p: string) => {
      if (!platforms.includes(p)) platforms.push(p);
    };
    if (/iPhone/i.test(block)) add("iPhone");
    if (/iPad/i.test(block)) add("iPad");
    if (/iPod\s*touch/i.test(block)) add("iPod touch");
    if (/\bMac\b/i.test(block)) add("Mac");
    if (/Apple\s*TV/i.test(block)) add("Apple TV");
    if (/Apple\s*Watch/i.test(block)) add("Apple Watch");
    if (/iMessage/i.test(block)) add("iMessage");
    if (platforms.length) out.compatibility = platforms;
  }

  // 相关推荐 App：扫描页面内所有 app 链接（"You Might Also Like" / "More by this developer" 等 shelf）
  // 链接格式：href="/{cc}/app/{slug}/id{digits}"，当前 App 自身的 canonical 链接由调用方过滤
  // Apple 的 app 详情页里 app 链接基本只出现在推荐 shelf，截图 shelf 用 <source srcset> 不会被匹配
  const seenRel = new Set<string>();
  const linkRe = /href="\/[a-z]{2}\/app\/[^"]*?\/id(\d+)"/gi;
  let lm: RegExpExecArray | null;
  while ((lm = linkRe.exec(html)) !== null) {
    const id = lm[1];
    if (seenRel.has(id)) continue;
    seenRel.add(id);
    out.relatedAppIds.push(id);
    if (out.relatedAppIds.length >= 20) break;
  }

  // IAP：从 items_V3 的 textPair 提取
  const seen = new Set<string>();
  const sectionRe =
    /[Ii]n[‑\-][Aa]pp\s*[Pp]urchases[\s\S]*?items_V3":(\[.*?\]),"shouldAlwaysPresentExpanded"/g;
  let m: RegExpExecArray | null;
  while ((m = sectionRe.exec(html)) !== null) {
    const pairRe =
      /"\$kind":"textPair","leadingText":"((?:[^"\\]|\\.)*)","trailingText":"((?:[^"\\]|\\.)*)"/g;
    let pm: RegExpExecArray | null;
    while ((pm = pairRe.exec(m[1])) !== null) {
      const name = unescape(pm[1]);
      const priceRaw = unescape(pm[2]);
      if (seen.has(name)) continue;
      seen.add(name);
      const parsed = parsePrice(priceRaw);
      out.iaps.push({
        name,
        priceRaw,
        amount: parsed.amount ?? 0,
        currency: resolveCurrency(parsed, storefrontCurrency),
        period: detectPeriod(name),
      });
    }
  }
  return out;
}

function unescape(s: string): string {
  return s
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\")
    .replace(/\\n/g, " ")
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, c) => String.fromCharCode(parseInt(c, 16)));
}

export function normalizeKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * 从 IAP 名称识别订阅周期
 * 优先级：lifetime > one_time > yearly > monthly > weekly > null
 * 支持英文（App Store ?l=en 抓取的主要语言）+ 中文兜底
 *
 * one_time 档覆盖：一次性买断关键词 + 已知非订阅 IAP 名
 *   （Promote Post / Boosted Tweet / NotABot 等都归类为 one_time，
 *    便于上层 UI 用 period==='one_time' 过滤掉非订阅项）
 * monthly 档覆盖：常规月费关键词 + 创作者订阅后缀（"@xxx Subscription"）
 *   （X 的 Super Follows 默认月付，名字里没有 monthly 关键词，需单独识别）
 */
export function detectPeriod(iapName: string): SubscriptionPeriod {
  const lower = iapName.toLowerCase();
  // 终身/永久买断（最高优先级）
  if (/\b(lifetime|forever)\b/.test(lower) || /终身|永久|买断/.test(iapName)) {
    return "lifetime";
  }
  // 一次性买断：通用关键词 + 已知非订阅 IAP 名（Promote Post / Boosted Tweet / NotABot）
  if (
    /\b(one[-\s]time|permanent\s+unlock|unlock\s+all|unlock\s+full)\b/.test(lower) ||
    /\b(promote\s+post|boosted\s+tweet|not\s*a\s*bot|notabot)\b/.test(lower) ||
    /一次性|永久解锁/.test(iapName)
  ) {
    return "one_time";
  }
  // 年度
  if (
    /\b(yearly|annual|1\s*year|12\s*months?)\b/.test(lower) ||
    /年度|年费|1年|12个月|每年/.test(iapName)
  ) {
    return "yearly";
  }
  // 月度：常规月费关键词 + 创作者订阅后缀 "@xxx Subscription"
  if (
    /\b(monthly|1\s*month)\b/.test(lower) ||
    /^@[\w.]+\s+subscription\b/.test(lower) ||
    /月度|月费|1个月|每月/.test(iapName)
  ) {
    return "monthly";
  }
  // 周度
  if (/\b(weekly|1\s*week)\b/.test(lower) || /周度|周费|1周|每周/.test(iapName)) {
    return "weekly";
  }
  return null;
}

/**
 * 是否为真正的"订阅档位"（用于 UI 档位 tab 过滤）
 * 排除：
 *   - period === 'one_time'（一次性购买，如 Promote Post / Boosted Tweet / NotABot）
 *   - 创作者订阅 "@xxx Subscription"（X 的 Super Follows；价格因人而异，
 *     跨区聚合后档位过于碎片化，不算 App 自家订阅套餐）
 * 保留 period === null（如 Netflix Premium / ChatGPT Plus / SuperGrok 等名字里
 * 没有周期关键词的真实订阅，detectPeriod 无法识别但不该被过滤掉）
 */
export function isSubscriptionIap(
  iapName: string,
  period: SubscriptionPeriod
): boolean {
  if (period === "one_time") return false;
  if (/^@[\w.]+\s+subscription\b/i.test(iapName)) return false;
  return true;
}

/**
 * 并发抓取多区价格（Worker 端用，直连无 CORS）
 * 每区独立失败
 * 返回：各区结果 + 从首页 HTML 解析到的 subtitle/priceLabel（取首个非空）
 */
export async function crawlAllRegions(
  regions: Region[],
  appId: string
): Promise<{
  results: RegionFetchResult[];
  meta: {
    subtitle: string | null;
    priceLabel: string | null;
    compatibility: string[] | null;
    screenshots: string[] | null;
    description: string | null;
    rating: number | null;
    ratingCount: number | null;
  };
}> {
  let subtitle: string | null = null;
  let priceLabel: string | null = null;
  let compatibility: string[] | null = null;
  let screenshots: string[] | null = null;
  let description: string | null = null;
  let rating: number | null = null;
  let ratingCount: number | null = null;
  const tasks = regions.map(async (region) => {
    try {
      const [html, lookupMeta] = await Promise.all([
        fetchHtml(region.code, appId),
        fetchLookupMeta(region.code, appId),
      ]);
      const parsed = parseAppStoreHtml(html, region.currency);
      // 截图兜底：HTML 爬取失败时用 iTunes Lookup 的 screenshotUrls（更稳定）
      if (!parsed.screenshots && lookupMeta.screenshots) {
        parsed.screenshots = lookupMeta.screenshots;
      }
      if (parsed.subtitle && !subtitle) subtitle = parsed.subtitle;
      if (parsed.priceLabel && !priceLabel) priceLabel = parsed.priceLabel;
      if (parsed.compatibility && !compatibility) compatibility = parsed.compatibility;
      if (parsed.screenshots && !screenshots) screenshots = parsed.screenshots;
      if (parsed.description && !description) description = parsed.description;
      // 评分取首个非空（通常各区一致，取 US 区即可）
      if (lookupMeta.rating != null && rating == null) rating = lookupMeta.rating;
      if (lookupMeta.ratingCount != null && ratingCount == null) ratingCount = lookupMeta.ratingCount;
      // 付费下载 App：买断价格作为一个档位加入 iaps（免费 App price=null 跳过）
      if (lookupMeta.price) {
        parsed.iaps.unshift({
          name: "App 下载",
          priceRaw: lookupMeta.price.formattedPrice,
          amount: lookupMeta.price.price,
          currency: lookupMeta.price.currency,
          period: "one_time",
        });
      }
      return {
        region,
        status: parsed.iaps.length
          ? "ok"
          : parsed.name
          ? "no-iap"
          : "parse-fail",
        data: { iaps: parsed.iaps },
      } as RegionFetchResult;
    } catch (e) {
      return {
        region,
        status: "error",
        data: null,
        error: e instanceof Error ? e.message : String(e),
      } as RegionFetchResult;
    }
  });
  const results = await Promise.all(tasks);
  return {
    results,
    meta: { subtitle, priceLabel, compatibility, screenshots, description, rating, ratingCount },
  };
}
