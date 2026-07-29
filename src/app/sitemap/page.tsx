import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Sitemap");
  const tLayout = await getTranslations("Layout");
  return {
    title: t("metaTitle", { siteName: tLayout("siteName") }),
    description: t("metaDescription", { siteName: tLayout("siteName") }),
  };
}

export default async function SitemapPage() {
  const t = await getTranslations("Sitemap");
  const tLayout = await getTranslations("Layout");
  const tNav = await getTranslations("Nav");

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

        <div className="space-y-10 text-sm">
          <div>
            <h2 className="mb-4 text-lg font-semibold text-[var(--color-ink)]">
              {t("mainPagesTitle")}
            </h2>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/"
                  className="flex items-center gap-2 text-[var(--color-primary-focus)] hover:underline"
                >
                  <i className="ph ph-house" /> {tNav("home")}
                </Link>
              </li>
              <li>
                <Link
                  href="/apps"
                  className="flex items-center gap-2 text-[var(--color-primary-focus)] hover:underline"
                >
                  <i className="ph ph-grid-four" /> {tNav("apps")}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="mb-4 text-lg font-semibold text-[var(--color-ink)]">
              {t("legalPagesTitle")}
            </h2>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/privacy"
                  className="flex items-center gap-2 text-[var(--color-primary-focus)] hover:underline"
                >
                  <i className="ph ph-shield-check" /> {tLayout("privacy")}
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="flex items-center gap-2 text-[var(--color-primary-focus)] hover:underline"
                >
                  <i className="ph ph-file-text" /> {tLayout("terms")}
                </Link>
              </li>
              <li>
                <Link
                  href="/refunds"
                  className="flex items-center gap-2 text-[var(--color-primary-focus)] hover:underline"
                >
                  <i className="ph ph-credit-card" /> {tLayout("refunds")}
                </Link>
              </li>
              <li>
                <Link
                  href="/legal"
                  className="flex items-center gap-2 text-[var(--color-primary-focus)] hover:underline"
                >
                  <i className="ph ph-scale" /> {tLayout("legal")}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="mb-4 text-lg font-semibold text-[var(--color-ink)]">
              {t("searchEnginesTitle")}
            </h2>
            <ul className="space-y-2">
              <li>
                <a
                  href="/sitemap.xml"
                  className="flex items-center gap-2 text-[var(--color-primary-focus)] hover:underline"
                >
                  <i className="ph ph-file-sitemap" /> {t("xmlSitemap")}
                </a>
              </li>
              <li>
                <a
                  href="/robots.txt"
                  className="flex items-center gap-2 text-[var(--color-primary-focus)] hover:underline"
                >
                  <i className="ph ph-robot" /> {t("robotsTxt")}
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
