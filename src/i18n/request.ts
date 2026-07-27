import { getRequestConfig } from "next-intl/server";
import { headers } from "next/headers";
import { languageForCountry } from "@/lib/languages";

export const locales = ["en", "zh-CN"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

/**
 * 从请求上下文解析当前 locale。
 * 优先级：cookie(language) > IP 检测国家映射 > defaultLocale(en)
 *
 * 在 edge runtime / Cloudflare Workers 上跑：只读 headers + import messages，
 * 不用 fs / path，跟 OpenNext 完全兼容。
 */
async function resolveLocale(): Promise<Locale> {
  // 1. 用户手动切换的语种（client 端 setLanguage 时写入此 cookie）
  const h = await headers();
  const cookieHeader = h.get("cookie") || "";
  const match = cookieHeader.match(/(?:^|;\s*)language=([^;]+)/);
  if (match) {
    const val = decodeURIComponent(match[1]);
    if (locales.includes(val as Locale)) return val as Locale;
  }

  // 2. IP 检测到的国家 -> 默认语种（middleware 已注入 x-detected-country）
  const detectedCountry = h.get("x-detected-country");
  if (detectedCountry) {
    const lang = languageForCountry(detectedCountry);
    if (locales.includes(lang as Locale)) return lang as Locale;
  }

  // 3. 兜底
  return defaultLocale;
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
