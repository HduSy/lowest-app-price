import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations, getLocale } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Legal");
  const tLayout = await getTranslations("Layout");
  return {
    title: t("metaTitle", { siteName: tLayout("siteName") }),
    description: t("metaDescription", { siteName: tLayout("siteName") }),
  };
}

export default async function LegalPage() {
  const t = await getTranslations("Legal");
  const tLayout = await getTranslations("Layout");
  const locale = await getLocale();
  const date = new Date().toLocaleDateString(locale);

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

          <h2 className="mt-8 text-xl font-semibold text-[var(--color-ink)]">
            {t("trademarkTitle")}
          </h2>
          <p>{t("trademarkBody")}</p>

          <h2 className="mt-8 text-xl font-semibold text-[var(--color-ink)]">
            {t("sourceTitle")}
          </h2>
          <p>{t("sourceBody")}</p>

          <h2 className="mt-8 text-xl font-semibold text-[var(--color-ink)]">
            {t("liabilityTitle")}
          </h2>
          <p>{t("liabilityIntro")}</p>
          <ul className="ml-5 list-disc space-y-2">
            <li>{t("liability1")}</li>
            <li>{t("liability2")}</li>
            <li>{t("liability3")}</li>
            <li>{t("liability4")}</li>
          </ul>

          <h2 className="mt-8 text-xl font-semibold text-[var(--color-ink)]">
            {t("lawTitle")}
          </h2>
          <p>{t("lawBody")}</p>

          <h2 className="mt-8 text-xl font-semibold text-[var(--color-ink)]">
            {t("relatedTitle")}
          </h2>
          <ul className="ml-5 list-disc space-y-2">
            <li>
              <Link href="/privacy" className="text-[var(--color-primary-focus)] hover:underline">
                {tLayout("privacy")}
              </Link>
            </li>
            <li>
              <Link href="/terms" className="text-[var(--color-primary-focus)] hover:underline">
                {tLayout("terms")}
              </Link>
            </li>
            <li>
              <Link href="/refunds" className="text-[var(--color-primary-focus)] hover:underline">
                {tLayout("refunds")}
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
