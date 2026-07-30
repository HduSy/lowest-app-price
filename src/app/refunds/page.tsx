import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations, getLocale } from "next-intl/server";
import { getPricingVariant } from "@/lib/pricing-variant";
import { staticAlternates } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Refunds");
  const tLayout = await getTranslations("Layout");
  const variant = await getPricingVariant();
  const siteName = tLayout("siteName");
  return {
    title: t("metaTitle", { siteName }),
    description:
      variant === "B"
        ? t("metaDescriptionB", { siteName })
        : t("metaDescription", { siteName }),
    alternates: staticAlternates("/refunds"),
  };
}

export default async function RefundsPage() {
  const t = await getTranslations("Refunds");
  const tLayout = await getTranslations("Layout");
  const locale = await getLocale();
  const date = new Date().toLocaleDateString(locale);
  const siteName = tLayout("siteName");
  const variant = await getPricingVariant();

  return (
    <div className="py-20">
      <div className="mx-auto max-w-[740px] px-[22px]">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-ink-48)] transition-colors hover:text-[var(--color-ink)]"
        >
          <i className="ph ph-caret-left" /> {t("backToHome")}
        </Link>
        <h1 className="mb-8 text-[clamp(32px,5vw,48px)] font-semibold leading-tight tracking-tight">
          {t("title")}
        </h1>

        <div className="space-y-6 text-sm leading-relaxed text-[var(--color-ink-80)]">
          <p>{t("lastUpdated", { date })}</p>

          {variant === "B" ? (
            <>
              {/* B 版（登录即会员，无付费环节）：整页重写为「无付费」说明 */}
              <p>
                {t.rich("introB", {
                  siteName,
                  bold: (chunks) => <strong className="text-[var(--color-ink)]">{chunks}</strong>,
                })}
              </p>

              <h2 className="mt-8 text-xl font-semibold text-[var(--color-ink)]">
                {t("paidContentTitleB")}
              </h2>
              <p>{t("paidContentBodyB")}</p>

              <h2 className="mt-8 text-xl font-semibold text-[var(--color-ink)]">
                {t("rulesTitleB")}
              </h2>
              <p>{t("rulesBodyB")}</p>

              <h2 className="mt-8 text-xl font-semibold text-[var(--color-ink)]">
                {t("noticeTitleB")}
              </h2>
              <p>{t("noticeBodyB")}</p>
            </>
          ) : (
            <>
              <p>{t("intro", { siteName })}</p>

              <h2 className="mt-8 text-xl font-semibold text-[var(--color-ink)]">
                {t("paidContentTitle")}
              </h2>
              <p>{t("paidContentBody")}</p>

              <h2 className="mt-8 text-xl font-semibold text-[var(--color-ink)]">
                {t("rulesTitle")}
              </h2>
              <p>
                {t.rich("rulesBody", {
                  bold: (chunks) => <strong>{chunks}</strong>,
                })}
              </p>
              <ul className="ml-5 list-disc space-y-2">
                <li>{t("rules1")}</li>
                <li>{t("rules2")}</li>
                <li>{t("rules3")}</li>
              </ul>
              <p>{t("rulesSuggestion")}</p>

              <h2 className="mt-8 text-xl font-semibold text-[var(--color-ink)]">
                {t("exceptionsTitle")}
              </h2>
              <p>{t("exceptionsBody")}</p>
              <ul className="ml-5 list-disc space-y-2">
                <li>{t("exceptions1")}</li>
                <li>{t("exceptions2")}</li>
              </ul>

              <h2 className="mt-8 text-xl font-semibold text-[var(--color-ink)]">
                {t("noticeTitle")}
              </h2>
              <p>{t("noticeBody")}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
