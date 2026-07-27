"use client";

// 首页定价区：内嵌两档方案，$1.99 档高亮"最划算"
// client 组件：需要调 checkout API + 开 LoginDialog
import { useState } from "react";
import { useTranslations } from "next-intl";
import { LoginDialog } from "./LoginDialog";

interface PricingSectionProps {
  loggedIn: boolean;
}

export function PricingSection({ loggedIn }: PricingSectionProps) {
  const t = useTranslations("Pricing");
  const [loginOpen, setLoginOpen] = useState(false);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBuy = async () => {
    if (!loggedIn) {
      setLoginOpen(true);
      return;
    }
    setBuying(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callbackUrl: window.location.href }),
      });
      if (!res.ok) throw new Error("Failed to create checkout session");
      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Purchase failed");
    } finally {
      setBuying(false);
    }
  };

  return (
    <section id="pricing" className="px-[22px] py-20">
      <div className="mx-auto max-w-[980px]">
        <h2 className="mb-3 text-center text-[clamp(28px,4vw,40px)] font-semibold">
          {t("title")}
        </h2>
        <p className="mx-auto mb-10 max-w-[900px] text-center text-[var(--color-ink-80)]">          {t("desc")}
        </p>

        <div className="mx-auto grid max-w-[680px] grid-cols-1 gap-4 sm:grid-cols-2">
          {/* 免费方案 */}
          <div className="flex flex-col rounded-[18px] border border-black/[0.08] bg-white p-6">
            <div className="flex items-center gap-2">
              <i className="ph ph-gift text-[20px] text-[var(--color-ink-48)]" />
              <span className="text-sm font-semibold text-[var(--color-ink-48)]">
                {t("freeTier")}
              </span>
            </div>
            <div className="mt-3 text-[32px] font-semibold leading-none">
              {t("freePrice")}
            </div>
            <p className="mt-1 text-xs text-[var(--color-ink-48)]">{t("freeNote")}</p>
            <ul className="mt-5 space-y-2.5 text-sm text-[var(--color-ink-80)]">
              <li className="flex items-center gap-2">
                <i className="ph ph-check-circle text-[16px] text-[var(--color-green)]" />
                {t("freeFeature1")}
              </li>
              <li className="flex items-center gap-2">
                <i className="ph ph-check-circle text-[16px] text-[var(--color-green)]" />
                {t("freeFeature2")}
              </li>
              <li className="flex items-center gap-2">
                <i className="ph ph-check-circle text-[16px] text-[var(--color-green)]" />
                {t("freeFeature3")}
              </li>
            </ul>
            <div className="mt-auto pt-6">
              <button
                type="button"
                onClick={loggedIn ? undefined : () => setLoginOpen(true)}
                disabled={loggedIn}
                className="w-full rounded-full border border-black/[0.1] bg-white px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-[var(--color-parchment)] disabled:cursor-default disabled:opacity-60"
              >
                {loggedIn ? t("currentPlan") : t("loginToClaim")}
              </button>
            </div>
          </div>

          {/* 付费方案 - 高亮选中（最划算）*/}
          <div className="relative flex flex-col rounded-[18px] border-2 border-[var(--color-primary-focus)] bg-white p-6 shadow-[0_4px_24px_rgba(0,113,227,0.12)]">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--color-primary-focus)] px-3 py-1 text-[11px] font-semibold text-white shadow-sm">
              <i className="ph ph-star mr-1" />
              {t("bestValue")}
            </div>
            <div className="flex items-center gap-2">
              <i className="ph ph-crown text-[20px] text-[var(--color-primary-focus)]" />
              <span className="text-sm font-semibold text-[var(--color-primary-focus)]">
                {t("paidTier")}
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-[32px] font-semibold leading-none">$1.99</span>
              <span className="text-sm text-[var(--color-ink-48)]">{t("paidPriceNote")}</span>
            </div>
            <p className="mt-1 text-xs text-[var(--color-ink-48)]">
              {t("paidNote")}
            </p>
            <ul className="mt-5 space-y-2.5 text-sm text-[var(--color-ink-80)]">
              <li className="flex items-center gap-2">
                <i className="ph ph-check-circle text-[16px] text-[var(--color-green)]" />
                {t("paidFeature1")}
              </li>
              <li className="flex items-center gap-2">
                <i className="ph ph-check-circle text-[16px] text-[var(--color-green)]" />
                {t("paidFeature2")}
              </li>
              <li className="flex items-center gap-2">
                <i className="ph ph-check-circle text-[16px] text-[var(--color-green)]" />
                {t("paidFeature3")}
              </li>
            </ul>
            <div className="mt-auto pt-6">
              <button
                type="button"
                onClick={handleBuy}
                disabled={buying}
                className="w-full rounded-full bg-[var(--color-primary-focus)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:opacity-50"
              >
                {buying ? (
                  <span className="spinner" />
                ) : loggedIn ? (
                  t("buyButton")
                ) : (
                  t("loginToBuy")
                )}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mx-auto mt-6 max-w-[680px] rounded-[var(--radius-md)] bg-[rgba(255,59,48,0.08)] px-4 py-3 text-sm text-[var(--color-red)]">
            <i className="ph ph-warning-circle" /> {error}
          </div>
        )}
      </div>

      <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
    </section>
  );
}
