import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { REGIONS } from "@/lib/regions";

// sitemap.xml：覆盖 40 个地区的首页 + 全部应用列表页
// App 详情页（/<country>/apps/<appId>）通过 /<country>/apps 列表页被爬虫发现
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const h = await headers();
  const host = h.get("host") || "lowestappprice.com";
  const proto = h.get("x-forwarded-proto") || "https";
  const base = `${proto}://${host}`;

  const now = new Date();
  const pages: MetadataRoute.Sitemap = [];

  // 根路径静态页面（法律与政策，无 country 前缀）
  const staticPages = [
    { path: "/privacy", priority: 0.3 },
    { path: "/terms", priority: 0.3 },
    { path: "/refunds", priority: 0.3 },
    { path: "/legal", priority: 0.3 },
    { path: "/sitemap", priority: 0.2 },
  ];
  for (const p of staticPages) {
    pages.push({
      url: `${base}${p.path}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: p.priority,
    });
  }

  // 40 个地区的首页 + 全部应用列表页
  for (const r of REGIONS) {
    pages.push({
      url: `${base}/${r.code}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
    });
    pages.push({
      url: `${base}/${r.code}/apps`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    });
  }

  return pages;
}
