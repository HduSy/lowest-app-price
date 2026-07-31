// iTunes Lookup API：拿 App 基本信息（名称、图标、开发者、分类、兼容性、评分、本体价格）
// 比 HTML 爬取稳定得多，Apple 官方公开接口，几乎不限流
// 注意：原 screenshotUrls / ipadScreenshotUrls / macScreenshotUrls 不再持久化到 DB，
//       但 ItunesResult 上保留这三个字段，供 inferCompatibility 在 supportedDevices 为空时兜底推断平台

// 注意 (2026-07)：itunes.apple.com 在 Cloudflare Workers 上会被按出口 IP 段 403 拦截，
// 加 UA 也无法绕过（已验证）。RelatedApps 已改走 apps.apple.com HTML 抓取绕开此限制；
// 但 fetchAppMeta / fetchAppsMeta 仍被 /api/apps、refresh、admin import-from-sitemap 调用，
// 在 CF Workers 上调用这些函数会静默失败 —— 调用方需自行做 HTML fallback 或迁移出 CF。
const ITUNES_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  Accept: "application/json",
  "Accept-Language": "en-US,en;q=0.9",
};

export interface AppMeta {
  name: string | null;
  developer: string | null;
  iconUrl: string | null;
  bundleId: string | null;
  category: string | null; // 主分类 primaryGenreName
  genres: string[] | null; // 完整分类
  compatibility: string[] | null; // ["iPhone","iPad","Mac"]
  rating: number | null; // averageUserRating 0~5 星
  ratingCount: number | null; // userRatingCount 评分数（Apple 不公开下载量，评分数是最接近的热度指标）
  // 下载价格（App 本体，非 IAP）：price=0 或 formattedPrice="Free" 表示免费下载
  // 用于"添加 App"阶段区分付费下载（必有买断价可比）vs 免费下载（需爬 HTML 确认有无 IAP）
  price: number | null;
  formattedPrice: string | null;
  currency: string | null;
}

// 全 null 的 AppMeta 占位值：fetchAppMeta/fetchAppsMeta 失败或未命中时统一返回
function emptyAppMeta(): AppMeta {
  return {
    name: null,
    developer: null,
    iconUrl: null,
    bundleId: null,
    category: null,
    genres: null,
    compatibility: null,
    rating: null,
    ratingCount: null,
    price: null,
    formattedPrice: null,
    currency: null,
  };
}

// 把 Apple artwork URL 缩略图尺寸（100x100 / 60x60）替换为目标尺寸（如 "200x200"）
function upscaleIconUrl(url: string, size: string): string {
  return url.replace(/100x100|60x60/, size);
}

interface ItunesResult {
  trackName?: string;
  artistName?: string;
  artworkUrl100?: string;
  artworkUrl60?: string;
  bundleId?: string;
  primaryGenreName?: string;
  genres?: string[];
  description?: string;
  // 兼容性：supportedDevices 数组 + features.passEnum
  supportedDevices?: string[];
  supportedArchitectures?: string[];
  features?: string[];
  // screenshotUrls / ipadScreenshotUrls / macScreenshotUrls 不再持久化到 DB，
  // 仅作为 supportedDevices 为空时 inferCompatibility 的兜底依据
  macScreenshotUrls?: string[];
  screenshotUrls?: string[];
  ipadScreenshotUrls?: string[];
  averageUserRating?: number;
  userRatingCount?: number;
  // 价格相关字段（Apple 官方 Lookup/Search API 返回）
  price?: number;
  formattedPrice?: string;
  currency?: string;
}

/** 从 iTunes 结果推断兼容平台 */
function inferCompatibility(r: ItunesResult): string[] {
  const platforms = new Set<string>();
  // supportedDevices 形如 ["iPhone3GS-Wifi","iPadPro-Android"...]
  // 注意：iPod touch 不在此判断 —— iTunes API 的 supportedDevices 会列出理论上能安装的设备，
  // 但 App Store 页面可能不显示。iPod touch 交给 crawler 从 HTML 的 all-platforms 块精确解析。
  if (Array.isArray(r.supportedDevices)) {
    for (const d of r.supportedDevices) {
      if (/^iPhone/i.test(d)) platforms.add("iPhone");
      else if (/^iPad/i.test(d)) platforms.add("iPad");
      else if (/^Mac/i.test(d)) platforms.add("Mac");
      else if (/^AppleTV/i.test(d)) platforms.add("Apple TV");
      else if (/^Watch/i.test(d)) platforms.add("Apple Watch");
    }
  }
  // 兜底：用截图字段推断（有些 App supportedDevices 为空）
  if (platforms.size === 0) {
    if (r.screenshotUrls?.length) platforms.add("iPhone");
    if (r.ipadScreenshotUrls?.length) platforms.add("iPad");
    if (r.macScreenshotUrls?.length) platforms.add("Mac");
  }
  return [...platforms];
}

function mapResult(r: ItunesResult): AppMeta {
  return {
    name: r.trackName ?? null,
    developer: r.artistName ?? null,
    iconUrl:
      upscaleIconUrl(r.artworkUrl100 || r.artworkUrl60 || "", "200x200") ||
      null,
    bundleId: r.bundleId ?? null,
    category: r.primaryGenreName ?? null,
    genres: Array.isArray(r.genres) ? r.genres : null,
    compatibility: inferCompatibility(r),
    rating: typeof r.averageUserRating === "number" ? r.averageUserRating : null,
    ratingCount: typeof r.userRatingCount === "number" ? r.userRatingCount : null,
    price: typeof r.price === "number" ? r.price : null,
    formattedPrice: r.formattedPrice ?? null,
    currency: r.currency ?? null,
  };
}

export async function fetchAppMeta(appId: string): Promise<AppMeta> {
  try {
    const resp = await fetch(
      `https://itunes.apple.com/lookup?id=${appId}&country=us`,
      { headers: ITUNES_HEADERS }
    );
    const data = (await resp.json()) as {
      resultCount: number;
      results?: ItunesResult[];
    };
    if (data.resultCount > 0 && data.results?.[0]) {
      return mapResult(data.results[0]);
    }
  } catch (e) {
    console.error(`fetchAppMeta(${appId}):`, e);
  }
  return emptyAppMeta();
}

// 批量 lookup（最多 10 个/次）
export async function fetchAppsMeta(
  appIds: string[]
): Promise<Record<string, AppMeta>> {
  const out: Record<string, AppMeta> = {};
  const BATCH = 10;
  for (let i = 0; i < appIds.length; i += BATCH) {
    const batch = appIds.slice(i, i + BATCH);
    try {
      const url = `https://itunes.apple.com/lookup?id=${batch.join(",")}&country=us`;
      const resp = await fetch(url, { headers: ITUNES_HEADERS });
      const data = (await resp.json()) as { results?: ItunesResult[] };
      const found = new Set<string>();
      for (const r of data.results || []) {
        // 批量查询返回的 trackId 字段
        const id = String((r as { trackId?: number }).trackId ?? "");
        if (!id) continue;
        out[id] = mapResult(r);
        found.add(id);
      }
      for (const id of batch) {
        if (!found.has(id)) {
          // 未命中：name 设为 null（与 fetchAppMeta 一致），调用方应据此跳过
          out[id] = emptyAppMeta();
        }
      }
    } catch (e) {
      console.error(`[fetchAppsMeta] batch failed (size=${batch.length}):`, e);
      for (const id of batch) {
        if (!out[id]) {
          // 批次整体失败：name 设为 null，调用方应据此重试或跳过
          out[id] = emptyAppMeta();
        }
      }
    }
  }
  return out;
}

// ============ App Store 搜索（按名称搜 Apple 全量目录）============

export interface AppStoreSearchResult {
  appId: string;
  name: string;
  developer: string | null;
  iconUrl: string | null;
  category: string | null;
}

/**
 * 调 iTunes Search API 按名称搜索 Apple 全量 App 目录。
 * 用于本地库搜不到时的兜底：让用户从 Apple 搜索结果里一键添加。
 * 公开 API，无需鉴权。
 */
export async function searchAppStore(
  query: string,
  limit = 8
): Promise<AppStoreSearchResult[]> {
  const term = query.trim();
  if (!term) return [];
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(
      term
    )}&entity=software&limit=${limit}`;
    const resp = await fetch(url, {
      headers: ITUNES_HEADERS,
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) return [];
    const data = (await resp.json()) as { results?: ItunesResult[] };
    return (data.results || [])
      .map((r) => {
        const appId = String(
          (r as { trackId?: number }).trackId ?? ""
        );
        return {
          appId,
          name: r.trackName ?? "",
          developer: r.artistName ?? null,
          iconUrl:
            upscaleIconUrl(r.artworkUrl100 || r.artworkUrl60 || "", "120x120") ||
            null,
          category: r.primaryGenreName ?? null,
        };
      })
      .filter((r) => r.appId && r.name);
  } catch {
    return [];
  }
}
