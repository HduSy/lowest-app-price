// 锁定提示横幅：未登录/配额用完时显示，引导登录或购买
import { useTranslations } from "next-intl";
import { usePricingVariant } from "@/lib/app-store";
import { AppViewAuth, DAILY_VIEW_LIMIT } from "@/lib/entitlement";

export function LockedBanner({
  auth,
  unlocking,
  error,
  onBuy,
  onLogin,
}: {
  auth: AppViewAuth;
  unlocking: boolean;
  error: string | null;
  onBuy: () => void;
  onLogin: () => void;
}) {
  const t = useTranslations("PriceTable");
  const variant = usePricingVariant();
  return (
    <div className="mb-4 rounded-[var(--radius-md)] border border-[var(--color-primary-focus)]/20 bg-[rgba(0,113,227,0.06)] px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <i className="ph ph-lock-key text-[var(--color-primary-focus)]" />
          {!auth.loggedIn ? (
            <span>{variant === "B" ? t("lockedHintUnsignedB") : t("lockedHintUnsigned", { limit: DAILY_VIEW_LIMIT })}</span>
          ) : (
            <span>{variant === "B" ? t("lockedHintExhaustedB") : t("lockedHintExhausted", { limit: DAILY_VIEW_LIMIT })}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!auth.loggedIn ? (
            <button
              type="button"
              onClick={onLogin}
              className="rounded-full bg-[var(--color-primary-focus)] px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[var(--color-primary)]"
            >
              {t("loginCta")}
            </button>
          ) : (
            <button
              type="button"
              onClick={variant === "B" ? onLogin : onBuy}
              disabled={unlocking}
              className="rounded-full bg-[var(--color-primary-focus)] px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:opacity-50"
            >
              {unlocking ? <span className="spinner" /> : variant === "B" ? t("buyCtaB") : t("buyCta")}
            </button>
          )}
        </div>
      </div>
      {error && (
        <div className="mt-2 text-xs text-[var(--color-red)]">
          <i className="ph ph-warning-circle" /> {error}
        </div>
      )}
    </div>
  );
}
