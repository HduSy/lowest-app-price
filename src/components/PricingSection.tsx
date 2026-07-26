"use client";

// 首页定价区：内嵌两档方案，$1.99 档高亮"最划算"
// client 组件：需要调 checkout API + 开 LoginDialog
import { useState } from "react";
import { LoginDialog } from "./LoginDialog";

interface PricingSectionProps {
  loggedIn: boolean;
}

export function PricingSection({ loggedIn }: PricingSectionProps) {
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
      if (!res.ok) throw new Error("创建支付订单失败");
      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "购买失败");
    } finally {
      setBuying(false);
    }
  };

  return (
    <section id="pricing" className="px-[22px] py-20">
      <div className="mx-auto max-w-[980px]">
        <h2 className="mb-3 text-center text-[clamp(28px,4vw,40px)] font-semibold">
          先免费试，值得再买
        </h2>
        <p className="mx-auto mb-10 max-w-[680px] text-center text-[var(--color-ink-80)]">
          登录每天免费看 3 个 App，或 $1.99 一次买断——所有 App、所有订阅档位、所有地区，永久无限看。
        </p>

        <div className="mx-auto grid max-w-[680px] grid-cols-1 gap-4 sm:grid-cols-2">
          {/* 免费方案 */}
          <div className="rounded-[18px] border border-black/[0.08] bg-white p-6">
            <div className="flex items-center gap-2">
              <i className="ph ph-gift text-[20px] text-[var(--color-ink-48)]" />
              <span className="text-sm font-semibold text-[var(--color-ink-48)]">
                免费
              </span>
            </div>
            <div className="mt-3 text-[32px] font-semibold leading-none">
              每天 3 次，免费
            </div>
            <p className="mt-1 text-xs text-[var(--color-ink-48)]">登录就送</p>
            <ul className="mt-5 space-y-2.5 text-sm text-[var(--color-ink-80)]">
              <li className="flex items-center gap-2">
                <i className="ph ph-check-circle text-[16px] text-[var(--color-green)]" />
                所有订阅档位都能看
              </li>
              <li className="flex items-center gap-2">
                <i className="ph ph-check-circle text-[16px] text-[var(--color-green)]" />
                每天 UTC 0 点重置
              </li>
              <li className="flex items-center gap-2">
                <i className="ph ph-check-circle text-[16px] text-[var(--color-green)]" />
                多个 App 共用额度
              </li>
            </ul>
            <button
              type="button"
              onClick={loggedIn ? undefined : () => setLoginOpen(true)}
              disabled={loggedIn}
              className="mt-6 w-full rounded-full border border-black/[0.1] bg-white px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-[var(--color-parchment)] disabled:cursor-default disabled:opacity-60"
            >
              {loggedIn ? "当前方案" : "登录领取"}
            </button>
          </div>

          {/* 付费方案 - 高亮选中（最划算）*/}
          <div className="relative rounded-[18px] border-2 border-[var(--color-primary-focus)] bg-white p-6 shadow-[0_4px_24px_rgba(0,113,227,0.12)]">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--color-primary-focus)] px-3 py-1 text-[11px] font-semibold text-white shadow-sm">
              <i className="ph ph-star mr-1" />
              最划算
            </div>
            <div className="flex items-center gap-2">
              <i className="ph ph-crown text-[20px] text-[var(--color-primary-focus)]" />
              <span className="text-sm font-semibold text-[var(--color-primary-focus)]">
                一次买断
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-[32px] font-semibold leading-none">$1.99</span>
              <span className="text-sm text-[var(--color-ink-48)]">一次，永久</span>
            </div>
            <p className="mt-1 text-xs text-[var(--color-ink-48)]">
              不限 App、不限地区、不限次数
            </p>
            <ul className="mt-5 space-y-2.5 text-sm text-[var(--color-ink-80)]">
              <li className="flex items-center gap-2">
                <i className="ph ph-check-circle text-[16px] text-[var(--color-green)]" />
                永久无限查看
              </li>
              <li className="flex items-center gap-2">
                <i className="ph ph-check-circle text-[16px] text-[var(--color-green)]" />
                所有 App 的所有订阅档位与地区
              </li>
              <li className="flex items-center gap-2">
                <i className="ph ph-check-circle text-[16px] text-[var(--color-green)]" />
                不再受每日额度限制
              </li>
            </ul>
            <button
              type="button"
              onClick={handleBuy}
              disabled={buying}
              className="mt-6 w-full rounded-full bg-[var(--color-primary-focus)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:opacity-50"
            >
              {buying ? (
                <span className="spinner" />
              ) : loggedIn ? (
                "$1.99 买断"
              ) : (
                "登录后购买"
              )}
            </button>
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
