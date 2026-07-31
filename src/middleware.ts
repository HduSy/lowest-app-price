import { NextResponse, type NextRequest } from "next/server";
import { REGIONS, REGION_MAP } from "@/lib/regions";

// 支持的国家 code 白名单（用于路由校验）
const VALID_CODES = new Set(REGIONS.map((r) => r.code));

// 不走 country 前缀的路径
const EXEMPT_PREFIXES = [
  "/api",
  "/_next",
  "/favicon",
  "/icons",
  "/assets",
  // Next.js 元数据路由（icon / apple-icon / opengraph-image / twitter-image）
  // 位于 app 根目录，不应被 country 前缀重定向
  "/icon",
  "/apple-icon",
  "/opengraph-image",
  "/twitter-image",
  // 静态 OG image（public/og.png，由 scripts/generate-og.mjs 预渲染）：
  // 爬虫直接请求 /og.png，必须放行，否则被 301 重定向到 /<country>/og.png → 404
  "/og.png",
  // AI SEO 机器可读文件 + 爬虫协议
  "/robots",
  "/sitemap",
  "/llms",
  "/pricing",
  // 法律与政策页面（位于 app 根目录，不带 country 前缀）
  "/privacy",
  "/terms",
  "/refunds",
  "/legal",
  // 关于我们页面（位于 app 根目录，不带 country 前缀）
  "/about",
];

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 天

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. 豁免：API / 静态资源直接放行
  if (EXEMPT_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // 2. IP 检测到的真实国家 + 时区（事实，不随 URL / 用户切换变化）
  //    国家来源优先级：req.cf.country > CF-IPCountry 请求头 > detected_country cookie
  //    时区来源优先级：req.cf.timezone > detected_timezone cookie
  //    - req.cf 在 OpenNext 上不一定能传到 Next 中间件；
  //    - CF-IPCountry 是 Cloudflare 边缘始终注入的请求头，生产环境最可靠；
  //    - cookie 由客户端补检（ipapi.co）后回写，用于本地 dev / 非 CF 部署。
  //    - 时区用于"上次更新"等时间字段的本地化展示；多时区国家（美/俄/加）也能精确到时区。
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

  // 3. 拆路径首段
  const segments = pathname.split("/").filter(Boolean);
  const firstSeg = segments[0];
  const firstIsCountry = firstSeg && VALID_CODES.has(firstSeg);

  // 4. 非 country 前缀：永久重定向到 /<detectedCountry>/...
  //    用 301（而非 307）：这是一条稳定的规范化路由，Google 会把根路径的链接权重
  //    传递到目标国家页。geo 维度由 cookie 兜底，不影响爬虫判定。
  //    注：301 对 GET 语义等价于 308，且兼容性更好（部分旧爬虫不认 308）。
  if (!firstIsCountry) {
    const rest = segments.length ? "/" + segments.join("/") : "";
    const url = req.nextUrl.clone();
    url.pathname = `/${detectedCountry}${rest}`;
    const res = NextResponse.redirect(url, 301);
    res.cookies.set("detected_country", detectedCountry, {
      maxAge: COOKIE_MAX_AGE,
      path: "/",
      sameSite: "lax",
    });
    return res;
  }

  // 5. 已是 /<country>/...：放行
  //    注入两类请求头供 SSR 读取：
  //    - x-detected-country：IP 真实国家（事实，用于 hero "你在 X" / 默认币种等个性化）
  //    - x-url-country：URL 国家段（页面归属，用于决定默认渲染语种，SEO 关键）
  //    两者分离：用户可手动切到别的区看价，但页面语种跟随 URL 而非 IP，
  //    让 Googlebot 在 /de/ 上见到德语、/jp/ 上见到日语，避免 40 个国家页同质化为英文。
  //    持久化到 cookie：下次请求由 middleware 读取，作为客户端补检结果的回传通道
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-detected-country", detectedCountry);
  requestHeaders.set("x-url-country", firstSeg);
  requestHeaders.set("x-geo-source", geoSource);
  if (detectedTimezone) {
    requestHeaders.set("x-detected-timezone", detectedTimezone);
  }
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

export const config = {
  // 匹配所有路径，middleware 内部决定是否豁免
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

// 供其他模块复用
export { REGION_MAP };
