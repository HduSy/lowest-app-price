import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { REGIONS, REGION_MAP, currencyForCountry } from "@/lib/regions";
import { Flag } from "@/components/Flag";
import { PricingSection } from "@/components/PricingSection";
import { ClaudeDemoSection } from "@/components/ClaudeDemoSection";
import { SupportedAppsSection } from "@/components/SupportedAppsSection";
import { getCurrentUser } from "@/lib/session";

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

  // AI SEO: JSON-LD 结构化数据（WebApplication + FAQPage）
  const host = h.get("host") || "appstore-lowest-price.alifeiliu.workers.dev";
  const proto = h.get("x-forwarded-proto") || "https";
  const baseSiteUrl = `${proto}://${host}`;
  const regionCount = REGIONS.length;
  const faqEntries = [
    { q: "价格准吗？", a: `全部来自 App Store 公开页面，覆盖 ${regionCount} 个地区，按当前汇率换算。数据每 6 小时更新一次。` },
    { q: "支持哪些内购？", a: "月度 / 年度订阅、一次性买断、家庭共享等——App Store 详情页公开展示的内购档位都会收录。" },
    { q: "会存储我的数据吗？", a: "只存你添加的 App 信息。登录仅用于同步会员状态，不收集其它个人数据。" },
    { q: "App Store 哪个区订阅最便宜？", a: `每个 App 的最低价地区都不一样。粘贴链接后，本站会抓取 ${regionCount} 个地区的订阅价格，按统一币种换算后从低到高排名——最便宜的区，一眼可见。` },
    { q: "怎么查 App Store 各国价格？", a: `在首页输入框粘贴 App Store 链接或 App ID，回车即可查看该 App 在 ${regionCount} 个地区的内购与订阅价格对比。` },
  ];
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: "App Store 全区比价",
      url: baseSiteUrl,
      description: `粘贴 App Store 链接或 App ID，实时抓取 ${regionCount} 个地区的订阅价格，按统一币种换算后从低到高排名。最便宜的区，一眼可见。`,
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
        `${regionCount} 个 App Store 地区价格对比`,
        "订阅与内购价格按汇率换算",
        "从低到高排名，最便宜的区一眼可见",
        "每天免费 3 次，或 $1.99 永久买断",
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
      {/* Hero */}
      <header className="px-[22px] py-20">
        <div className="mx-auto max-w-[980px] text-center">
          <h1 className="mb-4 text-[clamp(34px,6vw,56px)] font-semibold leading-[1.07] tracking-tight">
            同一个 App，换个地区订阅，
            <br />
            <span className="text-[var(--color-primary-focus)]">能省一半。</span>
          </h1>
          <p className="mx-auto mb-6 max-w-[34ch] text-[clamp(19px,2.2vw,24px)] font-normal leading-[1.65] text-[var(--color-ink-80)]">
            粘贴一个链接，{REGIONS.length} 个地区的订阅价格从低到高排开——哪个区最便宜，一眼就看见。
          </p>
          <div className="mx-auto mb-8 inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white px-3 py-1.5 text-xs">
            <i className="ph ph-navigation-arrow text-[var(--color-primary-focus)]" />
            <span className="text-[var(--color-ink-48)]">你在</span>
            <Flag code={detectedCode} size={14} />
            <strong>{detectedRegion.name}</strong>
            <span className="text-[var(--color-ink-48)]">· 默认</span>
            <span className="mono-num font-semibold">{detectedCurrency}</span>
            <span className="text-[var(--color-ink-48)]">· 别区便宜多少？</span>
          </div>
          <div>
            <Link
              href={`/${country}/apps`}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--color-primary-focus)] px-7 py-3.5 text-lg text-white transition-colors hover:bg-[var(--color-primary)]"
            >
              找最便宜的区 <i className="ph ph-arrow-right" />
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

      {/* Regions */}
      <section id="regions" className="bg-[var(--color-parchment)] px-[22px] py-20">
        <div className="mx-auto max-w-[1100px]">
          <h2 className="mb-3 text-center text-[clamp(28px,4vw,40px)] font-semibold">
            {REGIONS.length} 个地区，全球比价
          </h2>
          <p className="mx-auto mb-10 max-w-[42ch] text-center leading-[1.65] text-[var(--color-ink-80)]">
            从美国到日本，从土耳其到印度——数十个国家和地区的订阅价格实时抓取，按你选的币种一键换算。最便宜的区，一眼就能找到。
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
                    {r.name}
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
            常见问题
          </h2>
          <div className="border-t border-[var(--color-divider)]">
            <FaqItem q="价格准吗？">
              全部来自 App Store 公开页面，覆盖 {REGIONS.length} 个地区，按当前汇率换算。数据每 6 小时更新一次。
            </FaqItem>
            <FaqItem q="支持哪些内购？">
              月度 / 年度订阅、一次性买断、家庭共享等——App Store 详情页公开展示的内购档位都会收录。
            </FaqItem>
            <FaqItem q="会存储我的数据吗？">
              只存你添加的 App 信息。登录仅用于同步会员状态，不收集其它个人数据。
            </FaqItem>
            <FaqItem q="App Store 哪个区订阅最便宜？">
              每个 App 的最低价地区都不一样。粘贴链接后，本站会抓取 {REGIONS.length} 个地区的订阅价格，按统一币种换算后从低到高排名——最便宜的区，一眼可见。
            </FaqItem>
            <FaqItem q="怎么查 App Store 各国价格？">
              在首页输入框粘贴 App Store 链接或 App ID，回车即可查看该 App 在 {REGIONS.length} 个地区的内购与订阅价格对比。
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
        <i className="ph ph-plus text-xl text-[var(--color-ink-48)] transition-transform [details[open]_&]:rotate-45" />
      </summary>
      <p className="mt-3 max-w-[68ch] text-base leading-relaxed text-[var(--color-ink-80)]">
        {children}
      </p>
    </details>
  );
}
