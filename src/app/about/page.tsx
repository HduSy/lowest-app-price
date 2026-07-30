import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getPricingVariant } from "@/lib/pricing-variant";
import { staticAlternates } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("About");
  const tLayout = await getTranslations("Layout");
  return {
    title: t("metaTitle", { siteName: tLayout("siteName") }),
    description: t("metaDescription", { siteName: tLayout("siteName") }),
    alternates: staticAlternates("/about"),
  };
}

export default async function AboutPage() {
  const t = await getTranslations("About");
  const tLayout = await getTranslations("Layout");
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

        {/* 标题 + 副标题 */}
        <h1 className="mb-4 text-[clamp(32px,5vw,48px)] font-semibold leading-tight tracking-tight">
          {t("title")}
        </h1>
        <p className="mb-12 text-lg leading-relaxed text-[var(--color-ink-80)]">
          {t("subtitle")}
        </p>

        <div className="space-y-12 text-sm leading-relaxed text-[var(--color-ink-80)]">
          {/* 背景 */}
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-xl font-semibold text-[var(--color-ink)]">
              <i className="ph ph-globe text-[var(--color-primary-focus)]" />
              {t("backgroundTitle")}
            </h2>
            <p>{t("backgroundBody", { siteName })}</p>
          </section>

          {/* 初衷 */}
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-xl font-semibold text-[var(--color-ink)]">
              <i className="ph ph-heart text-[var(--color-primary-focus)]" />
              {t("intentTitle")}
            </h2>
            <p>{t("intentBody")}</p>
          </section>

          {/* 功能包含 */}
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-xl font-semibold text-[var(--color-ink)]">
              <i className="ph ph-list-checks text-[var(--color-primary-focus)]" />
              {t("featuresTitle")}
            </h2>
            <p className="mb-5">{t("featuresIntro")}</p>
            <ul className="space-y-4">
              <FeatureItem
                icon="ph-globe-hemisphere-west"
                title={t("feature1Title")}
              >
                {t("feature1Body")}
              </FeatureItem>
              <FeatureItem
                icon="ph-credit-card"
                title={t("feature2Title")}
              >
                {t("feature2Body")}
              </FeatureItem>
              <FeatureItem
                icon="ph-sort-ascending"
                title={t("feature3Title")}
              >
                {t("feature3Body")}
              </FeatureItem>
              <FeatureItem
                icon="ph-user-circle-dashed"
                title={t("feature4Title")}
              >
                {variant === "B" ? t("feature4BodyB") : t("feature4Body")}
              </FeatureItem>
            </ul>
          </section>

          {/* 如何使用 */}
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-xl font-semibold text-[var(--color-ink)]">
              <i className="ph ph-steering-wheel text-[var(--color-primary-focus)]" />
              {t("howToUseTitle")}
            </h2>
            <p className="mb-5">{t("howToUseIntro")}</p>
            <ol className="space-y-4">
              <StepItem n={1} title={t("step1Title")}>
                {t("step1Body")}
              </StepItem>
              <StepItem n={2} title={t("step2Title")}>
                {t("step2Body")}
              </StepItem>
              <StepItem n={3} title={t("step3Title")}>
                {t("step3Body")}
              </StepItem>
            </ol>
          </section>

          {/* 注释提示 */}
          <p className="rounded-[var(--radius-md)] border border-black/[0.08] bg-[var(--color-parchment)] px-4 py-3 text-xs leading-relaxed text-[var(--color-ink-48)]">
            <i className="ph ph-info mr-1 align-middle" />
            {t("howToUseNote")}
          </p>
        </div>
      </div>
    </div>
  );
}

function FeatureItem({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <i className={`ph ${icon} mt-0.5 shrink-0 text-lg text-[var(--color-primary-focus)]`} />
      <div>
        <p className="font-semibold text-[var(--color-ink)]">{title}</p>
        <p className="mt-1">{children}</p>
      </div>
    </li>
  );
}

function StepItem({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-focus)] text-xs font-semibold text-white">
        {n}
      </span>
      <div className="pt-0.5">
        <p className="font-semibold text-[var(--color-ink)]">{title}</p>
        <p className="mt-1">{children}</p>
      </div>
    </li>
  );
}
