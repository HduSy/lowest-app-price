import Link from "next/link";

export const metadata = {
  title: "使用条款 - App Store 全区比价",
  description: "使用 App Store 全区比价服务的条款与条件。",
};

export default function TermsPage() {
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
          使用条款
        </h1>

        <div className="space-y-6 text-sm leading-relaxed text-[var(--color-ink-80)]">
          <p>最后更新：{new Date().toLocaleDateString("zh-CN")}</p>

          <p>
            欢迎使用 App Store
            全区比价。使用本服务即表示您同意以下条款；若不同意，请勿使用。
          </p>

          <h2 className="mt-8 text-xl font-semibold text-[var(--color-ink)]">
            服务说明
          </h2>
          <p>
            本服务是一个独立的第三方价格比较工具，通过公开渠道抓取 App Store
            各地区的应用内购买与订阅价格，按实时汇率换算后展示。本服务与 Apple
            Inc. 无任何附属、合作或授权关系。
          </p>

          <h2 className="mt-8 text-xl font-semibold text-[var(--color-ink)]">
            价格数据免责
          </h2>
          <ul className="ml-5 list-disc space-y-2">
            <li>所有价格数据仅供参考，可能存在延迟或误差</li>
            <li>实际购买价格以您在 App Store 结算时显示的金额为准</li>
            <li>汇率换算结果为估算值，不代表实际交易汇率</li>
            <li>我们不对因依赖本服务数据而产生的任何损失负责</li>
          </ul>

          <h2 className="mt-8 text-xl font-semibold text-[var(--color-ink)]">
            账户与付费
          </h2>
          <p>
            部分功能需要登录或付费解锁。付费为一次性买断，解锁后可无限查看所有订阅档位价格。退款事宜请参见
            <Link href="/refunds" className="text-[var(--color-primary-focus)] hover:underline">
              退款政策
            </Link>
            。
          </p>
          <p>
            <strong className="text-[var(--color-ink)]">会员权益与登录方式绑定。</strong>
            本服务支持多种第三方登录（Google、GitHub、X/Twitter）。不同登录方式视为独立账号，会员权益（含付费买断、每日免费额度）与购买时使用的登录方式绑定，不跨账号共享。例如：使用 Google 账号购买的会员权益，无法在 X/Twitter 或 GitHub 登录下使用。请妥善记住您的登录方式。
          </p>

          <h2 className="mt-8 text-xl font-semibold text-[var(--color-ink)]">
            合理使用
          </h2>
          <p>您同意不进行以下行为：</p>
          <ul className="ml-5 list-disc space-y-2">
            <li>使用自动化脚本大规模抓取本服务数据</li>
            <li>试图破坏、干扰或绕过本服务的安全机制</li>
            <li>将本服务用于任何非法目的</li>
          </ul>

          <h2 className="mt-8 text-xl font-semibold text-[var(--color-ink)]">
            知识产权
          </h2>
          <p>
            「App Store」及相关商标归 Apple Inc.
            所有。本服务仅在描述性、指示性用途下引用这些名称，不主张任何权利。
          </p>

          <h2 className="mt-8 text-xl font-semibold text-[var(--color-ink)]">
            条款变更
          </h2>
          <p>
            我们可能不时更新本条款。重大变更会在本页面公示——继续使用本服务即视为接受更新后的条款。
          </p>
        </div>
      </div>
    </div>
  );
}
