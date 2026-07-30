import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations, getLocale } from "next-intl/server";
import { getPricingVariant } from "@/lib/pricing-variant";
import { staticAlternates } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Privacy");
  const tLayout = await getTranslations("Layout");
  return {
    title: t("metaTitle", { siteName: tLayout("siteName") }),
    description: t("metaDescription"),
    alternates: staticAlternates("/privacy"),
  };
}

export default async function PrivacyPage() {
  const t = await getTranslations("Privacy");
  const tLayout = await getTranslations("Layout");
  const locale = await getLocale();
  const date = new Date().toLocaleDateString(locale);
  const siteName = tLayout("siteName");
  const variant = await getPricingVariant();
  const bold = (chunks: React.ReactNode) => <strong>{chunks}</strong>;

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
            {t("collectTitle")}
          </h2>
          <ul className="ml-5 list-disc space-y-2">
            <li>{t.rich("collectAccount", { bold })}</li>
            <li>{t.rich(variant === "B" ? "collectUsageB" : "collectUsage", { bold })}</li>
            <li>{t.rich("collectTech", { bold })}</li>
          </ul>

          <h2 className="mt-8 text-xl font-semibold text-[var(--color-ink)]">
            {t("notDoTitle")}
          </h2>
          <ul className="ml-5 list-disc space-y-2">
            <li>{t("notDo1")}</li>
            <li>{t("notDo2")}</li>
            <li>{t("notDo3")}</li>
          </ul>

          <h2 className="mt-8 text-xl font-semibold text-[var(--color-ink)]">
            {t("cookieTitle")}
          </h2>
          <p>{t("cookieBody")}</p>

          <h2 className="mt-8 text-xl font-semibold text-[var(--color-ink)]">
            {t("retentionTitle")}
          </h2>
          <p>{t("retentionBody")}</p>

          <h2 className="mt-8 text-xl font-semibold text-[var(--color-ink)]">
            {t("securityTitle")}
          </h2>
          <p>{t("securityBody")}</p>

          <h2 className="mt-8 text-xl font-semibold text-[var(--color-ink)]">
            {t("contactTitle")}
          </h2>
          <p>{t("contactBody")}</p>
        </div>
      </div>
    </div>
  );
}
