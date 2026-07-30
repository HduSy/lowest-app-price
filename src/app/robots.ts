import type { MetadataRoute } from "next";
import { SITE_ORIGIN } from "@/lib/seo";

// robots.txt：允许所有 AI 搜索引擎爬虫（GPTBot / ClaudeBot / PerplexityBot / Google-Extended 等）
// 屏蔽 /api/ 内部接口。sitemap / host 固定指向 SITE_ORIGIN，
// 避免 workers.dev 与自定义域名并存时爬虫信号分裂。
export default async function robots(): Promise<MetadataRoute.Robots> {
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
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
    host: SITE_ORIGIN,
  };
}
