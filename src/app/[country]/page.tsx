import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { REGIONS, REGION_MAP, currencyForCountry } from "@/lib/regions";
import { Flag } from "@/components/Flag";
import { PricingSection } from "@/components/PricingSection";
import { ClaudeDemoSection } from "@/components/ClaudeDemoSection";
import { SupportedAppsSection } from "@/components/SupportedAppsSection";
import { getCurrentUser } from "@/lib/session";
import { getTranslations } from "next-intl/server";

export default async function HomePage({
  params,
}: {
  params: Promise<{ country: string }>;
}) {
  const { country } = await params;
  if (!REGION_MAP[country]) notFound();

  // IP 检测到的真实国家（事实，不随 URL 变化）
  const h = await headers();
  const detectedCode =
    h.get("x-detected-country") &&
    REGION_MAP[h.get("x-detected-country")!.toLowerCase()]
      ? h.get("x-detected-country")!.toLowerCase()
      : country;
  const detectedRegion = REGION_MAP[detectedCode];
  const detectedCurrency = currencyForCountry(detectedCode);

  // 当前登录状态（定价区 CTA 用）
  const currentUser = await getCurrentUser();
  const t = await getTranslations("HomePage");

  // AI SEO: JSON-LD 结构化数据（WebApplication + FAQPage）
  const host = h.get("host") || "appstore-lowest-price.alifeiliu.workers.dev";
  const proto = h.get("x-forwarded-proto") || "https";
  const baseSiteUrl = `${proto}://${host}`;
  const regionCount = REGIONS.length;
  const faqEntries = [
    { q: t("faqQ1"), a: t("faqA1", { count: regionCount }) },
    { q: t("faqQ2"), a: t("faqA2") },
    { q: t("faqQ3"), a: t("faqA3") },
    { q: t("faqQ4"), a: t("faqA4", { count: regionCount }) },
    { q: t("faqQ5"), a: t("faqA5", { count: regionCount }) },
  ];
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: t("siteName"),
      url: baseSiteUrl,
      description: t("metadataDescription", { count: regionCount }),
      applicationCategory: "UtilityApplication",
      operatingSystem: "Web",
      offers: {
        "@type": "AggregateOffer",
        lowPrice: "0",
        highPrice: "1.99",
        priceCurrency: "USD",
        offerCount: "2",
      },
      featureList: [
        t("feature1", { count: regionCount }),
        t("feature2"),
        t("feature3"),
        t("feature4"),
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqEntries.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];

  return (
    <>
      {/* 首屏：Hero + Claude Demo，一起占满视口剩余空间 */}
      <div className="flex min-h-[calc(100svh-52px)] flex-col justify-center">
        {/* Hero */}
        <header className="px-[22px] py-8">
          <div className="mx-auto max-w-[980px] text-center">
          <h1 className="mb-4 text-[clamp(34px,6vw,56px)] font-semibold leading-[1.07] tracking-tight whitespace-nowrap">
            {t("heroTitle1")}
            <span className="text-[var(--color-primary-focus)]">{t("heroTitle2")}</span>
          </h1>
          <p className="mx-auto mb-6 text-[clamp(19px,2.2vw,24px)] font-normal leading-[1.65] text-[var(--color-ink-80)] whitespace-nowrap">
            {t("heroSubtitle", { count: REGIONS.length })}
          </p>
          <div className="mx-auto mb-8 inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white px-3 py-1.5 text-xs">
            <i className="ph ph-navigation-arrow text-[var(--color-primary-focus)]" />
            <span className="text-[var(--color-ink-48)]">{t("heroLocationLabel")}</span>
            <Flag code={detectedCode} size={14} />
            <strong>{detectedRegion.name_en}</strong>
            <span className="text-[var(--color-ink-48)]">· {t("heroDefaultLabel")}</span>
            <span className="mono-num font-semibold">{detectedCurrency}</span>
            <span className="text-[var(--color-ink-48)]">{t("heroPriceHint")}</span>
          </div>
          <div>
            <Link
              href={`/${country}/apps`}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--color-primary-focus)] px-7 py-3.5 text-lg text-white transition-colors hover:bg-[var(--color-primary)]"
            >
              {t("heroCta")} <i className="ph ph-arrow-right" />
            </Link>
          </div>
        </div>
      </header>

      {/* 实例演示：以 Claude 订阅为例，展示 IP 区 / 最便宜 / 最贵 三档价格 */}
      <ClaudeDemoSection
        detectedCode={detectedCode}
        displayCurrency={detectedCurrency}
        country={country}
      />
      </div>

      {/* Regions */}
      <section id="regions" className="bg-[var(--color-parchment)] px-[22px] py-20">
        <div className="mx-auto max-w-[1100px]">
          <h2 className="mb-3 text-center text-[clamp(28px,4vw,40px)] font-semibold">
            {t("regionsTitle", { count: REGIONS.length })}
          </h2>
          <p className="mx-auto mb-10 max-w-[80ch] text-center leading-[1.65] text-[var(--color-ink-80)]">
            {t("regionsDesc")}
          </p>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
            {REGIONS.map((r) => (
              <div
                key={r.code}
                className="group flex items-center gap-2.5 rounded-[var(--radius-md)] border border-black/[0.08] bg-white p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--color-primary-focus)]/40 hover:shadow-[0_6px_20px_rgba(0,0,0,0.08)]"
                title={`${r.name_en} · ${r.currency}`}
              >
                <span className="transition-transform duration-200 group-hover:scale-110">
                  <Flag code={r.code} size={24} />
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold leading-tight transition-colors group-hover:text-[var(--color-primary-focus)]">
                    {r.name_en}
                  </div>
                  <div className="truncate text-[11px] text-[var(--color-ink-48)]">
                    {r.currency} · {r.name_en}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 定价方案 */}
      <PricingSection loggedIn={!!currentUser} />

      {/* 已收录的 App 滚动 */}
      <SupportedAppsSection country={country} />

      {/* FAQ */}
      <section id="faq" className="px-[22px] py-20">
        <div className="mx-auto max-w-[980px]">
          <h2 className="mb-8 text-center text-[clamp(28px,4vw,40px)] font-semibold">
            {t("faqTitle")}
          </h2>
          <div className="border-t border-[var(--color-divider)]">
            <FaqItem q={t("faqQ1")}>              {t("faqA1", { count: REGIONS.length })}
            </FaqItem>
            <FaqItem q={t("faqQ2")}>
              {t("faqA2")}
            </FaqItem>
            <FaqItem q={t("faqQ3")}>
              {t("faqA3")}
            </FaqItem>
            <FaqItem q={t("faqQ4")}>
              {t("faqA4", { count: REGIONS.length })}
            </FaqItem>
            <FaqItem q={t("faqQ5")}>
              {t("faqA5", { count: REGIONS.length })}
            </FaqItem>
          </div>
        </div>
      </section>

      {/* AI SEO: 结构化数据（WebApplication + FAQPage） */}
      {jsonLd.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
    </>
  );
}

function FaqItem({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="border-b border-[var(--color-divider)] py-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold">
        {q}
        <i className="ph ph-plus shrink-0 text-xl text-[var(--color-ink-48)] transition-transform [details[open]_&]:rotate-45" />
      </summary>
      <p className="mt-3 pr-16 text-base leading-relaxed text-[var(--color-ink-80)]">
        {children}
      </p>
    </details>
  );
}
