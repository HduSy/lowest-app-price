import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { LOCALE_CODES } from "@/lib/languages";
import { ARTICLES } from "@/lib/insights";
import { localeUrl, localeAlternates } from "@/lib/seo";
import { getTranslations } from "next-intl/server";

// 列表页 metadata：自指 canonical + 18 语言 hreflang
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations("Insights");
  const pathAfterLocale = "/insights";
  return {
    title: t("indexMetaTitle"),
    description: t("indexMetaDescription"),
    alternates: localeAlternates(locale, pathAfterLocale),
    openGraph: {
      type: "website",
      title: t("indexMetaTitle"),
      description: t("indexMetaDescription"),
      url: localeUrl(locale, pathAfterLocale),
    },
    twitter: {
      card: "summary_large_image",
      title: t("indexMetaTitle"),
      description: t("indexMetaDescription"),
    },
  };
}

export default async function InsightsIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!LOCALE_CODES.includes(locale)) notFound();

  const t = await getTranslations("Insights");

  // 列表项展示用：title / description 来自每篇文章自己的 namespace。
  // ARTICLES 数组小（几篇），每篇一次 getTranslations，简单且对未来加文章无侵入。
  const items = await Promise.all(
    ARTICLES.map(async (a) => {
      const ta = await getTranslations(`Insights.${a.messageKey}`);
      return {
        slug: a.slug,
        publishedAt: a.publishedAt,
        title: ta("title"),
        description: ta("description"),
      };
    }),
  );

  return (
    <main className="mx-auto max-w-[980px] px-[22px] py-16">
      <header className="mb-12 text-center">
        <h1 className="mb-3 text-[clamp(30px,4.5vw,44px)] font-semibold leading-tight tracking-tight">
          {t("indexTitle")}
        </h1>
        <p className="mx-auto max-w-[72ch] text-[clamp(16px,1.6vw,19px)] leading-relaxed text-[var(--color-ink-80)]">
          {t("indexSubtitle")}
        </p>
      </header>

      <ul className="space-y-5">
        {items.map((item) => (
          <li key={item.slug}>
            <Link
              href={`/${locale}/insights/${item.slug}`}
              className="group block rounded-[var(--radius-md)] border border-black/[0.08] bg-white p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--color-primary-focus)]/40 hover:shadow-[0_6px_20px_rgba(0,0,0,0.08)]"
            >
              <time
                dateTime={item.publishedAt}
                className="text-xs text-[var(--color-ink-48)]"
              >
                {t("publishedAt", { date: item.publishedAt })}
              </time>
              <h2 className="mt-2 text-xl font-semibold transition-colors group-hover:text-[var(--color-primary-focus)]">
                {item.title}
              </h2>
              <p className="mt-2 leading-relaxed text-[var(--color-ink-80)]">
                {item.description}
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[var(--color-primary-focus)]">
                {t("readArticle")}{" "}
                <i className="ph ph-arrow-right transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
