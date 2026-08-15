import { NextResponse, type NextRequest } from "next/server";
import { REGIONS, REGION_MAP } from "@/lib/regions";
import {
  LEGACY_COUNTRY_REDIRECT,
  languageForCountry,
  normalizeLocaleSegment,
} from "@/lib/languages";

// IP 检测国家的合法域（App Store 定价区，数据维度，与 URL 无关）
const VALID_CODES = new Set(REGIONS.map((r) => r.code));

// 不走 locale 前缀的路径
const EXEMPT_PREFIXES = [
  "/api",
  "/_next",
  "/favicon",
  "/icons",
  "/assets",
  // Next.js 元数据路由（icon / apple-icon / opengraph-image / twitter-image）
  // 位于 app 根目录，不应被 locale 前缀重定向
  "/icon",
  "/apple-icon",
  "/opengraph-image",
  "/twitter-image",
  // 静态 OG image（public/og.png，由 scripts/generate-og.mjs 预渲染）：
  // 爬虫直接请求 /og.png，必须放行，否则被 301 重定向到 /<locale>/og.png → 404
  "/og.png",
  // AI SEO 机器可读文件 + 爬虫协议
  "/robots",
  "/sitemap",
  "/llms",
  "/pricing",
  // 法律与政策页面（位于 app 根目录，不带 locale 前缀）
  "/privacy",
  "/terms",
  "/refunds",
  "/legal",
  // 关于我们页面（位于 app 根目录，不带 locale 前缀）
  "/about",
];

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 天

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. 豁免：API / 静态资源直接放行
  //    静态图片文件（public/ 下的 png/jpg/avif 等）也直接放行，
  //    否则 /insights/foo.png 会被重定向到 /<locale>/insights/foo.png，
  //    匹配 [locale]/insights/[slug] 路由后因 slug 无效返回 404。
  if (
    EXEMPT_PREFIXES.some((p) => pathname.startsWith(p)) ||
    /\.(?:png|jpe?g|gif|webp|avif|svg|ico|bmp|tiff)$/i.test(pathname)
  ) {
    return NextResponse.next();
  }

  // 2. IP 检测到的真实国家 + 时区（事实，不随 URL / 用户切换变化）
  //    国家来源优先级：req.cf.country > CF-IPCountry 请求头 > detected_country cookie
  //    时区来源优先级：req.cf.timezone > detected_timezone cookie
  //    - req.cf 在 OpenNext 上不一定能传到 Next 中间件；
  //    - CF-IPCountry 是 Cloudflare 边缘始终注入的请求头，生产环境最可靠；
  //    - cookie 由客户端补检（ipapi.co）后回写，用于本地 dev / 非 CF 部署。
  //    - 时区用于"上次更新"等时间字段的本地化展示；多时区国家（美/俄/加）也能精确到时区。
  //    注意：IP 国家仅用于默认币种 / hero 个性化 / 详情页优先刷新区，
  //    不再进 URL（URL 只承载 18 个语言码）。
  const cfHeader = req.headers.get("cf-ipcountry");
  const cookieCountry = req.cookies.get("detected_country")?.value;
  const rawCountry =
    (req.cf?.country as string | undefined) || cfHeader || cookieCountry;
  const normCountry = rawCountry?.toLowerCase();
  const detectedCountry =
    normCountry && VALID_CODES.has(normCountry) ? normCountry : "us";
  // 有任一来源给出有效国家 -> "cf"（可信，客户端不再补检）；
  // 否则 -> "fallback"（客户端会通过 ipapi.co 补检并回写 cookie）
  const geoSource =
    normCountry && VALID_CODES.has(normCountry) ? "cf" : "fallback";
  // 时区：优先 req.cf.timezone（CF 边缘基于 IP 库给出，精确到 IANA），
  // 其次读 detected_timezone cookie（客户端补检回写）
  const rawTz =
    (req.cf?.timezone as string | undefined) ||
    req.cookies.get("detected_timezone")?.value;
  const detectedTimezone = rawTz || null;

  // 3. 拆路径首段，三分支路由：
  //    a) 首段 ∈ 18 语言码 -> 放行（大小写不规范则 301 规范化）
  //    b) 首段 ∈ 老国家码（29 国）-> 301 到对应语言 URL（迁移固化，永不移除）
  //    c) 无前缀 / 未知段 -> 307 到 /<IP 检测语言>/...
  const segments = pathname.split("/").filter(Boolean);
  const firstSeg = segments[0] || "";
  const rest = segments.length > 1 ? "/" + segments.slice(1).join("/") : "";

  // ---- a) locale 前缀 ----
  const locale = firstSeg ? normalizeLocaleSegment(firstSeg) : null;
  if (locale) {
    if (firstSeg !== locale) {
      // 大小写规范化（如 /zh-cn/ -> /zh-CN/），301 永久：
      // Next 路由段区分大小写，不规范化会让小写变体掉进分支 c 变成 307 -> 404
      const url = req.nextUrl.clone();
      url.pathname = `/${locale}${rest}`;
      return NextResponse.redirect(url, 301);
    }
    // 放行。注入两类请求头供 SSR 读取：
    // - x-detected-country：IP 真实国家（事实，用于默认币种 / 详情页优先刷新区）
    // - x-url-locale：URL 语言段（页面归属语种，SEO 关键）
    // 两者分离：页面语种跟随 URL，让 Googlebot 在 /de/ 见德语、/zh-CN/ 见中文，
    // 用户仍可用 cookie(language) 覆盖（见 src/i18n/request.ts tier-1）。
    // 持久化到 cookie：下次请求由 middleware 读取，作为客户端补检结果的回传通道
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-detected-country", detectedCountry);
    requestHeaders.set("x-url-locale", firstSeg);
    requestHeaders.set("x-geo-source", geoSource);
    // 无条件注入：spec 要求相关 header 始终存在；消费方用 `|| null` 兜底，空串等价于未检测
    requestHeaders.set("x-detected-timezone", detectedTimezone ?? "");
    const res = NextResponse.next({
      request: { headers: requestHeaders },
    });
    res.cookies.set("detected_country", detectedCountry, {
      maxAge: COOKIE_MAX_AGE,
      path: "/",
      sameSite: "lax",
    });
    if (detectedTimezone) {
      res.cookies.set("detected_timezone", detectedTimezone, {
        maxAge: COOKIE_MAX_AGE,
        path: "/",
        sameSite: "lax",
      });
    }
    return res;
  }

  // ---- b) 老 /<country>/ URL：301 永久重定向到对应语言 URL ----
  // 表由 languages.ts LEGACY_COUNTRY_REDIRECT 派生（29 国，如 us/gb/jp/cn/mx...）；
  // 10 个"国家码=语言码"的国（de/es/fr/it/nl/pl/ru/th/tr/id）URL 本就未变，走分支 a。
  // 301 传递全部链接信号；clone() 自动保留 query string（UTM 等）。
  // 此表是迁移契约的一部分，永久保留，不可删除。
  const legacyTarget = firstSeg ? LEGACY_COUNTRY_REDIRECT[firstSeg] : undefined;
  if (legacyTarget) {
    const url = req.nextUrl.clone();
    url.pathname = `/${legacyTarget}${rest}`;
    return NextResponse.redirect(url, 301);
  }

  // ---- c) 无前缀 / 未知段：临时重定向到 /<detectedLang>/... ----
  // 用 307（临时）：保持方法/Body 语义，不缓存，允许后续 geo 变化时即时调整目标。
  // rest 保留全部原始段（含未知的 firstSeg，如 /apps/123 -> /en/apps/123）。
  const detectedLang = languageForCountry(detectedCountry);
  const url = req.nextUrl.clone();
  url.pathname = `/${detectedLang}${segments.length ? "/" + segments.join("/") : ""}`;
  const res = NextResponse.redirect(url, 307);
  res.cookies.set("detected_country", detectedCountry, {
    maxAge: COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
  });
  return res;
}

export const config = {
  // 匹配所有路径，middleware 内部决定是否豁免
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

// 供其他模块复用
export { REGION_MAP };
