import { notFound } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { getDb, getApp, getPrices, isStale } from "@/lib/db";
import { AppDetailClient } from "@/components/AppDetailClient";
import { RelatedApps, RelatedAppsSkeleton } from "@/components/RelatedApps";
import { REGION_MAP, REGIONS } from "@/lib/regions";
import { getCurrentUser } from "@/lib/session";
import { authorizeAppView } from "@/lib/entitlement";
import { filterPricesByAuth, extractIapMetadata, computeFreeCount, filterSubscriptionIaps } from "@/lib/compare";
import { formatUtcInTimezone } from "@/lib/format-time";
import { countryAlternates, countryUrl } from "@/lib/seo";
import type { PriceRow } from "@/lib/types";

const PRICE_TTL_HOURS = 6;

// 动态 metadata：title/description/og:image 都按 app 定制，全 18 语种 i18n 化
// - title/description 用 AppDetail namespace（ICU 占位符 {app}/{count}）
// - canonical 自指当前 /<country>/apps/<appId>，hreflang 覆盖全 40 国 + x-default
// - og:image 指向 /api/og/[appId]，社交平台爬虫读 meta 时会触发 OG 图生成
export async function generateMetadata({
  params,
}: {
  params: Promise<{ country: string; appId: string }>;
}): Promise<Metadata> {
  const { country, appId } = await params;
  const t = await getTranslations("AppDetail");
  const db = await getDb();
  const app = await getApp(db, appId);
  if (!app) return {};

  const ogImageUrl = `/api/og/${appId}`;
  const pathAfterCountry = `/apps/${appId}`;
  const count = REGIONS.length;
  return {
    title: t("metaTitle", { app: app.name }),
    description: t("metaDescription", { app: app.name, count }),
    alternates: countryAlternates(country, pathAfterCountry),
    openGraph: {
      title: t("ogTitle", { app: app.name, count }),
      description: t("ogDescription", { count }),
      url: countryUrl(country, pathAfterCountry),
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: t("ogTitle", { app: app.name, count }) }],
    },
    twitter: {
      card: "summary_large_image",
      title: t("ogTitle", { app: app.name, count }),
      description: t("ogDescription", { count }),
      // X 爬虫拒绝动态 extensionless route（/api/og/{appId}），twitter 用静态 /og.png fallback。
      // Facebook/LinkedIn 等兼容动态，openGraph.images 仍享 per-app 定制图。
      images: ["/og.png"],
    },
  };
}

export default async function AppDetailPage({
  params,
}: {
  params: Promise<{ country: string; appId: string }>;
}) {
  const { country, appId } = await params;
  // 校验 country 合法性
  if (!REGION_MAP[country]) notFound();

  // IP 检测到的真实国家 + 时区（由 middleware 注入 x-detected-country / x-detected-timezone 头）
  // 与 URL 里的 country 区分：用户可能手动切换到别的区，但图标跳转应去 IP 检测区
  const h = await headers();
  const headerCountry = h.get("x-detected-country")?.toLowerCase();
  const detectedCountry =
    headerCountry && REGION_MAP[headerCountry] ? headerCountry : country;
  // 时区：用于"上次更新"等时间字段的本地化展示（IANA，如 "Asia/Shanghai"）
  const detectedTimezone = h.get("x-detected-timezone") || null;

  const db = await getDb();

  // App 必须已在库中（通过 /api/apps 显式添加）。未收录的 App 直接 404，
  // 避免相关推荐等入口点进未收录 App 时绕过登录与噪音过滤规则自动入库。
  // 入库后 last_fetched_at 为 null -> isStale=true -> 客户端触发 40 区价格抓取
  const app = await getApp(db, appId);
  if (!app) notFound();

  // 不在 SSR 阻塞 refreshPrices：先返回现有数据渲染，客户端检测 stale 后异步刷新
  // 避免新 App 首次进详情页白屏数秒（40 区抓取耗时）
  const needFetch = isStale(app.last_fetched_at, PRICE_TTL_HOURS);

  const [refreshedApp, rawPrices] = await Promise.all([
    getApp(db, appId),
    getPrices(db, appId),
  ]);

  // 先剔除一次性购买 + 创作者订阅 + 未分类项，只保留真正的订阅档位
  // 与 /api/apps/[appId]/prices 路由保持一致，避免 SSR 与客户端刷新后视觉跳变
  // filterSubscriptionIaps 必须在 filterPricesByAuth / extractIapMetadata 之前应用
  const allPrices = filterSubscriptionIaps(rawPrices);

  // 鉴权：当前用户能否查看全量价格（付费 / 今日已解锁此 App / 配额可用）
  const currentUser = await getCurrentUser();
  const authResult = await authorizeAppView(currentUser?.id ?? null, appId);
  // 按鉴权过滤 prices（canViewFull=false 时只下发最便宜 N 档，阶梯式，防止 curl/view-source 泄露）
  const totalIaps = new Set(allPrices.map((p) => p.iap_key)).size;
  const freeCount = computeFreeCount(totalIaps);
  const prices = filterPricesByAuth(allPrices, authResult.canViewFull, freeCount);
  // 所有 IAP 元数据（用于前端渲染 tab；锁定档位价格不下发，但 tab 可见）
  const iaps = extractIapMetadata(allPrices);

  // 先用 IP 检测到的时区把"上次更新"时间转成本地时间字符串，
  // 转换失败（时区缺失/无效）时为 null，PriceTable 会回退到原始 UTC 字符串
  const lastFetchedAtLocal = formatUtcInTimezone(
    refreshedApp?.last_fetched_at ?? app.last_fetched_at,
    detectedTimezone
  );

  const t = await getTranslations("AppsPage");
  const tDetail = await getTranslations("AppDetail");
  const tNav = await getTranslations("Nav");

  // AI SEO：从 SSR 可见价格中取最便宜的一档（与页面可见内容一致，不泄露锁定档位）。
  // prices 已按鉴权过滤（canViewFull=false 时只含最便宜 N 档），最便宜档必然在可见集内。
  const cheapest = prices.reduce<PriceRow | null>(
    (min, p) =>
      p.amount_usd != null && (min === null || p.amount_usd < min.amount_usd!)
        ? p
        : min,
    null
  );

  // JSON-LD：BreadcrumbList（站点结构）+ FAQPage（可被 AI 引擎直接抽取的 Q&A）。
  // 仅当存在最便宜价格时才发 FAQ，避免空数据生成无意义结构化数据。
  const appPath = `/apps/${appId}`;
  const jsonLd: object[] = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: tNav("home"), item: countryUrl(country, "") },
        { "@type": "ListItem", position: 2, name: tNav("apps"), item: countryUrl(country, "/apps") },
        { "@type": "ListItem", position: 3, name: app.name, item: countryUrl(country, appPath) },
      ],
    },
  ];
  if (cheapest) {
    const answerVars = {
      app: app.name,
      region: cheapest.region_name_en,
      price: cheapest.price_raw,
      count: REGIONS.length,
    };
    jsonLd.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: tDetail("faqQ1", { app: app.name }),
          acceptedAnswer: {
            "@type": "Answer",
            text: tDetail("cheapestAnswer", answerVars),
          },
        },
      ],
    });
  }

  return (
    <main className="mx-auto max-w-[1100px] px-[22px] py-10">
      <Link
        href={`/${country}/apps`}
        className="mb-6 inline-flex items-center gap-1 text-sm text-[var(--color-primary-focus)] hover:underline"
      >
        <i className="ph ph-arrow-left" /> {t("backToAll")}
      </Link>

      {/* App 头部 + 价格表（客户端包裹：刷新后立即回显 app info） */}
      <AppDetailClient
        app={refreshedApp ?? app}
        prices={prices}
        iaps={iaps}
        cached={!needFetch}
        appId={appId}
        detectedCountry={detectedCountry}
        detectedTimezone={detectedTimezone}
        lastFetchedAtLocal={lastFetchedAtLocal}
        auth={authResult}
        needsRefresh={needFetch}
        isAdmin={currentUser?.role === "admin"}
      />

      {/* AI SEO：可抽取的答案段落（与 FAQPage JSON-LD 文案一致），帮助 AI 引擎在
          "哪个 App Store 区最便宜 for {app}" 类查询中引用本页。仅在有可见价格时渲染。 */}
      {cheapest && (
        <section className="mt-8 rounded-[var(--radius-md)] border border-black/[0.08] bg-[var(--color-parchment)] px-5 py-4 text-sm leading-relaxed text-[var(--color-ink-80)]">
          <p>
            {tDetail("cheapestAnswer", {
              app: app.name,
              region: cheapest.region_name_en,
              price: cheapest.price_raw,
              count: REGIONS.length,
            })}
          </p>
        </section>
      )}

      {/* 相关推荐 App：独立服务端组件流式加载，不阻塞主体渲染 */}
      <Suspense fallback={<RelatedAppsSkeleton />}>
        <RelatedApps appId={appId} country={country} />
      </Suspense>

      {/* AI SEO：结构化数据（BreadcrumbList + FAQPage） */}
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
