import type { MetadataRoute } from "next";
import { headers } from "next/headers";

// robots.txt：允许所有 AI 搜索引擎爬虫（GPTBot / ClaudeBot / PerplexityBot / Google-Extended 等）
// 屏蔽 /api/ 内部接口。sitemap 指向动态 host，适配 workers.dev 与自定义域名。
export default async function robots(): Promise<MetadataRoute.Robots> {
  const h = await headers();
  const host = h.get("host") || "lowestappprice.com";
  const proto = h.get("x-forwarded-proto") || "https";
  const base = `${proto}://${host}`;

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/"],
      },
      // AI 搜索引擎显式放行（不屏蔽 = 允许引用）
      { userAgent: "GPTBot", allow: "/" },
      { userAgent: "ChatGPT-User", allow: "/" },
      { userAgent: "ClaudeBot", allow: "/" },
      { userAgent: "anthropic-ai", allow: "/" },
      { userAgent: "PerplexityBot", allow: "/" },
      { userAgent: "Google-Extended", allow: "/" },
      { userAgent: "Bingbot", allow: "/" },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
