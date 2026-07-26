import Link from "next/link";
import { getDb, getApp, getPrices } from "@/lib/db";
import { adaptPricesForCompare, aggregate } from "@/lib/compare";
import { getRates } from "@/lib/exchange";
import type { AggregatedEntry } from "@/lib/types";
import { Flag } from "./Flag";
import { AnimatedNumber } from "./AnimatedNumber";

const CLAUDE_APP_ID = "6473753684";

type Accent = "ip" | "low" | "high";

const ACCENT_STYLES: Record<
  Accent,
  { border: string; bg: string; chip: string; price: string }
> = {
  ip: {
    border: "border-black/[0.08]",
    bg: "bg-white",
    chip: "bg-[var(--color-parchment)] text-[var(--color-ink-80)]",
    price: "text-[var(--color-ink)]",
  },
  low: {
    border: "border-[rgba(52,199,89,0.3)]",
    bg: "bg-[rgba(52,199,89,0.05)]",
    chip: "bg-[rgba(52,199,89,0.15)] text-[var(--color-green-strong)]",
    price: "text-[var(--color-green-strong)]",
  },
  high: {
    border: "border-[rgba(255,59,48,0.25)]",
    bg: "bg-[rgba(255,59,48,0.04)]",
    chip: "bg-[rgba(255,59,48,0.12)] text-[var(--color-red)]",
    price: "text-[var(--color-red)]",
  },
};

/**
 * 首页演示区：以 Claude app 订阅为例，展示「最便宜 / 你所在区 / 最贵」三档价格。
 * - 顺序：低价（左，最高）· 你所在区（中）· 高价（右，最矮）
 * - 最便宜卡：-XX% OFF（绿 #248a3d，滚动动效）
 * - 最贵卡：+XX%（红 #ff3b30，滚动动效）
 * - 价格数字均带滚动动效
 * 服务端渲染，静默失败--DB 不可用或无 Claude 数据时不渲染。
 */
export async function ClaudeDemoSection({
  detectedCode,
  displayCurrency,
  country,
}: {
  detectedCode: string;
  displayCurrency: string;
  country: string;
}) {
  let app, prices;
  try {
    const db = await getDb();
    [app, prices] = await Promise.all([
      getApp(db, CLAUDE_APP_ID),
      getPrices(db, CLAUDE_APP_ID),
    ]);
  } catch {
    return null;
  }
  if (!app || !prices.length) return null;

  let agg;
  try {
    const rates = await getRates("USD");
    agg = aggregate(adaptPricesForCompare(prices), displayCurrency, rates);
  } catch {
    return null;
  }
  if (!agg.iaps.length) return null;

  // 与详情页默认一致：取最低价档位（iaps 已按 lowest 升序排列）
  const tier = agg.iaps[0];
  const lowest = tier.lowest;
  if (!lowest) return null;

  const validCount = tier.entries.filter((e) => e.convertedAmount != null).length;
  const showHighest = validCount >= 3 && tier.highest;
  const highest = showHighest ? tier.highest : null;

  const ipEntry =
    tier.entries.find((e) => e.region.code === detectedCode) ?? null;

  const ipIsLowest = !!ipEntry && ipEntry.region.code === lowest.region.code;
  const ipIsHighest = !!ipEntry && !!highest && ipEntry.region.code === highest.region.code;

  // 百分比均以「你所在区」为基准
  // discountPct = 最便宜比你所在区便宜多少
  const discountPct =
    ipEntry?.convertedAmount != null &&
    lowest.convertedAmount != null &&
    !ipIsLowest &&
    ipEntry.convertedAmount > lowest.convertedAmount
      ? Math.round(
          ((ipEntry.convertedAmount - lowest.convertedAmount) /
            ipEntry.convertedAmount) *
            100
        )
      : null;
  // premiumPct = 最贵比你所在区贵多少
  const premiumPct =
    ipEntry?.convertedAmount != null &&
    highest?.convertedAmount != null &&
    !ipIsHighest &&
    highest.convertedAmount > ipEntry.convertedAmount
      ? Math.round(
          ((highest.convertedAmount - ipEntry.convertedAmount) /
            ipEntry.convertedAmount) *
            100
        )
      : null;

  const regionCount = agg.regionsCovered.length;

  return (
    <section className="px-[22px] py-20">
      <div className="mx-auto max-w-[1100px]">
        {/* 凸显 Claude app */}
        <div className="mb-10 flex items-center justify-center gap-3.5">
          {app.icon_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={app.icon_url}
              alt=""
              className="h-14 w-14 rounded-[12px] object-cover shadow-[0_2px_10px_rgba(0,0,0,0.1)]"
            />
          )}
          <div className="text-left">
            <div className="text-xl font-semibold leading-tight">
              {app.name}
            </div>
            <div className="mt-0.5 text-sm leading-tight text-[var(--color-ink-48)]">
              {tier.name} · {regionCount} 个地区 / {displayCurrency}
            </div>
          </div>
        </div>

        {/* 高低起伏：最便宜（左，最矮）· 你所在区（中）· 最贵（右，最高） */}
        <div className="flex flex-col gap-3 md:items-end md:justify-center md:gap-5 md:flex-row">
          <PriceCard
            label="最便宜"
            icon="ph-tag"
            entry={lowest}
            accent="low"
            heightClass="md:min-h-[232px]"
            currency={displayCurrency}
            discountPct={discountPct}
          />
          <PriceCard
            label="你所在区"
            icon="ph-navigation-arrow"
            entry={ipEntry}
            accent="ip"
            heightClass="md:min-h-[256px]"
            currency={displayCurrency}
            ipIsLowest={ipIsLowest}
            ipIsHighest={ipIsHighest}
          />
          <PriceCard
            label="最贵"
            icon="ph-tag"
            entry={highest}
            accent="high"
            heightClass="md:min-h-[284px]"
            currency={displayCurrency}
            premiumPct={premiumPct}
          />
        </div>

        {/* CTA */}
        <div className="mt-9 text-center">
          <Link
            href={`/${country}/apps/${CLAUDE_APP_ID}`}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--color-primary-focus)] px-6 py-2.5 text-sm font-semibold text-[var(--color-primary-focus)] transition-all hover:bg-[var(--color-primary-focus)] hover:text-white active:scale-95"
          >
            查看 Claude 全部 {regionCount} 个地区比价
            <i className="ph ph-arrow-right" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function PriceCard({
  label,
  icon,
  entry,
  accent,
  heightClass,
  currency,
  ipIsLowest,
  ipIsHighest,
  discountPct,
  premiumPct,
}: {
  label: string;
  icon: string;
  entry: AggregatedEntry | null;
  accent: Accent;
  heightClass: string;
  currency: string;
  ipIsLowest?: boolean;
  ipIsHighest?: boolean;
  discountPct?: number | null;
  premiumPct?: number | null;
}) {
  const s = ACCENT_STYLES[accent];
  return (
    <div
      className={`flex w-full flex-col justify-between rounded-[var(--radius-lg)] border ${s.border} ${s.bg} p-6 ${heightClass} md:w-auto md:flex-1 md:max-w-[330px]`}
    >
      {/* 顶部：标签 */}
      <div className="flex items-center justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${s.chip}`}
        >
          <i className={`ph ${icon}`} /> {label}
        </span>
        {accent === "ip" && ipIsLowest && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-green-strong)]">
            <i className="ph ph-check-circle" /> 已是最低
          </span>
        )}
        {accent === "ip" && ipIsHighest && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-red)]">
            <i className="ph ph-warning-circle" /> 已是最高
          </span>
        )}
      </div>

      {/* 中部：百分比（最便宜 -XX% OFF 绿 / 最贵 +XX% 红，滚动动效） */}
      {accent === "low" && discountPct != null && discountPct > 0 && (
        <div className="flex flex-col items-center py-1">
          <div className="text-[28px] font-bold leading-none tracking-tight text-[var(--color-green-strong)] mono-num">
            <AnimatedNumber value={discountPct} format="percent-negative" />
            <span className="ml-0.5 text-lg">%</span>
            <span className="ml-1.5 text-sm font-bold tracking-wide">OFF</span>
          </div>
          <div className="mt-1.5 text-[11px] text-[var(--color-ink-48)]">
            比你所在区
          </div>
        </div>
      )}
      {accent === "high" && premiumPct != null && premiumPct > 0 && (
        <div className="flex flex-col items-center py-1">
          <div className="text-[28px] font-bold leading-none tracking-tight text-[var(--color-red)] mono-num">
            <AnimatedNumber value={premiumPct} format="percent-positive" />
            <span className="ml-0.5 text-lg">%</span>
          </div>
          <div className="mt-1.5 text-[11px] text-[var(--color-ink-48)]">
            比你所在区
          </div>
        </div>
      )}

      {/* 底部：地区 + 价格（滚动动效） */}
      {entry ? (
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Flag code={entry.region.code} size={22} />
            <span className="font-semibold">{entry.region.name}</span>
          </div>
          <div className="text-sm text-[var(--color-ink-48)] mono-num">
            {entry.priceRaw}
          </div>
          <div
            className={`mt-1 text-[26px] font-semibold leading-tight mono-num ${s.price}`}
          >
            {entry.convertedAmount != null ? (
              <AnimatedNumber
                value={entry.convertedAmount}
                format="currency"
                currency={currency}
              />
            ) : (
              "-"
            )}
          </div>
        </div>
      ) : (
        <div className="py-6 text-center text-sm text-[var(--color-ink-48)]">
          <i className="ph ph-minus-circle mb-2 block text-2xl" />
          该地区暂无价格
        </div>
      )}
    </div>
  );
}
