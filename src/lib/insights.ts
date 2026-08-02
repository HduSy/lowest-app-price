// ============ Insights 文章注册表 ============
//
// 文章 slug -> metadata 的中央来源。列表页和文章页都依赖这份清单。
// 新增文章步骤：
//   1. 在 messages/{18 种 locale}.json 的 Insights namespace 下加新子 namespace
//      （slug 用 camelCase，messages key 不能用 dash）。slug 文件名用 kebab-case。
//   2. 在下面 ARTICLES 数组里加一项 { slug, messageKey, appId, publishedAt }。
//   3. 在 src/app/[country]/insights/[slug]/page.tsx 的 ARTICLE_RENDERERS 里
//      注册 slug -> 渲染函数映射（文章正文 JSX）。
//
// 设计要点：
// - ARTICLES 是有序数组（列表页按此顺序展示），不可重复 slug。
// - appId 指向 D1 apps 表的 app_id，文章页据此抓取实时价格做数据驱动表格。
//   不依赖 appId 的文章（纯软文）将 appId 设为 null，渲染时跳过价格表。
// - publishedAt 用于 JSON-LD datePublished + 列表页展示，ISO 8601 日期字符串。

export interface ArticleMeta {
  /** URL slug，kebab-case，如 "claude-pro-global-pricing" */
  slug: string;
  /** messages 里 Insights namespace 下的子 namespace 名（camelCase） */
  messageKey: string;
  /** 文章关联的 App（用于实时数据表格），null 表示纯软文无表格 */
  appId: string | null;
  /** 文章聚焦的 IAP 名称（iap_name），null 表示取第一档 */
  preferredIap: string | null;
  /** ISO 8601 发布日期，如 "2025-08-01" */
  publishedAt: string;
}

export const ARTICLES: ArticleMeta[] = [
  {
    slug: "claude-pro-global-pricing",
    messageKey: "claudeProGlobalPricing",
    appId: "6473753684",
    preferredIap: "Claude Max 20x - Monthly",
    publishedAt: "2025-08-01",
  },
  {
    slug: "app-store-cheapest-region-guide",
    messageKey: "cheapestRegionGuide",
    appId: "6448311069",
    preferredIap: null,
    publishedAt: "2026-01-15",
  },
];

/** slug -> meta 映射，文章页快速查表 */
export const ARTICLE_BY_SLUG: Record<string, ArticleMeta> = Object.fromEntries(
  ARTICLES.map((a) => [a.slug, a]),
);
