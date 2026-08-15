import { SITE_ORIGIN, APPS_PER_SHARD } from "@/lib/seo";
import { getDb, listSitemapApps } from "@/lib/db";

// sitemap index（替代原单文件 metadata convention 的 sitemap.ts）。
//
// 背景：单文件曾达 16MB+（436 app × 18 语言，每 URL 挂 19 条 hreflang），
// GSC 报「Sitemap file size error」；老 40 国版本（41 hreflang/URL）更是远超
// 50MB 上限。改为 index + 分片后每片 ~100 app（约 1800 URL / ~4MB），
// 远低于所有引擎的尺寸限制。robots.txt 与 GSC 提交地址不变，仍是 /sitemap.xml。
//
// 必须请求时生成：分片数量依赖 D1 的 app 列表（静态预渲染阶段无 D1 binding）。
export const dynamic = "force-dynamic";

export async function GET() {
  let appShards = 0;
  try {
    const db = await getDb();
    const apps = await listSitemapApps(db);
    appShards = Math.ceil(apps.length / APPS_PER_SHARD);
  } catch (e) {
    // D1 不可用（本地 dev 无 binding）：index 只含 pages 分片，不阻塞
    console.error("[sitemap index] listSitemapApps failed:", e instanceof Error ? e.message : e);
  }

  const locations = [
    `${SITE_ORIGIN}/sitemaps/pages.xml`,
    ...Array.from(
      { length: appShards },
      (_, i) => `${SITE_ORIGIN}/sitemaps/apps-${i}.xml`
    ),
  ];

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    locations.map((loc) => `  <sitemap>\n    <loc>${loc}</loc>\n  </sitemap>`).join("\n") +
    `\n</sitemapindex>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
