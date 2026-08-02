import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Flag } from "@/components/Flag";
import type { AggregatedIap } from "@/lib/types";

// 截图 figure：圆角边框 + 带阴影 + 图注（i18n）
function Figure({
  src,
  alt,
  caption,
  width = 1200,
}: {
  src: string;
  alt: string;
  caption: string;
  width?: number;
}) {
  return (
    <figure className="my-8">
      <div className="overflow-hidden rounded-[var(--radius-md)] border border-black/[0.08] shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
        <img
          src={src}
          alt={alt}
          width={width}
          className="block w-full h-auto"
          loading="lazy"
        />
      </div>
      {caption && (
        <figcaption className="mt-2 text-center text-xs text-[var(--color-ink-48)]">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

// 段落渲染：支持 <strong>...</strong> 内联加粗
function RichParagraph({ text }: { text: string }) {
  const parts = text.split(/(<strong>.*?<\/strong>)/g);
  return (
    <p className="mb-4 leading-[1.7] text-[var(--color-ink-80)]">
      {parts.map((part, i) => {
        const m = part.match(/^<strong>(.*)<\/strong>$/);
        if (m) {
          return (
            <strong key={i} className="font-semibold text-[var(--color-ink)]">
              {m[1]}
            </strong>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
}

// 无序列表渲染：每项前缀 checkmark 图标
function FeatureList({ items }: { items: string[] }) {
  return (
    <ul className="mb-6 space-y-2">
      {items.map((item, i) => (
        <li
          key={i}
          className="flex items-start gap-2 leading-[1.7] text-[var(--color-ink-80)]"
        >
          <i className="ph-fill ph-check-circle mt-[2px] text-[var(--color-primary-focus)]" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

// 分类列表渲染：每项前缀 dots 图标
function CategoryList({ items }: { items: string[] }) {
  return (
    <ul className="mb-6 space-y-2">
      {items.map((item, i) => (
        <li
          key={i}
          className="flex items-start gap-2 leading-[1.7] text-[var(--color-ink-80)]"
        >
          <i className="ph ph-dots-nine mt-[2px] text-[var(--color-ink-48)]" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

// 实时数据表格：渲染某 IAP 的全区价格排名
function PriceRankingTable({
  entries,
  currency,
  rankHeader,
  regionHeader,
  priceHeader,
  noteHeader,
  cheapestNote,
  dearestNote,
  usNote,
}: {
  entries: AggregatedIap["entries"];
  currency: string;
  rankHeader: string;
  regionHeader: string;
  priceHeader: string;
  noteHeader: string;
  cheapestNote: string;
  dearestNote: string;
  usNote: string;
}) {
  if (!entries.length) return null;
  const lastIndex = entries.length - 1;

  return (
    <div className="my-8 overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-[var(--color-divider)] text-left">
            <th className="py-2 pr-3 font-semibold">{rankHeader}</th>
            <th className="py-2 pr-3 font-semibold">{regionHeader}</th>
            <th className="py-2 pr-3 text-right font-semibold">
              {priceHeader}
            </th>
            <th className="py-2 font-semibold">{noteHeader}</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, idx) => {
            const isCheapest = idx === 0;
            const isDearest = idx === lastIndex;
            const isUs = entry.region.code === "us";
            return (
              <tr
                key={entry.region.code}
                className="border-b border-[var(--color-divider)]"
              >
                <td className="py-2 pr-3 text-[var(--color-ink-48)]">
                  {idx + 1}
                </td>
                <td className="py-2 pr-3">
                  <span className="inline-flex items-center gap-2">
                    <Flag code={entry.region.code} size={18} />
                    <span>{entry.region.name_en}</span>
                  </span>
                </td>
                <td className="py-2 pr-3 text-right mono-num font-medium">
                  {entry.convertedDisplay}
                </td>
                <td className="py-2 text-xs text-[var(--color-ink-48)]">
                  {isCheapest
                    ? cheapestNote
                    : isDearest
                      ? dearestNote
                      : isUs
                        ? usNote
                        : ""}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-[var(--color-ink-48)]">
        ※ {currency}
      </p>
    </div>
  );
}

// 第 1 篇文章：Claude Pro 全球定价差异
export async function ClaudeProGlobalPricingBody({
  messageKey,
  iaps,
  currency,
  cheapestRegion,
  dearestRegion,
  savingsPct,
  rankedEntries,
  appMeta,
  country,
}: {
  messageKey: string;
  iaps: AggregatedIap[];
  currency: string;
  cheapestRegion: string;
  dearestRegion: string;
  savingsPct: string;
  rankedEntries: AggregatedIap["entries"];
  appMeta: { name: string; appId: string } | null;
  country: string;
}) {
  const t = await getTranslations(`Insights.${messageKey}`);
  const tCommon = await getTranslations("Insights");

  return (
    <article className="prose-insights">
      {/* 第 1 节：苹果的区域定价机制 */}
      <h2 className="mb-4 mt-10 text-2xl font-semibold tracking-tight">
        {t("h2Why")}
      </h2>
      <RichParagraph text={t("pWhy1")} />
      <RichParagraph text={t("pWhy2")} />

      {/* 第 2 节：工具介绍 */}
      <h2 className="mb-4 mt-10 text-2xl font-semibold tracking-tight">
        {t("h2Tool")}
      </h2>
      <RichParagraph text={t("pTool1")} />
      <FeatureList
        items={[
          t("pFeature1"),
          t("pFeature2"),
          t("pFeature3"),
          t("pFeature4"),
          t("pFeature5"),
        ]}
      />
      <p className="mb-4 text-sm text-[var(--color-ink-48)]">{t("pToolUrl")}</p>

      {/* 第 3 节：实战案例 + 实时数据表 */}
      <h2 className="mb-4 mt-10 text-2xl font-semibold tracking-tight">
        {t("h2Case")}
      </h2>
      <RichParagraph text={t("pCase1", { currency })} />

      {rankedEntries.length > 0 && (
        <PriceRankingTable
          entries={rankedEntries}
          currency={currency}
          rankHeader={tCommon("rankHeader")}
          regionHeader={tCommon("regionHeader")}
          priceHeader={tCommon("priceHeader", { currency })}
          noteHeader={tCommon("noteHeader")}
          cheapestNote={tCommon("cheapestNote")}
          dearestNote={tCommon("dearestNote")}
          usNote={tCommon("usNote")}
        />
      )}

      {/* 结构性结论：由代码计算，非写死 */}
      {cheapestRegion && dearestRegion && (
        <p className="mb-4 rounded-[var(--radius-md)] bg-[var(--color-parchment)] px-4 py-3 text-sm leading-relaxed">
          {tCommon("savingsLine", {
            cheapestRegion,
            dearestRegion,
            savingsPct,
          })}
        </p>
      )}

      <RichParagraph text={t("pCase2")} />

      {/* CTA：跳到关联 App 详情页（全文比价 + 全部档位） */}
      {appMeta && (
        <p className="mt-6 mb-4 leading-[1.7] text-[var(--color-ink-80)]">
          {tCommon("relatedAppNote")}{" "}
          <Link
            href={`/${country}/apps/${appMeta.appId}`}
            className="text-[var(--color-primary-focus)] hover:underline"
          >
            {tCommon("relatedAppCta", { app: appMeta.name })}
            <i className="ph ph-arrow-right ml-1" />
          </Link>
        </p>
      )}

      {/* 第 4 节：有趣的发现 */}
      <h2 className="mb-4 mt-10 text-2xl font-semibold tracking-tight">
        {t("h2Findings")}
      </h2>
      <RichParagraph text={t("pFinding1")} />
      <RichParagraph text={t("pFinding2")} />
      <RichParagraph text={t("pFinding3")} />
      <RichParagraph text={t("pFinding4")} />
      <RichParagraph text={t("pFinding5")} />

      {/* 第 5 节：还能看什么 */}
      <h2 className="mb-4 mt-10 text-2xl font-semibold tracking-tight">
        {t("h2More")}
      </h2>
      <RichParagraph text={t("pMore1")} />
      <Figure
        src="/insights/homepage-apps.png"
        alt={tCommon("figureHomepageAppsAlt")}
        caption={tCommon("figureHomepageApps")}
      />
      <CategoryList
        items={[
          t("pCategory1"),
          t("pCategory2"),
          t("pCategory3"),
          t("pCategory4"),
          t("pCategory5"),
          t("pCategory6"),
        ]}
      />
      <RichParagraph text={t("pMore2")} />

      {/* 第 6 节：注意事项 */}
      <h2 className="mb-4 mt-10 text-2xl font-semibold tracking-tight">
        {t("h2Caveats")}
      </h2>
      <RichParagraph text={t("pCaveatIntro")} />
      <RichParagraph text={t("pCaveat1")} />
      <RichParagraph text={t("pCaveat2")} />
      <RichParagraph text={t("pCaveat3")} />
      <RichParagraph text={t("pCaveat4")} />

      {/* 第 7 节：总结 */}
      <h2 className="mb-4 mt-10 text-2xl font-semibold tracking-tight">
        {t("h2Conclusion")}
      </h2>
      <RichParagraph text={t("pConclusion1")} />
      <RichParagraph text={t("pConclusion2")} />
    </article>
  );
}

// ============ 决策框架表格 ============
function DecisionTable({
  needHeader,
  regionHeader,
  noteHeader,
  rows,
}: {
  needHeader: string;
  regionHeader: string;
  noteHeader: string;
  rows: { need: string; region: string; note: string }[];
}) {
  return (
    <div className="my-6 overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-[var(--color-divider)] text-left">
            <th className="py-2 pr-3 font-semibold">{needHeader}</th>
            <th className="py-2 pr-3 font-semibold">{regionHeader}</th>
            <th className="py-2 font-semibold">{noteHeader}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-[var(--color-divider)] align-top">
              <td className="py-2 pr-3 font-medium">{r.need}</td>
              <td className="py-2 pr-3 text-[var(--color-ink-80)]">{r.region}</td>
              <td className="py-2 text-xs text-[var(--color-ink-48)]">{r.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============ FAQ 手风琴（<details> 纯 CSS，无 JS） ============
function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group border-b border-[var(--color-divider)] py-4">
      <summary className="flex cursor-pointer items-center justify-between font-semibold text-[var(--color-ink)] marker:content-none">
        {q}
        <i className="ph ph-caret-right transition-transform group-open:rotate-90 text-[var(--color-ink-48)]" />
      </summary>
      <p className="mt-3 leading-[1.7] text-[var(--color-ink-80)]">{a}</p>
    </details>
  );
}

// ============ 第 2 篇：App Store 哪个区订阅最便宜 ============
export async function CheapestRegionGuideBody({
  messageKey,
  iaps,
  currency,
  cheapestRegion,
  dearestRegion,
  savingsPct,
  rankedEntries,
  appMeta,
  country,
}: {
  messageKey: string;
  iaps: AggregatedIap[];
  currency: string;
  cheapestRegion: string;
  dearestRegion: string;
  savingsPct: string;
  rankedEntries: AggregatedIap["entries"];
  appMeta: { name: string; appId: string } | null;
  country: string;
}) {
  const t = await getTranslations(`Insights.${messageKey}`);
  const tCommon = await getTranslations("Insights");

  return (
    <article className="prose-insights">
      {/* TL;DR */}
      <div className="mb-10 rounded-[var(--radius-md)] border border-[var(--color-primary-focus)]/20 bg-[var(--color-primary-focus)]/[0.04] p-5">
        <h2 className="mb-3 text-lg font-semibold">{t("tldrTitle")}</h2>
        <ul className="space-y-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <li
              key={n}
              className="flex items-start gap-2 text-sm leading-relaxed text-[var(--color-ink-80)]"
            >
              <i className="ph-fill ph-circle-half text-[var(--color-primary-focus)] mt-[3px] text-[8px]" />
              <span>{t(`tldr${n}`)}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* 第 1 节：为什么价格不同 */}
      <h2 className="mb-4 mt-10 text-2xl font-semibold tracking-tight">
        {t("h2Why")}
      </h2>
      <RichParagraph text={t("pWhy1")} />
      <RichParagraph text={t("pWhy2")} />
      <RichParagraph text={t("pWhy3")} />

      {/* 第 2 节：2026 低价区 */}
      <h2 className="mb-4 mt-10 text-2xl font-semibold tracking-tight">
        {t("h2Regions")}
      </h2>
      <RichParagraph text={t("pRegionsIntro")} />
      <h3 className="mb-3 mt-6 text-lg font-semibold">{t("h3WorthWatching")}</h3>
      <RichParagraph text={t("pWorth1")} />
      <RichParagraph text={t("pWorth2")} />
      <RichParagraph text={t("pWorth3")} />
      <h3 className="mb-3 mt-6 text-lg font-semibold">{t("h3Expired")}</h3>
      <RichParagraph text={t("pExpired1")} />

      {/* 第 3 节：ChatGPT 动态比价表 */}
      <h2 className="mb-4 mt-10 text-2xl font-semibold tracking-tight">
        {t("h2PriceTable")}
      </h2>
      <RichParagraph text={t("pPriceTableIntro", { currency })} />

      <Figure
        src="/insights/chatgpt-price-table.png"
        alt={tCommon("figureChatgptTableAlt")}
        caption={tCommon("figureChatgptTable")}
      />

      {rankedEntries.length > 0 && (
        <PriceRankingTable
          entries={rankedEntries}
          currency={currency}
          rankHeader={tCommon("rankHeader")}
          regionHeader={tCommon("regionHeader")}
          priceHeader={tCommon("priceHeader", { currency })}
          noteHeader={tCommon("noteHeader")}
          cheapestNote={tCommon("cheapestNote")}
          dearestNote={tCommon("dearestNote")}
          usNote={tCommon("usNote")}
        />
      )}

      {cheapestRegion && dearestRegion && (
        <p className="mb-4 rounded-[var(--radius-md)] bg-[var(--color-parchment)] px-4 py-3 text-sm leading-relaxed">
          {tCommon("savingsLine", { cheapestRegion, dearestRegion, savingsPct })}
        </p>
      )}

      {appMeta && (
        <p className="mt-6 mb-4 leading-[1.7] text-[var(--color-ink-80)]">
          {tCommon("relatedAppNote")}{" "}
          <Link
            href={`/${country}/apps/${appMeta.appId}`}
            className="text-[var(--color-primary-focus)] hover:underline"
          >
            {tCommon("relatedAppCta", { app: appMeta.name })}
            <i className="ph ph-arrow-right ml-1" />
          </Link>
        </p>
      )}

      <RichParagraph text={t("pPriceTableRead")} />

      {/* 第 4 节：核价方法 */}
      <h2 className="mb-4 mt-10 text-2xl font-semibold tracking-tight">
        {t("h2Verify")}
      </h2>
      <RichParagraph text={t("pVerifyIntro")} />
      <Figure
        src="/insights/app-detail-overview.png"
        alt={tCommon("figureAppDetailAlt")}
        caption={tCommon("figureAppDetail")}
      />
      <FeatureList
        items={[t("pVerify1"), t("pVerify2"), t("pVerify3"), t("pVerify4")]}
      />
      <Figure
        src="/insights/region-currency-picker.png"
        alt={tCommon("figurePickerAlt")}
        caption={tCommon("figurePicker")}
        width={800}
      />

      {/* 第 5 节：改区/礼品卡/支付 */}
      <h2 className="mb-4 mt-10 text-2xl font-semibold tracking-tight">
        {t("h2Account")}
      </h2>
      <RichParagraph text={t("pAccount1")} />
      <RichParagraph text={t("pAccount2")} />
      <RichParagraph text={t("pAccount3")} />

      {/* 第 6 节：风险 */}
      <h2 className="mb-4 mt-10 text-2xl font-semibold tracking-tight">
        {t("h2Risk")}
      </h2>
      <RichParagraph text={t("pRiskIntro")} />
      <RichParagraph text={t("pRisk1")} />
      <RichParagraph text={t("pRisk2")} />
      <RichParagraph text={t("pRisk3")} />
      <RichParagraph text={t("pRisk4")} />
      <RichParagraph text={t("pRisk5")} />

      {/* 第 7 节：决策框架 */}
      <h2 className="mb-4 mt-10 text-2xl font-semibold tracking-tight">
        {t("h2Decision")}
      </h2>
      <RichParagraph text={t("pDecisionIntro")} />
      <DecisionTable
        needHeader={t("decisionNeed")}
        regionHeader={t("decisionRegion")}
        noteHeader={t("decisionNote")}
        rows={[
          { need: t("d1Need"), region: t("d1Region"), note: t("d1Note") },
          { need: t("d2Need"), region: t("d2Region"), note: t("d2Note") },
          { need: t("d3Need"), region: t("d3Region"), note: t("d3Note") },
          { need: t("d4Need"), region: t("d4Region"), note: t("d4Note") },
          { need: t("d5Need"), region: t("d5Region"), note: t("d5Note") },
        ]}
      />

      {/* 第 8 节：FAQ */}
      <h2 className="mb-4 mt-10 text-2xl font-semibold tracking-tight">
        {t("h2Faq")}
      </h2>
      <div className="mt-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
          <FaqItem key={n} q={t(`faqQ${n}`)} a={t(`faqA${n}`)} />
        ))}
      </div>

      {/* 第 9 节：下一步 */}
      <h2 className="mb-4 mt-10 text-2xl font-semibold tracking-tight">
        {t("h2Next")}
      </h2>
      <FeatureList
        items={[t("pNext1"), t("pNext2"), t("pNext3"), t("pNext4")]}
      />
      <RichParagraph text={t("pNextNote")} />
    </article>
  );
}
