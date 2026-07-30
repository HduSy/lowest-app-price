// SEO 工具：canonical / hreflang 统一构造
//
// 全站 canonical、hreflang、sitemap、robots 一律使用固定 SITE_ORIGIN，
// 避免 workers.dev 与自定义域名并存时 host 漂移导致信号分裂。
//
// 多区域多语种模型：
// - URL 形如 /<country>/...，country 为 40 个 App Store 区域之一
// - 每个国家页面的默认渲染语种由 URL 国家段决定（见 src/i18n/request.ts）
// - hreflang 编码 = <语种>-<国家大写>，如 de-DE / en-US / ja-JP / zh-HK
// - x-default 指向 /us/...（英文兜底）

import { REGIONS } from "@/lib/regions";

export const SITE_ORIGIN = "https://lowestappprice.com";

// 每个国家 code -> hreflang locale（语种-区域）。
// 语种取该国家在 URL 下默认渲染的语种（与 src/lib/languages.ts 的 languageForCountry 对齐），
// 区域取国家 code 大写。Google 接受 ISO 639-1 + ISO 3166-1 alpha-2。
//
// 注意：hk/tw 当前默认渲染 zh-CN（简体），hreflang 用 zh-HK/zh-TW 标识"该区域的中文版本"；
// 简繁内容差异留待后续 i18n 精修（不影响 hreflang 信号正确性）。
const COUNTRY_HREFLANG: Record<string, string> = {
  // 美洲
  us: "en-US", ca: "en-CA", br: "pt-BR", mx: "es-MX", ar: "es-AR", cl: "es-CL", co: "es-CO",
  // 欧洲
  gb: "en-GB", de: "de-DE", fr: "fr-FR", tr: "tr-TR", no: "en-NO", ch: "de-CH", dk: "en-DK", il: "en-IL",
  es: "es-ES", it: "it-IT", nl: "nl-NL", pl: "pl-PL", ru: "ru-RU",
  // 中东 + 非洲
  ae: "ar-AE", sa: "ar-SA", ng: "en-NG", za: "en-ZA", eg: "ar-EG",
  // 亚太
  jp: "ja-JP", kr: "ko-KR", cn: "zh-CN", hk: "zh-HK", tw: "zh-TW",
  in: "hi-IN", id: "id-ID", th: "th-TH", vn: "vi-VN",
  ph: "en-PH", my: "en-MY", sg: "en-SG", pk: "en-PK", kz: "ru-KZ",
  // 大洋洲
  au: "en-AU",
};

export function hreflangForCountry(code: string): string {
  return COUNTRY_HREFLANG[code.toLowerCase()] ?? "en-US";
}

/**
 * 国家前缀页面的绝对 URL。
 * @param country 国家 code
 * @param pathAfterCountry 以 "/" 开头的路径（如 "/apps"、"/apps/123"），首页传 ""
 */
export function countryUrl(country: string, pathAfterCountry = ""): string {
  return `${SITE_ORIGIN}/${country}${pathAfterCountry}`;
}

/**
 * 全部国家 + x-default 的 hreflang -> URL 映射（用于 sitemap 的 alternates.languages）。
 * 同一路径下所有国家页共享同一份映射，每个 URL 都含全部 40 国 + x-default。
 *
 * @param pathAfterCountry 以 "/" 开头的路径（如 "/apps"、"/apps/123"），首页传 ""
 */
export function countryHreflangMap(pathAfterCountry = ""): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const r of REGIONS) {
    languages[hreflangForCountry(r.code)] = countryUrl(r.code, pathAfterCountry);
  }
  // x-default 指向英文兜底（/us/...）
  languages["x-default"] = countryUrl("us", pathAfterCountry);
  return languages;
}

/**
 * 国家前缀页面的 alternates（canonical + 全部国家 hreflang + x-default）。
 * 用于 generateMetadata 的 alternates 字段，Next 会同时产出
 * <link rel="canonical"> 与若干 <link rel="alternate" hreflang="...">。
 *
 * @param country 当前页面所在国家 code
 * @param pathAfterCountry 以 "/" 开头的路径（如 "/apps"、"/apps/123"），首页传 ""
 */
export function countryAlternates(country: string, pathAfterCountry = "") {
  return {
    canonical: countryUrl(country, pathAfterCountry),
    languages: countryHreflangMap(pathAfterCountry),
  };
}

/**
 * 根级静态页面（/about /privacy 等，无 country 前缀）的 alternates。
 * 这些页面是单 canonical URL（按 cookie 渲染语种，Googlebot 见英文），
 * 只设自指 canonical，不发 hreflang（多语种版本未拆分 URL）。
 *
 * @param path 以 "/" 开头的完整路径，如 "/about"
 */
export function staticAlternates(path: string) {
  return {
    canonical: `${SITE_ORIGIN}${path}`,
  };
}
