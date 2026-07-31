// App Store HTML 抓取与解析（从旧 js/fetcher.js + worker/api.js 迁移）
// 在 edge runtime 跑：Worker 端直连 apps.apple.com 无 CORS 问题

import type { IapEntry, Region, RegionFetchResult, SubscriptionPeriod } from "./types";
import { parsePrice, resolveCurrency } from "./currencies";
import { APP_PURCHASE_KEY, isAppPurchaseName } from "./iap-constants";

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
  // 注意：必须用 new RegExp 构造，不能用正则字面量 /.../ -- 正则字面量里 ${appId}
  // 不会被插值（JS 正则字面量不是模板字符串），会按字面量 ${appId} 匹配，永远 false，
  // 导致 fetchHtml 对所有被 Apple 补 slug 重定向的 App 都误抛 "redirected to non-app page"。
  const finalUrl = resp.url;
  const appUrlRe = new RegExp(`/app/(?:[^/]*/)?id${appId}(?:[/?#]|$)`);
  if (!appUrlRe.test(finalUrl)) {
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
      `https://itunes.apple.com/lookup?id=${appId}&country=${country}`,
      {
        headers: {
          "User-Agent": UA,
          Accept: "application/json",
          "Accept-Language": "en-US,en;q=0.9",
        },
      }
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
  rating: number | null;
  ratingCount: number | null;
  /** 付费下载价（从 priceLabel 解析）；免费 App 为 null */
  paidPrice: { price: number; currency: string; formattedPrice: string } | null;
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
    rating: null,
    ratingCount: null,
    paidPrice: null,
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

  // 图标：从 HTML 里所有 mzstatic.com/image/thumb 资源里挑一个真正的正方形 icon。
  //   Apple 的图标 URL 形如 https://is{N}-ssl.mzstatic.com/image/thumb/{...}/<W>x<H><fmt>.<ext>
  //   尾部 <W>x<H> 是关键：正方形（W==H）才是 icon，宽幅（如 1200x630wa）是 podcast/banner 宣传图。
  //   策略：
  //     1) 扫全部 mzstatic thumb URL，挑出尾部 W==H 的（去掉模板占位 {w}x{h}）；
  //     2) 优先取 URL 路径含 AppIcon / Prod- / icon 字样的（最可能是 icon），其次任意正方形；
  //     3) 多个候选尺寸时取最大的（图标更清晰）。
  //   兜底：JSON-LD SoftwareApplication.image —— 但 podcast 类目会塞 1200x630wa 横幅，
  //   所以同样只接受尾部正方形的。
  function isSquare(u: string): boolean {
    const m = u.match(/\/(\d+)x(\d+)[a-z]*\./i);
    return !!m && m[1] === m[2];
  }
  const allThumbUrls = Array.from(
    html.matchAll(/https:\/\/is\d+-ssl\.mzstatic\.com\/image\/thumb\/[^"\s'<>]+/gi)
  ).map((m) => m[0]);
  const squareUrls = allThumbUrls.filter(isSquare);
  // 偏好显式 icon 命名；没有就用任意正方形。最后按尺寸降序，取最大那个。
  const ranked = squareUrls.sort((a, b) => {
    const aIcon = /appicon|prod-|icon/i.test(a) ? 1 : 0;
    const bIcon = /appicon|prod-|icon/i.test(b) ? 1 : 0;
    if (aIcon !== bIcon) return bIcon - aIcon;
    const aSize = parseInt((a.match(/\/(\d+)x\1[a-z]*\./i) || [])[1] || "0", 10);
    const bSize = parseInt((b.match(/\/(\d+)x\1[a-z]*\./i) || [])[1] || "0", 10);
    return bSize - aSize;
  });
  let icon: string | null = ranked[0] || null;

  for (const ldMatch of html.matchAll(
    /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g
  )) {
    try {
      const ld = JSON.parse(ldMatch[1].trim());
      if (ld && ld["@type"] === "SoftwareApplication") {
        // 评分：JSON-LD aggregateRating（schema.org 标准，等价于 iTunes API 的 averageUserRating / userRatingCount）
        const ar = ld.aggregateRating;
        if (ar) {
          if (typeof ar.ratingValue === "number") out.rating = ar.ratingValue;
          if (typeof ar.reviewCount === "number") out.ratingCount = ar.reviewCount;
        }
        // 图标：仅在 HTML 正则未命中时考虑 JSON-LD image，且必须是正方形 URL（/WxH… 中 W==H）
        if (!icon) {
          const img = Array.isArray(ld.image)
            ? typeof ld.image[0] === "string"
              ? ld.image[0]
              : null
            : typeof ld.image === "string"
            ? ld.image
            : null;
          if (img && isSquare(img)) icon = img;
        }
        break;
      }
    } catch {
      /* 单个 JSON-LD 解析失败：忽略，继续尝试下一个 */
    }
  }
  if (icon) out.iconUrl = icon;

  // 简介（subtitle）：取 SSR <p> 元素内容
  //   结构稳定为 <p class="subtitle svelte-xxx">...</p>，class 名 "subtitle" 不会随 Apple 重新编译变化，
  //   只有 svelte hash 会变，因此只按 class 名匹配，不依赖任何具体 hash 值。
  //   用 (?:^|\\s) 保证 "subtitle" 是独立 class token，避免误匹配 "subtitle-tag" 之类前缀。
  //   兜底：itemDescription JSON（嵌入式 JSON-LD 的简化字段，Apple 历次改版都保留）
  const subMatch = html.match(
    /<p class="(?:[^"]*\s)?subtitle(?:\s[^"]*)?">([^<]+)<\/p>/i
  );
  if (subMatch) out.subtitle = unescape(subMatch[1]).trim();
  if (!out.subtitle) {
    const itemDesc = html.match(/"itemDescription":"((?:[^"\\]|\\.)*)"/);
    if (itemDesc) out.subtitle = unescape(itemDesc[1]).trim();
  }

  // 价格摘要（如 "Free · In‑App Purchases"）：取 SSR <p class="...attributes">
  const attr = html.match(/<p class="[^"]*attributes[^"]*">([^<]+)<\/p>/);
  if (attr) out.priceLabel = attr[1].trim();

  // 付费下载价：从 priceLabel 解析（如 "$14.99 · In‑App Purchases" -> price=14.99 currency=USD）
  // 免费 App priceLabel 以 "Free" 开头，跳过。替代原 fetchLookupMeta 的 per-region iTunes API 调用，
  // 省掉每区第 2 个 subrequest（40 区从 80 降到 40 subrequests）。
  if (out.priceLabel && !/^\s*free/i.test(out.priceLabel)) {
    const pricePart = out.priceLabel.split(/\s*[·•・]\s*/)[0].trim();
    if (pricePart) {
      const parsed = parsePrice(pricePart);
      if (parsed.amount != null) {
        out.paidPrice = {
          price: parsed.amount,
          currency: resolveCurrency(parsed, storefrontCurrency),
          formattedPrice: pricePart,
        };
      }
    }
  }

  // 兼容设备：从页面提取已知平台名
  //   多平台 App：用 <div class="all-platforms ..."> 块作为锚点（含全部支持平台的图标 + 文本）
  //   单平台 App（如 Mac-only Xcode）：没有 all-platforms 块，改从 <dt>Compatibility</dt><dd>...</dd>
  //   语义化定义列表提取（这是 Apple 长期使用的稳定结构，"Compatibility" 是 i18n key，多语言页面也保留英文）
  let compatBlock: string | null = null;
  const apIdx = html.indexOf("all-platforms");
  if (apIdx >= 0) {
    compatBlock = html.slice(apIdx, apIdx + 3000);
  } else {
    const compatDd = html.match(
      /<dt[^>]*>\s*Compatibility\s*<\/dt>\s*<dd[^>]*>([\s\S]{0,2000}?)<\/dd>/i
    );
    if (compatDd) compatBlock = compatDd[1];
  }
  if (compatBlock) {
    const platforms: string[] = [];
    const add = (p: string) => {
      if (!platforms.includes(p)) platforms.push(p);
    };
    if (/iPhone/i.test(compatBlock)) add("iPhone");
    if (/iPad/i.test(compatBlock)) add("iPad");
    if (/iPod\s*touch/i.test(compatBlock)) add("iPod touch");
    if (/\bMac\b/i.test(compatBlock)) add("Mac");
    if (/Apple\s*TV/i.test(compatBlock)) add("Apple TV");
    if (/Apple\s*Watch/i.test(compatBlock)) add("Apple Watch");
    if (/iMessage/i.test(compatBlock)) add("iMessage");
    if (platforms.length) out.compatibility = platforms;
  }

  // 相关推荐 App：扫描页面内所有 app 链接（"You Might Also Like" / "More by this developer" 等 shelf）
  //   链接格式：href="https://apps.apple.com/{cc}/app/{slug}/id{digits}"（绝对路径，当前结构）
  //   或 href="/{cc}/app/{slug}/id{digits}"（相对路径，旧结构兼容）
  //   当前 App 自身的 canonical 链接由调用方过滤
  //   Apple 的 app 详情页里 app 链接基本只出现在推荐 shelf，截图 shelf 用 <source srcset> 不会被匹配
  const seenRel = new Set<string>();
  const linkRe = /href="(?:https?:\/\/apps\.apple\.com)?\/[a-z]{2}\/app\/[^"]*?\/id(\d+)"/gi;
  let lm: RegExpExecArray | null;
  while ((lm = linkRe.exec(html)) !== null) {
    const id = lm[1];
    if (seenRel.has(id)) continue;
    seenRel.add(id);
    out.relatedAppIds.push(id);
    if (out.relatedAppIds.length >= 20) break;
  }

  // IAP：从 In-App Purchases 区提取内购档位
  // 多策略兼容 Apple HTML 迭代（JSON key 名 / 结构会随 App Store 改版变化，
  // 不依赖 svelte hash，用多种结构互为兜底）：
  //   策略 1：items_V3 的 textPair 对象
  //     {"$kind":"textPair","leadingText":"...","trailingText":"..."}
  //   策略 2（兜底）：items[].AnnotationItem.textPairs 元组
  //     "textPairs":[["name","$9.99"],["name2","$9.99"]]
  //   "textPairs" 仅出现在 IAP 区（已验证唯一），结构更简单稳定，
  //   不依赖 items_V3 / textPair / shouldAlwaysPresentExpanded 任一 key。
  const seen = new Set<string>();
  const addIap = (name: string, priceRaw: string) => {
    if (seen.has(name)) return;
    seen.add(name);
    const parsed = parsePrice(priceRaw);
    out.iaps.push({
      name,
      priceRaw,
      amount: parsed.amount ?? 0,
      currency: resolveCurrency(parsed, storefrontCurrency),
      period: detectPeriod(name),
    });
  };

  // 策略 1：items_V3 textPair 对象
  // [\\s\\S] 替代 . 以兼容数组内可能出现的换行（Apple 不同区/CDN 可能返回不同格式）
  const sectionRe =
    /[Ii]n[‑\-][Aa]pp\s*[Pp]urchases[\s\S]*?items_V3":(\[[\s\S]*?\]),"shouldAlwaysPresentExpanded"/g;
  let m: RegExpExecArray | null;
  while ((m = sectionRe.exec(html)) !== null) {
    const pairRe =
      /"\$kind":"textPair","leadingText":"((?:[^"\\]|\\.)*)","trailingText":"((?:[^"\\]|\\.)*)"/g;
    let pm: RegExpExecArray | null;
    while ((pm = pairRe.exec(m[1])) !== null) {
      addIap(unescape(pm[1]), unescape(pm[2]));
    }
  }

  // 策略 2（兜底）：textPairs 元组。仅当策略 1 提取失败时启用。
  // 用括号配平定位 textPairs 数组的闭合 ]，再在内部匹配 ["name","price"] 元组，
  // 避免懒匹配 .*? 在嵌套数组里截断（items_V3 的 button 元素含空数组 [] 会打断旧正则）。
  if (out.iaps.length === 0) {
    const tpIdx = html.indexOf('"textPairs"');
    if (tpIdx >= 0) {
      const afterKey = html.slice(tpIdx);
      const arrStart = afterKey.indexOf("[");
      if (arrStart >= 0) {
        let depth = 0;
        let end = -1;
        for (let i = arrStart; i < afterKey.length; i++) {
          const ch = afterKey[i];
          if (ch === "[") depth++;
          else if (ch === "]") {
            depth--;
            if (depth === 0) {
              end = i;
              break;
            }
          }
        }
        if (end > arrStart) {
          const arrContent = afterKey.slice(arrStart, end + 1);
          const tupleRe =
            /\[\s*"((?:[^"\\]|\\.)*)"\s*,\s*"((?:[^"\\]|\\.)*)"\s*\]/g;
          let tm: RegExpExecArray | null;
          while ((tm = tupleRe.exec(arrContent)) !== null) {
            addIap(unescape(tm[1]), unescape(tm[2]));
          }
        }
      }
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
 * 保留 "App 下载"（付费下载 App 的买断价，由 crawler 合成 period='one_time'，
 *   是买断制 App 唯一可比价档位，必须放行，否则买断 App 会误显示"暂无价格数据"）
 */
export function isSubscriptionIap(
  iapName: string,
  period: SubscriptionPeriod
): boolean {
  // 付费下载 App 的合成买断价档位，始终保留用于跨区比价
  // isAppPurchaseName 兼容 DB 历史值 "App 下载"（旧 crawler 中文硬编码），无需迁移
  if (isAppPurchaseName(iapName)) return true;
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
    rating: number | null;
    ratingCount: number | null;
  };
}> {
  let subtitle: string | null = null;
  let priceLabel: string | null = null;
  let compatibility: string[] | null = null;
  let rating: number | null = null;
  let ratingCount: number | null = null;

  // 单区抓取任务（try/catch 隔离，单区失败不影响其他区）
  // 只 fetch HTML 1 次（不再调 iTunes Lookup API），评分/付费价都从 HTML 提取，
  // 每区 subrequest 从 2 降到 1，40 区总共 40 subrequests（免费计划 50 限额内）。
  const crawlOne = async (region: Region): Promise<RegionFetchResult> => {
    try {
      const html = await fetchHtml(region.code, appId);
      const parsed = parseAppStoreHtml(html, region.currency);
      if (parsed.subtitle && !subtitle) subtitle = parsed.subtitle;
      if (parsed.priceLabel && !priceLabel) priceLabel = parsed.priceLabel;
      if (parsed.compatibility && !compatibility) compatibility = parsed.compatibility;
      // 评分取首个非空（通常各区一致，取 US 区即可）
      if (parsed.rating != null && rating == null) rating = parsed.rating;
      if (parsed.ratingCount != null && ratingCount == null) ratingCount = parsed.ratingCount;
      // 付费下载 App：买断价格作为一个档位加入 iaps（免费 App paidPrice=null 跳过）
      if (parsed.paidPrice) {
        parsed.iaps.unshift({
          name: APP_PURCHASE_KEY,
          priceRaw: parsed.paidPrice.formattedPrice,
          amount: parsed.paidPrice.price,
          currency: parsed.paidPrice.currency,
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
  };

  // 分批并发：Cloudflare Workers subrequest 有上限（免费 50 / 付费 1000/请求）。
  // 每区 1 subrequest（只 fetch HTML），每批 5 区 = 5 subrequests，远低于限制。
  const CRAWL_CONCURRENCY = 5;
  const results: RegionFetchResult[] = [];
  for (let i = 0; i < regions.length; i += CRAWL_CONCURRENCY) {
    const batch = regions.slice(i, i + CRAWL_CONCURRENCY);
    const batchResults = await Promise.all(batch.map(crawlOne));
    results.push(...batchResults);
  }
  return {
    results,
    meta: { subtitle, priceLabel, compatibility, rating, ratingCount },
  };
}
