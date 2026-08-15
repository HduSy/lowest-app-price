import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LANGUAGES, LOCALE_CODES } from "@/lib/languages";
import { ARTICLE_BY_SLUG, ARTICLES } from "@/lib/insights";
import { localeUrl, localeAlternates, SITE_ORIGIN } from "@/lib/seo";
import { getDb, getApp, getPrices } from "@/lib/db";
import { aggregatePrices } from "@/lib/compare";
import type { AggregatedIap } from "@/lib/types";
import { ClaudeProGlobalPricingBody, CheapestRegionGuideBody, RegionChangeGuideBody } from "./bodies";

// 文章页是 D1 数据驱动的（每次访问取最新价格），必须请求时渲染。
export const dynamic = "force-dynamic";

// 预渲染参数空间：18 语言 × 已注册文章 slug。
// force-dynamic 下 Next 仍用此列表决定可探索的 URL（爬虫可达性）。
export function generateStaticParams() {
  return LANGUAGES.flatMap((l) =>
    ARTICLES.map((a) => ({ locale: l.code, slug: a.slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const article = ARTICLE_BY_SLUG[slug];
  if (!article) notFound();

  const t = await getTranslations(`Insights.${article.messageKey}`);
  const pathAfterLocale = `/insights/${slug}`;
  return {
    title: t("title"),
    description: t("description"),
    alternates: localeAlternates(locale, pathAfterLocale),
    openGraph: {
      type: "article",
      title: t("title"),
      description: t("description"),
      url: localeUrl(locale, pathAfterLocale),
      publishedTime: article.publishedAt,
    },
    twitter: {
      card: "summary_large_image",
      title: t("title"),
      description: t("description"),
    },
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!LOCALE_CODES.includes(locale)) notFound();
  const article = ARTICLE_BY_SLUG[slug];
  if (!article) notFound();

  const tInsights = await getTranslations("Insights");
  const tArticle = await getTranslations(`Insights.${article.messageKey}`);

  // insights 文章表格固定用 USD（国际通用），不受用户 cookie/IP 币种影响
  const currency = "USD";

  // 取关联 App 的实时价格（如果有），用于数据驱动表格
  let appMeta: { name: string; appId: string } | null = null;
  let iaps: AggregatedIap[] = [];
  if (article.appId) {
    try {
      const db = await getDb();
      const [app, prices] = await Promise.all([
        getApp(db, article.appId),
        getPrices(db, article.appId),
      ]);
      if (app && prices.length) {
        appMeta = { name: app.name, appId: article.appId };
        // insights 文章对所有用户开放，不做 entitlement 过滤，直接全量聚合
        const aggregated = await aggregatePrices(prices, currency);
        iaps = aggregated.iaps;
      }
    } catch (e) {
      // D1 不可用 / 价格缺失：文章正文仍可读，仅表格降级
      console.error(
        `[insights] failed to load app data for ${article.appId}:`,
        e instanceof Error ? e.message : e,
      );
    }
  }

  // 结构性结论（由代码判断，不写死文案）：
  // 按 preferredIap 筛选聚焦套餐，没指定则取第 1 档 IAP。
  // 取该档的最低 / 最高 entry 作为代表性最便宜 / 最贵 region
  let cheapestRegion = "";
  let dearestRegion = "";
  let savingsPct = "";
  let rankedEntries: AggregatedIap["entries"] = [];
  if (iaps.length > 0) {
    const targetIap = article.preferredIap
      ? iaps.find((i) => i.name === article.preferredIap)
      : null;
    const firstIap = targetIap || iaps[0];
    rankedEntries = firstIap.entries;
    if (firstIap.lowest) {
      cheapestRegion = firstIap.lowest.region.name_en;
    }
    if (firstIap.highest) {
      dearestRegion = firstIap.highest.region.name_en;
      if (
        firstIap.lowest &&
        firstIap.lowest.convertedAmount &&
        firstIap.highest.convertedAmount
      ) {
        const pct = Math.round(
          (1 - firstIap.lowest.convertedAmount / firstIap.highest.convertedAmount) * 100,
        );
        savingsPct = `${pct}%`;
      }
    }
  }

  const articleUrl = localeUrl(locale, `/insights/${slug}`);

  // JSON-LD：Article（headline / datePublished / mainEntity）+ BreadcrumbList
  // 两者都指回当前 locale URL，与 hreflang 集群保持实体信号一致
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: tArticle("title"),
      description: tArticle("description"),
      datePublished: article.publishedAt,
      dateModified: article.publishedAt,
      mainEntityOfPage: { "@type": "WebPage", "@id": articleUrl },
      url: articleUrl,
      author: {
        "@type": "Organization",
        name: "LowestAppPrice",
        url: SITE_ORIGIN,
      },
      publisher: {
        "@type": "Organization",
        name: "LowestAppPrice",
        url: SITE_ORIGIN,
        logo: {
          "@type": "ImageObject",
          url: `${SITE_ORIGIN}/icon.svg`,
        },
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: tInsights("indexTitle"),
          item: localeUrl(locale, "/insights"),
        },
        {
          "@type": "ListItem",
          position: 2,
          name: tArticle("title"),
          item: articleUrl,
        },
      ],
    },
  ];

  return (
    <main className="mx-auto max-w-[760px] px-[22px] py-12">
      {/* 面包屑 */}
      <Link
        href={`/${locale}/insights`}
        className="mb-8 inline-flex items-center gap-1 text-sm text-[var(--color-primary-focus)] hover:underline"
      >
        <i className="ph ph-arrow-left" /> {tInsights("backToIndex")}
      </Link>

      {/* 文章头 */}
      <header className="mb-10">
        <h1 className="mb-3 text-[clamp(28px,4vw,40px)] font-semibold leading-[1.15] tracking-tight">
          {tArticle("title")}
        </h1>
        <p className="mb-3 text-[var(--color-ink-48)] text-sm">
          {tInsights("publishedAt", { date: article.publishedAt })}
        </p>
        <p className="text-[clamp(17px,1.7vw,20px)] leading-relaxed text-[var(--color-ink-80)]">
          {tArticle("lede")}
        </p>
      </header>

      {/* 正文：按 slug 分发到对应 body 组件 */}
      {slug === "claude-pro-global-pricing" && (
        <ClaudeProGlobalPricingBody
          messageKey={article.messageKey}
          iaps={iaps}
          currency={currency}
          cheapestRegion={cheapestRegion}
          dearestRegion={dearestRegion}
          savingsPct={savingsPct}
          rankedEntries={rankedEntries}
          appMeta={appMeta}
          locale={locale}
        />
      )}

      {slug === "app-store-cheapest-region-guide" && (
        <CheapestRegionGuideBody
          messageKey={article.messageKey}
          iaps={iaps}
          currency={currency}
          cheapestRegion={cheapestRegion}
          dearestRegion={dearestRegion}
          savingsPct={savingsPct}
          rankedEntries={rankedEntries}
          appMeta={appMeta}
          locale={locale}
        />
      )}

      {slug === "app-store-region-change-guide" && (
        <RegionChangeGuideBody messageKey={article.messageKey} />
      )}

      {/* 结构化数据 */}
      {jsonLd.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
    </main>
  );
}
