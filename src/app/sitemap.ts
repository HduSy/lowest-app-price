import type { MetadataRoute } from "next";
import { LANGUAGES } from "@/lib/languages";
import { SITE_ORIGIN, localeUrl, localeHreflangMap } from "@/lib/seo";
import { getDb, listSitemapApps } from "@/lib/db";
import { ARTICLES } from "@/lib/insights";

// 强制动态渲染：sitemap 依赖 D1 的 app 列表，必须在请求时生成（CF Workers 运行时
// 才有 D1 binding；静态预渲染阶段 getCloudflareContext 不可用）。不加此声明 Next 会
// 在 build 时静态预渲染，导致 app 详情页 URL 缺失 + 无法随库更新。
export const dynamic = "force-dynamic";

// sitemap.xml：覆盖（URL 维度 = 18 语言，自 40 国迁移收敛）
//   1. 根级静态页（/about /privacy 等，单 URL，无 hreflang）
//   2. 18 语言首页（含 18 语言 hreflang + x-default）
//   3. 18 语言应用列表页（含 hreflang）
//   4. 18 语言 Insights 列表页 + 每篇文章页（含 hreflang）
//   5. 全部已抓取价格的 app 详情页 /<locale>/apps/<appId>（含 hreflang + 真实 lastmod）
//
// 设计要点：
// - base 固定为 SITE_ORIGIN，避免 workers.dev / 自定义域名并存时 host 漂移
// - hreflang 通过 alternates.languages 发出 <xhtml:link>（Next 自动加 xmlns:xhtml 命名空间）
// - app 详情页 lastmod 用 last_fetched_at（真实价格刷新时间），首页/列表页不设 lastmod
//   （无单一准确时间戳；Google 会按 changefreq 自行调度）
// - sitemap 只列 200 的 canonical URL：老 /<country>/ URL 已由 middleware 301，
//   不进 sitemap（列出会被 GSC 标「网页会重定向」并传递矛盾信号）
// - 单文件足以容纳当前规模（每 URL 含 19 条 hreflang，~2KB/URL，50MB 上限约 2.5 万 URL）；
//   app 数量过千后再评估拆 sitemap index。
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = [];

  // 1. 根级静态页（法律与政策，无 locale 前缀，单 canonical URL）
  //    不含 /sitemap 自身——把自己列进 sitemap 没有索引价值，还制造无意义条目
  const staticPages: { path: string; priority: number }[] = [
    { path: "/about", priority: 0.5 },
    { path: "/privacy", priority: 0.3 },
    { path: "/terms", priority: 0.3 },
    { path: "/refunds", priority: 0.3 },
    { path: "/legal", priority: 0.3 },
  ];
  for (const p of staticPages) {
    pages.push({
      url: `${SITE_ORIGIN}${p.path}`,
      lastModified: undefined,
      changeFrequency: "monthly",
      priority: p.priority,
    });
  }

  // 2 + 3. 18 语言首页 + 应用列表页
  // 4.    18 语言 Insights 列表页 + 每篇文章页（文章 lastmod 用 publishedAt）
  for (const l of LANGUAGES) {
    pages.push({
      url: localeUrl(l.code, ""),
      changeFrequency: "daily",
      priority: 1.0,
      alternates: { languages: localeHreflangMap("") },
    });
    pages.push({
      url: localeUrl(l.code, "/apps"),
      changeFrequency: "daily",
      priority: 0.8,
      alternates: { languages: localeHreflangMap("/apps") },
    });
    pages.push({
      url: localeUrl(l.code, "/insights"),
      changeFrequency: "weekly",
      priority: 0.6,
      alternates: { languages: localeHreflangMap("/insights") },
    });
    for (const a of ARTICLES) {
      const articlePath = `/insights/${a.slug}`;
      pages.push({
        url: localeUrl(l.code, articlePath),
        lastModified: new Date(a.publishedAt + "T00:00:00Z"),
        changeFrequency: "weekly",
        priority: 0.6,
        alternates: { languages: localeHreflangMap(articlePath) },
      });
    }
  }

  // 5. app 详情页（18 语言各一份，含 hreflang + 真实 lastmod）
  //    D1 不可用时静默跳过（本地 dev 无 binding 场景），不阻塞 sitemap 生成
  try {
    const db = await getDb();
    const apps = await listSitemapApps(db);
    const appPath = (appId: string) => `/apps/${appId}`;
    for (const a of apps) {
      const lastModified = a.lastFetchedAt
        ? new Date(a.lastFetchedAt.replace(" ", "T") + "Z")
        : undefined;
      for (const l of LANGUAGES) {
        pages.push({
          url: localeUrl(l.code, appPath(a.appId)),
          lastModified,
          changeFrequency: "daily",
          priority: 0.7,
          alternates: { languages: localeHreflangMap(appPath(a.appId)) },
        });
      }
    }
  } catch (e) {
    // 本地 dev 或 D1 不可用：sitemap 仍返回首页/列表/静态页，不抛错
    console.error("[sitemap] listSitemapApps failed:", e instanceof Error ? e.message : e);
  }

  return pages;
}
