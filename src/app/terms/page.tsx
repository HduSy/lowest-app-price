import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations, getLocale } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Terms");
  const tLayout = await getTranslations("Layout");
  return {
    title: t("metaTitle", { siteName: tLayout("siteName") }),
    description: t("metaDescription", { siteName: tLayout("siteName") }),
  };
}

export default async function TermsPage() {
  const t = await getTranslations("Terms");
  const tLayout = await getTranslations("Layout");
  const locale = await getLocale();
  const date = new Date().toLocaleDateString(locale);
  const siteName = tLayout("siteName");

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

          <p>{t("intro", { siteName })}</p>

          <h2 className="mt-8 text-xl font-semibold text-[var(--color-ink)]">
            {t("serviceTitle")}
          </h2>
          <p>{t("serviceBody")}</p>

          <h2 className="mt-8 text-xl font-semibold text-[var(--color-ink)]">
            {t("disclaimerTitle")}
          </h2>
          <ul className="ml-5 list-disc space-y-2">
            <li>{t("disclaimer1")}</li>
            <li>{t("disclaimer2")}</li>
            <li>{t("disclaimer3")}</li>
            <li>{t("disclaimer4")}</li>
          </ul>

          <h2 className="mt-8 text-xl font-semibold text-[var(--color-ink)]">
            {t("accountTitle")}
          </h2>
          <p>
            {t.rich("accountBody", {
              link: (chunks) => (
                <Link href="/refunds" className="text-[var(--color-primary-focus)] hover:underline">
                  {chunks}
                </Link>
              ),
            })}
          </p>
          <p>
            {t.rich("accountBinding", {
              bold: (chunks) => (
                <strong className="text-[var(--color-ink)]">{chunks}</strong>
              ),
            })}
          </p>

          <h2 className="mt-8 text-xl font-semibold text-[var(--color-ink)]">
            {t("fairUseTitle")}
          </h2>
          <p>{t("fairUseIntro")}</p>
          <ul className="ml-5 list-disc space-y-2">
            <li>{t("fairUse1")}</li>
            <li>{t("fairUse2")}</li>
            <li>{t("fairUse3")}</li>
          </ul>

          <h2 className="mt-8 text-xl font-semibold text-[var(--color-ink)]">
            {t("ipTitle")}
          </h2>
          <p>{t("ipBody")}</p>

          <h2 className="mt-8 text-xl font-semibold text-[var(--color-ink)]">
            {t("changesTitle")}
          </h2>
          <p>{t("changesBody")}</p>
        </div>
      </div>
    </div>
  );
}
