import Link from "next/link";

export const metadata = {
  title: "法律声明 - App Store 全区比价",
  description: "App Store 全区比价的法律声明与免责条款。",
};

export default function LegalPage() {
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
          法律声明
        </h1>

        <div className="space-y-6 text-sm leading-relaxed text-[var(--color-ink-80)]">
          <p>最后更新：{new Date().toLocaleDateString("zh-CN")}</p>

          <h2 className="mt-8 text-xl font-semibold text-[var(--color-ink)]">
            商标声明
          </h2>
          <p>
            Apple、App Store 及 Apple 标志是 Apple Inc.
            在美国和其他国家/地区注册的商标。本服务与 Apple Inc.
            没有任何附属、赞助或授权关系。所有对 Apple
            商标的引用仅用于描述性、指示性目的。
          </p>

          <h2 className="mt-8 text-xl font-semibold text-[var(--color-ink)]">
            数据来源
          </h2>
          <p>
            本服务展示的所有价格数据均来自公开可访问的 App Store
            页面与官方查询接口。数据按实时汇率换算，仅供参考——不构成任何购买建议。
          </p>

          <h2 className="mt-8 text-xl font-semibold text-[var(--color-ink)]">
            责任限制
          </h2>
          <p>
            本服务按「现状」提供，不作任何明示或暗示的保证。在法律允许的最大范围内，我们不对以下情形承担责任：
          </p>
          <ul className="ml-5 list-disc space-y-2">
            <li>价格数据的准确性、完整性或时效性</li>
            <li>因使用或无法使用本服务而产生的任何直接或间接损失</li>
            <li>因汇率波动导致的实际购买价格差异</li>
            <li>第三方链接或服务的内容与可用性</li>
          </ul>

          <h2 className="mt-8 text-xl font-semibold text-[var(--color-ink)]">
            适用法律
          </h2>
          <p>
            本声明及本服务的使用受相关适用法律管辖。如本声明的任何条款被认定为无效，其余条款仍具有完全效力。
          </p>

          <h2 className="mt-8 text-xl font-semibold text-[var(--color-ink)]">
            相关文件
          </h2>
          <ul className="ml-5 list-disc space-y-2">
            <li>
              <Link href="/privacy" className="text-[var(--color-primary-focus)] hover:underline">
                隐私政策
              </Link>
            </li>
            <li>
              <Link href="/terms" className="text-[var(--color-primary-focus)] hover:underline">
                使用条款
              </Link>
            </li>
            <li>
              <Link href="/refunds" className="text-[var(--color-primary-focus)] hover:underline">
                退款政策
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
