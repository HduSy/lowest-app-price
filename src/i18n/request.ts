import { getRequestConfig } from "next-intl/server";
import { headers } from "next/headers";
import { languageForCountry, LANGUAGES, type Language } from "@/lib/languages";
import { readCookie } from "@/lib/cookie";

// 与 src/lib/languages.ts 的 LANGUAGES 保持同步（单一数据源）
export const locales = LANGUAGES.map((l) => l.code) as readonly Language[];
export type Locale = Language;
export const defaultLocale: Locale = "en";

/**
 * 从请求上下文解析当前 locale。
 * 优先级：cookie(language) > URL 国家段映射 > IP 国家映射（仅静态页兜底） > defaultLocale(en)
 *
 * 关键 SEO 决策：country 前缀页面的默认语种跟随 **URL 国家段**（x-url-country），
 * 而非 IP 国家。这样 Googlebot（US IP、无 cookie）抓 /de/ 时见到德语、/jp/ 时见到日语，
 * 40 个国家页各自有差异化语种内容，避免同质化重复。用户仍可通过 cookie(language) 覆盖。
 * 静态页（/about 等，无 country 前缀）没有 URL 国家段，回退到 IP 国家映射，保持既有体验。
 *
 * 在 edge runtime / Cloudflare Workers 上跑：只读 headers + import messages，
 * 不用 fs / path，跟 OpenNext 完全兼容。
 */
export async function resolveLocale(): Promise<Locale> {
  // 1. 用户手动切换的语种（client 端 setLanguage 时写入此 cookie）
  const h = await headers();
  const cookieHeader = h.get("cookie") || "";
  const cookieLang = readCookie(cookieHeader, "language");
  if (cookieLang && locales.includes(cookieLang as Locale)) {
    return cookieLang as Locale;
  }

  // 2. URL 国家段（middleware 在 country 前缀路由上注入 x-url-country）
  //    决定 country 前缀页面的默认渲染语种——SEO 关键，让 /de/ 出德语、/jp/ 出日语
  const urlCountry = h.get("x-url-country");
  if (urlCountry) {
    const lang = languageForCountry(urlCountry);
    if (locales.includes(lang as Locale)) return lang as Locale;
  }

  // 3. IP 检测到的国家 -> 默认语种（仅静态页 / API 等无 country 前缀路径兜底）
  const detectedCountry = h.get("x-detected-country");
  if (detectedCountry) {
    const lang = languageForCountry(detectedCountry);
    if (locales.includes(lang as Locale)) return lang as Locale;
  }

  // 4. 最终兜底
  return defaultLocale;
}

/** 加载指定 locale 的 messages（供 API route 等非组件上下文复用） */
export async function loadMessages(locale: Locale) {
  return (await import(`../../messages/${locale}.json`)).default;
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  return {
    locale,
    messages: await loadMessages(locale),
  };
});
