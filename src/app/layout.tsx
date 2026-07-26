import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { AppStoreProvider } from "@/lib/app-store";
import { LogoMark } from "@/components/Logo";
import { auth } from "@/lib/auth";
import { getEntitlement } from "@/lib/entitlement";
import { currencyForCountry, REGION_MAP } from "@/lib/regions";
import { languageForCountry } from "@/lib/languages";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://appstore-lowest-price.alifeiliu.workers.dev"),
  title: "App Store 全区比价 - 哪国最便宜，一目了然",
  description:
    "粘贴 App Store 链接或 App ID，实时抓取 35 个地区的订阅价格，按统一币种换算后从低到高排名。最便宜的区，一眼可见。",
  keywords: [
    "App Store 比价",
    "App Store 全区比价",
    "App Store 不同地区价格",
    "App Store 哪个区最便宜",
    "App Store 订阅价格对比",
    "App Store 内购价格",
    "App Store 换区",
    "App Store price comparison",
    "cheapest App Store region",
  ],
  openGraph: {
    type: "website",
    locale: "zh_CN",
    title: "App Store 全区比价 - 哪国最便宜，一目了然",
    description:
      "粘贴 App Store 链接或 App ID，实时抓取 35 个地区的订阅价格，按统一币种换算后从低到高排名。最便宜的区，一眼可见。",
    siteName: "App Store 全区比价",
  },
  twitter: {
    card: "summary_large_image",
    title: "App Store 全区比价",
    description: "粘贴链接，35 个地区的订阅价格从低到高排开——哪个区最便宜，一秒看见。",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 从 middleware 注入的请求头读取 IP 检测到的真实国家（事实，不随 URL 变化）
  const h = await headers();
  const detectedCountry =
    h.get("x-detected-country") &&
    REGION_MAP[h.get("x-detected-country")!.toLowerCase()]
      ? h.get("x-detected-country")!.toLowerCase()
      : "us";
  const defaultCurrency = currencyForCountry(detectedCountry);
  const defaultLanguage = languageForCountry(detectedCountry);
  // 是否由 Cloudflare 边缘 req.cf 检测到；fallback 时客户端会补检
  const geoSource = h.get("x-geo-source") === "cf" ? "cf" : "fallback";

  // 当前登录用户（Auth.js session，无则 null）
  // try/catch：auth() 在 AUTH_SECRET 缺失或 JWT 验证失败时可能抛错，不阻塞页面渲染
  let user: { id: string; name: string | null; image: string | null; email: string | null; paid: boolean } | null = null;
  try {
    const session = await auth();
    if (session?.user?.id) {
      const ent = await getEntitlement(session.user.id);
      user = {
        id: session.user.id,
        name: session.user.name ?? null,
        image: session.user.image ?? null,
        email: session.user.email ?? null,
        paid: ent.paid,
      };
    }
  } catch (e) {
    console.error("[layout] auth() failed:", e);
  }

  return (
    <html lang="zh-CN">
      <head>
        <script src="https://unpkg.com/@phosphor-icons/web@2.1.1" />
      </head>
      <body className="flex min-h-screen flex-col">
        <AppStoreProvider defaultCurrency={defaultCurrency} defaultLanguage={defaultLanguage} geoSource={geoSource}>
          <Nav user={user} />
          <main className="flex-1">{children}</main>
          <footer className="bg-[var(--color-parchment)] py-10">
            <div className="mx-auto max-w-[980px] px-[22px] text-center">
              <div className="mb-3 flex items-center justify-center gap-2 font-semibold">
                <LogoMark size={20} />
                <span>App Store 全区比价</span>
              </div>
              <p className="mx-auto mb-6 max-w-[60ch] text-xs leading-relaxed text-[var(--color-ink-48)]">
                不附属于 Apple Inc.。价格数据来自公开 App Store，按实时汇率换算，仅供参考——实际购买以
                App Store 当时显示为准，并需遵守 Apple 服务条款与当地法律。
              </p>
              <div className="mx-auto mb-3 max-w-[720px] border-t border-black/[0.08] pt-5">
                <p className="text-xs text-[var(--color-ink-48)]">
                  Copyright © {new Date().getFullYear()} App Store 全区比价. 保留所有权利。
                </p>
                <nav
                  className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-[var(--color-ink-48)]"
                  aria-label="页脚链接"
                >
                  <Link href="/privacy" className="transition-colors hover:text-[var(--color-ink)]">
                    隐私政策
                  </Link>
                  <span className="text-black/15">|</span>
                  <Link href="/terms" className="transition-colors hover:text-[var(--color-ink)]">
                    使用条款
                  </Link>
                  <span className="text-black/15">|</span>
                  <Link href="/refunds" className="transition-colors hover:text-[var(--color-ink)]">
                    退款政策
                  </Link>
                  <span className="text-black/15">|</span>
                  <Link href="/legal" className="transition-colors hover:text-[var(--color-ink)]">
                    法律声明
                  </Link>
                  <span className="text-black/15">|</span>
                  <Link href="/sitemap" className="transition-colors hover:text-[var(--color-ink)]">
                    网站地图
                  </Link>
                </nav>
              </div>
            </div>
          </footer>
        </AppStoreProvider>
      </body>
    </html>
  );
}
