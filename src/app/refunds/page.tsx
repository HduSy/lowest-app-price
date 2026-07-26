import Link from "next/link";

export const metadata = {
  title: "退款政策 - App Store 全区比价",
  description: "关于 App Store 全区比价付费解锁的退款说明。",
};

export default function RefundsPage() {
  return (
    <div className="py-20">
      <div className="mx-auto max-w-[740px] px-[22px]">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-ink-48)] transition-colors hover:text-[var(--color-ink)]"
        >
          <i className="ph ph-caret-left" /> 返回首页
        </Link>
        <h1 className="mb-8 text-[clamp(32px,5vw,48px)] font-semibold leading-tight tracking-tight">
          退款政策
        </h1>

        <div className="space-y-6 text-sm leading-relaxed text-[var(--color-ink-80)]">
          <p>最后更新：{new Date().toLocaleDateString("zh-CN")}</p>

          <p>
            希望您对 App Store
            全区比价的付费服务满意。以下是退款政策。
          </p>

          <h2 className="mt-8 text-xl font-semibold text-[var(--color-ink)]">
            付费内容
          </h2>
          <p>
            本服务提供一次性买断付费，解锁后可无限查看所有地区的所有订阅档位价格。付费通过
            Stripe 安全处理，我们不存储您的银行卡信息。
          </p>

          <h2 className="mt-8 text-xl font-semibold text-[var(--color-ink)]">
            退款条件
          </h2>
          <ul className="ml-5 list-disc space-y-2">
            <li>
              自购买之日起 <strong>7 天内</strong>，如对服务不满意，可申请全额退款
            </li>
            <li>退款将原路退回至您的付款账户，通常需 5–10 个工作日到账</li>
            <li>
              若发现滥用退款政策的行为（如反复购买后退款），我们保留拒绝退款的权利
            </li>
          </ul>

          <h2 className="mt-8 text-xl font-semibold text-[var(--color-ink)]">
            如何申请退款
          </h2>
          <p>
            请通过 GitHub Issues
            联系我们，并提供付款邮箱与交易时间——我们会在 3
            个工作日内回复并处理。
          </p>

          <h2 className="mt-8 text-xl font-semibold text-[var(--color-ink)]">
            注意事项
          </h2>
          <p>
            本退款政策仅适用于本服务的付费解锁功能，与您在 Apple App Store
            上的任何应用购买无关。App Store 的退款请遵循 Apple 官方退款流程。
          </p>
        </div>
      </div>
    </div>
  );
}
