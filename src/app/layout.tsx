import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Nav } from "@/components/Nav";
import { AppStoreProvider } from "@/lib/app-store";
import { LogoMark } from "@/components/Logo";
import { auth } from "@/lib/auth";
import { getEntitlement } from "@/lib/entitlement";
import { getPricingVariant } from "@/lib/pricing-variant";
import { currencyForCountry, REGION_MAP } from "@/lib/regions";
import { languageForCountry, LANGUAGES, type Language } from "@/lib/languages";
import { readCookie } from "@/lib/cookie";
import "@phosphor-icons/web/regular";
import "@phosphor-icons/web/bold";
import "@phosphor-icons/web/fill";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Layout");
  const title = t("siteName");
  const description = t("metadataDescription");
  return {
    metadataBase: new URL("https://lowestappprice.com"),
    title,
    description,
    openGraph: {
      type: "website",
      title,
      description,
      siteName: title,
      // 静态 /og.png（由 scripts/generate-og.mjs 在 prebuild 阶段生成）：
      // 带扩展名、无查询串、无 RSC vary headers，规避 X/Twitter 爬虫对动态
      // /opengraph-image route（extensionless + ?hash）的静默降级。
      images: [
        {
          url: "/og.png",
          width: 1200,
          height: 630,
          alt: title,
          type: "image/png",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/og.png"],
    },
    verification: {
      google: "4eHrYT06sGUQh9eFprtemeIVvxpskEeZMX9DfTvlMS0",
    },
  };
}

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
  // defaultCurrency 优先级：cookie(currency) > IP 检测国家映射
  // cookie 由用户在 header 切换币种时写入，SSR 直接读到，跳过 IP 检测，无闪烁
  const cookieHeader = h.get("cookie") || "";
  const cookieCurrency = readCookie(cookieHeader, "currency");
  const defaultCurrency = cookieCurrency || currencyForCountry(detectedCountry);
  // defaultLanguage 优先级：cookie(language) > IP 检测国家映射
  // 跟 i18n/request.ts 的 resolveLocale 保持一致，避免 client store 跟 SSR locale 不一致
  const cookieLang = readCookie(cookieHeader, "language");
  const validLangCodes = LANGUAGES.map((l) => l.code);
  const defaultLanguage: Language =
    cookieLang && (validLangCodes as string[]).includes(cookieLang)
      ? (cookieLang as Language)
      : languageForCountry(detectedCountry);
  // 是否由 Cloudflare 边缘 req.cf 检测到；fallback 时客户端会补检
  const geoSource = h.get("x-geo-source") === "cf" ? "cf" : "fallback";

  // next-intl locale（从 cookie 读用户偏好，兜底走 IP 检测国家映射）
  const locale = await getLocale();
  const t = await getTranslations("Layout");

  // 定价 A/B 实验开关（SSR 读 env，注入 AppStoreProvider 供 client 用）
  const pricingVariant = await getPricingVariant();
  // 当前登录用户（Auth.js session，无则 null）
  // try/catch：auth() 在 AUTH_SECRET 缺失或 JWT 验证失败时可能抛错，不阻塞页面渲染
  let user: { id: string; name: string | null; image: string | null; email: string | null; paid: boolean; member: boolean } | null = null;
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
        member: ent.member,
      };
    }
  } catch (e) {
    console.error("[layout] auth() failed:", e);
  }

  return (
    <html lang={locale}>
      <head>
        {/* VibeLoft Web Telemetry：全局遥测脚本，每页加载一次。
            浏览器只加载 https://vibeloft.ai/telemetry/v1.js，
            向 https://api.vibeloft.ai/api/v1/telemetry/events 发送事件。
            项目暂未设 CSP，无需额外放行。auth key 仅存于此 data 属性，勿 log 到他处。 */}
        <script
          defer
          src="https://vibeloft.ai/telemetry/v1.js"
          data-vl-product-id="e070397a-76ca-43d1-a1d4-7adeaa121d76"
          data-vl-auth-key="vl_web.8N-tcXjpTEsIekIJB24TqMlEC575Fx0kune_NMqjacc"
        />
      </head>
      <body className="flex min-h-screen flex-col">
        <NextIntlClientProvider>
          <AppStoreProvider defaultCurrency={defaultCurrency} defaultLanguage={defaultLanguage} geoSource={geoSource} pricingVariant={pricingVariant}>
          <Nav user={user} />
          <main className="flex-1">{children}</main>
          <footer className="bg-[var(--color-parchment)] py-10">
            <div className="mx-auto max-w-[980px] px-[22px] text-center">
              <div className="mb-3 flex items-center justify-center gap-2 font-semibold">
                <LogoMark size={20} />
                <span>{t("siteName")}</span>
              </div>
              <p className="mx-auto mb-6 max-w-[60ch] text-xs leading-relaxed text-[var(--color-ink-48)]">
                {t("footerDisclaimer")}
              </p>
              <div className="mx-auto mb-3 max-w-[720px] border-t border-black/[0.08] pt-5">
                <p className="text-xs text-[var(--color-ink-48)]">
                  {t("footerCopyright", { year: new Date().getFullYear() })}
                </p>
                <nav
                  className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-[var(--color-ink-48)]"
                  aria-label={t("footerLinks")}
                >
                  <Link href="/about" className="transition-colors hover:text-[var(--color-ink)]">
                    {t("about")}
                  </Link>
                  <span className="text-black/15">|</span>
                  <Link href="/privacy" className="transition-colors hover:text-[var(--color-ink)]">
                    {t("privacy")}
                  </Link>
                  <span className="text-black/15">|</span>
                  <Link href="/terms" className="transition-colors hover:text-[var(--color-ink)]">
                    {t("terms")}
                  </Link>
                  <span className="text-black/15">|</span>
                  <Link href="/refunds" className="transition-colors hover:text-[var(--color-ink)]">
                    {t("refunds")}
                  </Link>
                  <span className="text-black/15">|</span>
                  <Link href="/legal" className="transition-colors hover:text-[var(--color-ink)]">
                    {t("legal")}
                  </Link>
                  <span className="text-black/15">|</span>
                  <Link href="/sitemap" className="transition-colors hover:text-[var(--color-ink)]">
                    {t("sitemap")}
                  </Link>
                </nav>
              </div>
            </div>
          </footer>
        </AppStoreProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
