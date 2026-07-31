// 单个 IAP 档位的地区价格表（套餐内所有地区可见）
import { useTranslations } from "next-intl";
import { aggregatePrices } from "@/lib/compare";
import { formatCurrency } from "@/lib/currencies";
import { isAppPurchaseName } from "@/lib/iap-constants";
import { Flag } from "../Flag";

export function IapPriceList({
  iap,
  currency,
  appId,
}: {
  iap: NonNullable<Awaited<ReturnType<typeof aggregatePrices>>>["iaps"][number];
  currency: string;
  appId: string;
}) {
  const t = useTranslations("PriceTable");
  const lowest = iap.lowest;
  // 只有当至少 3 个有效条目时，才把"最高"标红--避免和最低重叠
  const validCount = iap.entries.filter(
    (e) => e.convertedAmount != null
  ).length;
  const showHighestRed = validCount >= 3;
  const highest = showHighestRed ? iap.highest : null;

  // 价差：以绝对金额展示「最低比最高省了多少钱」，比百分比更直观
  // 例：lowest=$9.99, highest=$16.80 -> 省了 $6.81
  const savedAmount =
    lowest?.convertedAmount != null && iap.highest?.convertedAmount != null
      ? formatCurrency(
          iap.highest.convertedAmount - lowest.convertedAmount,
          currency
        )
      : null;

  return (
    <div className="rounded-[var(--radius-lg)] border border-black/[0.08] overflow-hidden">
      {/* 头部：档位名 + 价差摘要 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/[0.08] bg-[var(--color-parchment)] px-4 py-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold">{isAppPurchaseName(iap.name) ? t("appPurchaseTier") : iap.name}</div>
          <div className="text-xs text-[var(--color-ink-48)]">
            {t("tierRegionsCount", { count: iap.entries.length })}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs">
          {lowest && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(52,199,89,0.1)] px-2.5 py-1 font-semibold text-[var(--color-green-strong)]">
              <i className="ph ph-tag" />
              {t("lowest")} {lowest.convertedDisplay}
              <span className="inline-flex items-center gap-1 font-normal">
                · <Flag code={lowest.region.code} size={14} /> {lowest.region.name_en}
              </span>
            </span>
          )}
          {highest && showHighestRed && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(255,59,48,0.08)] px-2.5 py-1 font-semibold text-[var(--color-red)]">
              <i className="ph ph-tag" />
              {t("highest")} {highest.convertedDisplay}
              <span className="inline-flex items-center gap-1 font-normal">
                · <Flag code={highest.region.code} size={14} /> {highest.region.name_en}
              </span>
            </span>
          )}
          {savedAmount != null && (
            <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-[var(--color-ink-48)]">
              {t.rich("savedHint", {
                amount: savedAmount,
                bold: (chunks) => (
                  <span className="text-sm font-bold text-[var(--color-ink)]">
                    {chunks}
                  </span>
                ),
              })}
            </span>
          )}
        </div>
      </div>

      {/* 表格头 */}
      <div className="grid grid-cols-[2rem_1fr_1fr_auto] gap-3 border-b border-[var(--color-divider)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-48)]">
        <span>#</span>
        <span>{t("colRegion")}</span>
        <span>{t("colLocalPrice")}</span>
        <span className="text-right">{t("colConverted", { currency })}</span>
      </div>
      <div>
        {iap.entries.map((e, idx) => {
          const isLowest = lowest && e.region.code === lowest.region.code;
          const isHighest =
            highest && showHighestRed && e.region.code === highest.region.code;
          const rowBg = isLowest
            ? "bg-[rgba(52,199,89,0.07)]"
            : isHighest
            ? "bg-[rgba(255,59,48,0.06)]"
            : "";
          const labelChip =
            isLowest || isHighest ? (
              <span
                className={`ml-1.5 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                  isLowest
                    ? "bg-[rgba(52,199,89,0.15)] text-[var(--color-green-strong)]"
                    : "bg-[rgba(255,59,48,0.12)] text-[var(--color-red)]"
                }`}
              >
                {isLowest ? t("lowest") : t("highest")}
              </span>
            ) : null;
          const priceColor = isLowest
            ? "text-[var(--color-green-strong)]"
            : isHighest
            ? "text-[var(--color-red)]"
            : "";
          return (
            <div
              key={e.region.code}
              className={`group grid grid-cols-[2rem_1fr_1fr_auto] items-center gap-3 px-4 py-2.5 text-sm transition-colors ${rowBg}`}
            >
              <span className="text-[var(--color-ink-48)] mono-num">
                {idx + 1}
              </span>
              <span className="flex items-center gap-2">
                <Flag code={e.region.code} size={18} />
                <span>
                  {e.region.name_en}
                  {labelChip}
                </span>
                <a
                  href={`https://apps.apple.com/${e.region.code}/app/id${appId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={t("viewOnAppStore", { region: e.region.name_en })}
                  aria-label={t("viewOnAppStore", { region: e.region.name_en })}
                  className="inline-flex items-center text-[var(--color-ink-48)] opacity-0 transition-opacity hover:text-[var(--color-primary-focus)] group-hover:opacity-100"
                >
                  <i className="ph ph-arrow-square-out" />
                </a>
              </span>
              <span className="mono-num text-[var(--color-ink-48)]">
                {e.priceRaw}
              </span>
              <span
                className={`text-right font-semibold mono-num ${priceColor}`}
              >
                {e.convertedDisplay}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
