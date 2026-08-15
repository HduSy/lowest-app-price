import { SITE_ORIGIN, localeUrl, localeHreflangMap, APPS_PER_SHARD } from "@/lib/seo";
import { LANGUAGES } from "@/lib/languages";
import { getDb, listSitemapApps } from "@/lib/db";
import { ARTICLES } from "@/lib/insights";

// sitemap 分片（由 /sitemap.xml 的 index 指向）。
//   /sitemaps/pages.xml  —— 5 个根级静态页 + 18 语言 × (首页/apps/insights/3 篇文章)
//   /sitemaps/apps-N.xml —— 第 N 批 app（APPS_PER_SHARD 个 × 18 语言）
// middleware 的 "/sitemap" 前缀豁免天然覆盖 /sitemaps/*（startsWith 匹配）。
//
// 设计要点与原单文件 sitemap 一致：
// - 只列 200 的 canonical URL（老 /<country>/ URL 已由 middleware 301，不进 sitemap）
// - hreflang 用 <xhtml:link>（18 语言每 locale 唯一 + x-default -> /en/）
// - app 详情页 lastmod 用 last_fetched_at（真实价格刷新时间）
export const dynamic = "force-dynamic";

interface Entry {
  loc: string;
  alternates?: Record<string, string>;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
}

function entryToXml(e: Entry): string {
  const lines = [`    <loc>${e.loc}</loc>`];
  if (e.lastmod) lines.push(`    <lastmod>${e.lastmod}</lastmod>`);
  if (e.changefreq) lines.push(`    <changefreq>${e.changefreq}</changefreq>`);
  if (e.priority) lines.push(`    <priority>${e.priority}</priority>`);
  if (e.alternates) {
    for (const [lang, href] of Object.entries(e.alternates)) {
      lines.push(
        `    <xhtml:link rel="alternate" hreflang="${lang}" href="${href}"/>`
      );
    }
  }
  return `  <url>\n${lines.join("\n")}\n  </url>`;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ shard: string }> }
) {
  const { shard } = await params;
  const entries: Entry[] = [];

  if (shard === "pages.xml") {
    // 1. 根级静态页（无 locale 前缀，单 canonical URL，不发 hreflang）
    const staticPages: { path: string; priority: string }[] = [
      { path: "/about", priority: "0.5" },
      { path: "/privacy", priority: "0.3" },
      { path: "/terms", priority: "0.3" },
      { path: "/refunds", priority: "0.3" },
      { path: "/legal", priority: "0.3" },
    ];
    for (const p of staticPages) {
      entries.push({
        loc: `${SITE_ORIGIN}${p.path}`,
        changefreq: "monthly",
        priority: p.priority,
      });
    }

    // 2. 18 语言 × (首页 + apps 列表 + insights 列表 + 3 篇文章)
    for (const l of LANGUAGES) {
      entries.push({
        loc: localeUrl(l.code, ""),
        changefreq: "daily",
        priority: "1.0",
        alternates: localeHreflangMap(""),
      });
      entries.push({
        loc: localeUrl(l.code, "/apps"),
        changefreq: "daily",
        priority: "0.8",
        alternates: localeHreflangMap("/apps"),
      });
      entries.push({
        loc: localeUrl(l.code, "/insights"),
        changefreq: "weekly",
        priority: "0.6",
        alternates: localeHreflangMap("/insights"),
      });
      for (const a of ARTICLES) {
        const p = `/insights/${a.slug}`;
        entries.push({
          loc: localeUrl(l.code, p),
          lastmod: `${a.publishedAt}T00:00:00Z`,
          changefreq: "weekly",
          priority: "0.6",
          alternates: localeHreflangMap(p),
        });
      }
    }
  } else {
    // 3. app 分片 apps-N
    const m = shard.match(/^apps-(\d+)\.xml$/);
    if (!m) {
      return new Response("Not found", { status: 404 });
    }
    const idx = Number(m[1]);

    let apps;
    try {
      const db = await getDb();
      apps = await listSitemapApps(db);
    } catch (e) {
      // D1 不可用：分片无法生成，显式 503 让爬虫稍后重试
      console.error("[sitemap shard] listSitemapApps failed:", e instanceof Error ? e.message : e);
      return new Response("DB unavailable", { status: 503 });
    }

    const start = idx * APPS_PER_SHARD;
    const slice = apps.slice(start, start + APPS_PER_SHARD);
    if (slice.length === 0) {
      return new Response("Not found", { status: 404 });
    }

    for (const a of slice) {
      const path = `/apps/${a.appId}`;
      const lastmod = a.lastFetchedAt
        ? a.lastFetchedAt.replace(" ", "T") + "Z"
        : undefined;
      for (const l of LANGUAGES) {
        entries.push({
          loc: localeUrl(l.code, path),
          lastmod,
          changefreq: "daily",
          priority: "0.7",
          alternates: localeHreflangMap(path),
        });
      }
    }
  }

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n` +
    `        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
    entries.map(entryToXml).join("\n") +
    `\n</urlset>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
