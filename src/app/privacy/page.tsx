import Link from "next/link";

export const metadata = {
  title: "隐私政策 - App Store 全区比价",
  description: "说明我们如何收集、使用和保护您的个人信息。",
};

export default function PrivacyPage() {
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
          隐私政策
        </h1>

        <div className="space-y-6 text-sm leading-relaxed text-[var(--color-ink-80)]">
          <p>最后更新：{new Date().toLocaleDateString("zh-CN")}</p>

          <p>
            App Store
            全区比价（以下简称「本服务」）是一个中立的价格比较工具。我们重视您的隐私，并以透明、负责的方式处理您的信息。
          </p>

          <h2 className="mt-8 text-xl font-semibold text-[var(--color-ink)]">
            我们收集什么信息
          </h2>
          <ul className="ml-5 list-disc space-y-2">
            <li>
              <strong>账户信息</strong>：当您通过 Google 或 X（Twitter）
              登录时，我们仅获取您的邮箱、昵称和头像，用于身份识别和额度管理。
            </li>
            <li>
              <strong>使用日志</strong>：记录您查询过的 App
              列表与查看次数，用于额度统计和服务优化。
            </li>
            <li>
              <strong>技术信息</strong>：自动采集的 IP
              地址、浏览器类型、设备型号，仅用于反滥用和安全防护。
            </li>
          </ul>

          <h2 className="mt-8 text-xl font-semibold text-[var(--color-ink)]">
            我们不做什么
          </h2>
          <ul className="ml-5 list-disc space-y-2">
            <li>不将您的个人信息出售、出租或共享给第三方用于营销</li>
            <li>不追踪您在其他网站上的活动</li>
            <li>不向您发送垃圾邮件或未经请求的推广</li>
          </ul>

          <h2 className="mt-8 text-xl font-semibold text-[var(--color-ink)]">
            Cookie 与本地存储
          </h2>
          <p>
            本服务使用必要的 Cookie
            和本地存储来维持您的登录状态、记住您的币种与地区偏好。不使用追踪型
            Cookie 或第三方广告 Cookie。
          </p>

          <h2 className="mt-8 text-xl font-semibold text-[var(--color-ink)]">
            数据保留与删除
          </h2>
          <p>
            您的账户数据在账户存续期间保留。如需注销账户并删除所有数据，请通过
            GitHub Issues 联系我们——我们会在 7 个工作日内完成处理。
          </p>

          <h2 className="mt-8 text-xl font-semibold text-[var(--color-ink)]">
            数据安全
          </h2>
          <p>
            我们采取合理的技术与组织措施保护您的数据，包括加密传输、访问控制、定期安全审计。但请注意：没有任何互联网传输方式可以保证
            100% 安全。
          </p>

          <h2 className="mt-8 text-xl font-semibold text-[var(--color-ink)]">
            联系我们
          </h2>
          <p>
            如有任何隐私相关问题，请通过 GitHub Issues 联系我们。
          </p>
        </div>
      </div>
    </div>
  );
}
