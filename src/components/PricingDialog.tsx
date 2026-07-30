"use client";

// 买断定价弹窗：A 版专用，配额用完时点锁定档位弹出，展示 $1.99 买断信息 + 购买按钮
// B 版（登录即会员）不会触发此弹窗——PriceTable 中 variant === "B" 时短路掉
// 复用 LoginDialog 的 Modal 模式（createPortal + backdrop + Esc 关闭）
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { usePricingVariant } from "@/lib/app-store";

interface PricingDialogProps {
  open: boolean;
  onClose: () => void;
  onBuy: () => void;
  buying: boolean;
  error: string | null;
}

export function PricingDialog({
  open,
  onClose,
  onBuy,
  buying,
  error,
}: PricingDialogProps) {
  const t = useTranslations("PricingDialog");
  const variant = usePricingVariant();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  // B 版（登录即会员）无买断环节，永不渲染
  if (variant === "B" || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex cursor-pointer items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t("ariaLabel")}
    >
      <div
        className="picker-panel w-[min(400px,calc(100vw-32px))] cursor-default rounded-[18px] bg-white p-7 shadow-[0_12px_48px_rgba(0,0,0,0.18)]"
        style={{ transformOrigin: "center" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <i className="ph ph-crown text-[28px] text-[var(--color-primary-focus)]" />
          <h2 className="mt-2 text-[20px] font-semibold leading-tight">
            {t("title")}
          </h2>
          <p className="mt-1.5 text-[13px] text-[var(--color-ink-48)]">
            {t("subtitle")}
          </p>
        </div>

        <ul className="mt-5 space-y-2.5 text-sm text-[var(--color-ink-80)]">
          <li className="flex items-center gap-2">
            <i className="ph ph-check-circle text-[16px] text-[var(--color-green)]" />
            {t("feature1")}
          </li>
          <li className="flex items-center gap-2">
            <i className="ph ph-check-circle text-[16px] text-[var(--color-green)]" />
            {t("feature2")}
          </li>
          <li className="flex items-center gap-2">
            <i className="ph ph-check-circle text-[16px] text-[var(--color-green)]" />
            {t("feature3")}
          </li>
        </ul>

        <button
          type="button"
          onClick={onBuy}
          disabled={buying}
          className="mt-6 w-full rounded-full bg-[var(--color-primary-focus)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:opacity-50"
        >
          {buying ? <span className="spinner" /> : t("buyCta")}
        </button>

        {error && (
          <div className="mt-3 rounded-[var(--radius-md)] bg-[rgba(255,59,48,0.08)] px-4 py-2.5 text-center text-xs text-[var(--color-red)]">
            <i className="ph ph-warning-circle" /> {error}
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full text-center text-[13px] text-[var(--color-ink-48)] transition-colors hover:text-[var(--color-ink)]"
        >
          {t("later")}
        </button>
      </div>
    </div>,
    document.body
  );
}
