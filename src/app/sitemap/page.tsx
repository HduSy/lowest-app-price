import Link from "next/link";

export const metadata = {
  title: "网站地图 - App Store 全区比价",
  description: "App Store 全区比价的所有页面索引。",
};

export default function SitemapPage() {
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
          网站地图
        </h1>

        <div className="space-y-10 text-sm">
          <div>
            <h2 className="mb-4 text-lg font-semibold text-[var(--color-ink)]">
              主要页面
            </h2>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/"
                  className="flex items-center gap-2 text-[var(--color-primary-focus)] hover:underline"
                >
                  <i className="ph ph-house" /> 首页
                </Link>
              </li>
              <li>
                <Link
                  href="/apps"
                  className="flex items-center gap-2 text-[var(--color-primary-focus)] hover:underline"
                >
                  <i className="ph ph-grid-four" /> 全部应用
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="mb-4 text-lg font-semibold text-[var(--color-ink)]">
              法律与政策
            </h2>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/privacy"
                  className="flex items-center gap-2 text-[var(--color-primary-focus)] hover:underline"
                >
                  <i className="ph ph-shield-check" /> 隐私政策
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="flex items-center gap-2 text-[var(--color-primary-focus)] hover:underline"
                >
                  <i className="ph ph-file-text" /> 使用条款
                </Link>
              </li>
              <li>
                <Link
                  href="/refunds"
                  className="flex items-center gap-2 text-[var(--color-primary-focus)] hover:underline"
                >
                  <i className="ph ph-credit-card" /> 退款政策
                </Link>
              </li>
              <li>
                <Link
                  href="/legal"
                  className="flex items-center gap-2 text-[var(--color-primary-focus)] hover:underline"
                >
                  <i className="ph ph-scale" /> 法律声明
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="mb-4 text-lg font-semibold text-[var(--color-ink)]">
              搜索引擎
            </h2>
            <ul className="space-y-2">
              <li>
                <a
                  href="/sitemap.xml"
                  className="flex items-center gap-2 text-[var(--color-primary-focus)] hover:underline"
                >
                  <i className="ph ph-file-sitemap" /> XML Sitemap（搜索引擎用）
                </a>
              </li>
              <li>
                <a
                  href="/robots.txt"
                  className="flex items-center gap-2 text-[var(--color-primary-focus)] hover:underline"
                >
                  <i className="ph ph-robot" /> robots.txt
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
