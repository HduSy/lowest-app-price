// ============ 类型定义 ============

export interface Region {
  code: string; // 'us','jp','tr'
  name: string; // 中文名
  name_en: string;
  flag: string; // emoji
  currency: string; // ISO 4217
  sort_order?: number;
}

export interface App {
  app_id: string;
  name: string;
  developer: string | null;
  icon_url: string | null;
  bundle_id: string | null;
  category: string | null; // 主分类
  genres: string[] | null; // 完整分类数组（DB 存 JSON 字符串，读取时解析）
  compatibility: string[] | null; // 兼容平台 ["iPhone","iPad","Mac"]
  subtitle: string | null; // App Store 简介（短副标题）
  priceLabel: string | null; // 价格摘要 "Free · In‑App Purchases"
  rating: number | null; // averageUserRating 0~5 星
  ratingCount: number | null; // userRatingCount 评分数（Apple 不公开下载量，评分数是最接近的热度指标）
  last_fetched_at: string | null;
  submitted_at: string;
}

export interface PriceRow {
  app_id: string;
  region_code: string;
  region_name: string;
  region_name_en: string;
  flag: string;
  iap_key: string;
  iap_name: string;
  price_raw: string;
  amount: number;
  currency: string;
  amount_usd: number | null;
  period: SubscriptionPeriod;
  fetched_at: string;
}

/** 订阅周期识别（从 IAP 名称正则推断） */
export type SubscriptionPeriod =
  | "monthly"
  | "yearly"
  | "weekly"
  | "lifetime"
  | "one_time"
  | null;

export interface IapEntry {
  name: string;
  priceRaw: string;
  amount: number;
  currency: string;
  period: SubscriptionPeriod;
}

// 单区抓取结果（爬虫输出）
export interface RegionFetchResult {
  region: Region;
  status: "ok" | "no-iap" | "parse-fail" | "error";
  data: { iaps: IapEntry[] } | null;
  error?: string;
}

// 聚合后单个 IAP 档位的某地区条目
export interface AggregatedEntry {
  region: Region;
  priceRaw: string;
  localAmount: number;
  localCurrency: string;
  convertedAmount: number | null;
  convertedDisplay: string;
}

export interface AggregatedIap {
  name: string;
  key: string;
  entries: AggregatedEntry[];
  lowest: AggregatedEntry | null;
  highest: AggregatedEntry | null;
}

export interface RegionRankItem {
  region: Region;
  avg: number | null;
  total: number;
  count: number;
}

// API 响应
export interface PricesResponse {
  app: App;
  prices: PriceRow[];
  cached: boolean;
}

/**
 * 外部搜索条目（iTunes Search API 返回 + 是否已收录标记）
 * 用于本地库搜不到时的兜底：用户可点击「添加」走 POST /api/apps 流程
 */
export interface ExternalSearchItem {
  appId: string;
  name: string;
  developer: string | null;
  iconUrl: string | null;
  category: string | null;
  isIndexed: boolean; // 是否已在本站 DB 中（避免重复添加）
}
