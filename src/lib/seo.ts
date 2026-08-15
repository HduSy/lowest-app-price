// SEO 工具：canonical / hreflang 统一构造
//
// 全站 canonical、hreflang、sitemap、robots 一律使用固定 SITE_ORIGIN，
// 避免 workers.dev 与自定义域名并存时 host 漂移导致信号分裂。
//
// 多语种模型（自 /<country>/ 40 国迁移为 /<locale>/ 18 语言）：
// - URL 形如 /<locale>/...，locale 为 18 个语言码之一（en / de / zh-CN / pt-BR ...）
// - 每语言恰好一个 URL，canonical 自指；hreflang 18 条（每 locale 唯一）+ x-default -> /en/
// - 老 /<country>/ URL 由 middleware 301 到对应语言 URL（映射表见 languages.ts）
// - 40 个 App Store 定价区仍是数据维度（regions 表 / 比价表），与 URL 无关

import { LANGUAGES } from "@/lib/languages";

export const SITE_ORIGIN = "https://lowestappprice.com";

/**
 * 语言前缀页面的绝对 URL。
 * @param locale 语言 code（如 "en" / "zh-CN"）
 * @param pathAfterLocale 以 "/" 开头的路径（如 "/apps"、"/apps/123"），首页传 ""
 */
export function localeUrl(locale: string, pathAfterLocale = ""): string {
  return `${SITE_ORIGIN}/${locale}${pathAfterLocale}`;
}

/**
 * 全部语言 + x-default 的 hreflang -> URL 映射。
 * 同一路径下所有语言页共享同一份映射；hreflang 值直接用 locale code
 * （均为合法 BCP47：en / de / zh-CN / pt-BR / ar ...）。
 *
 * @param pathAfterLocale 以 "/" 开头的路径（如 "/apps"、"/apps/123"），首页传 ""
 */
export function localeHreflangMap(pathAfterLocale = ""): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const l of LANGUAGES) {
    languages[l.code] = localeUrl(l.code, pathAfterLocale);
  }
  // x-default 指向英文兜底（/en/...）
  languages["x-default"] = localeUrl("en", pathAfterLocale);
  return languages;
}

/**
 * 语言前缀页面的 alternates（canonical + 18 语言 hreflang + x-default）。
 * 用于 generateMetadata 的 alternates 字段，Next 会同时产出
 * <link rel="canonical"> 与若干 <link rel="alternate" hreflang="...">。
 * 每语言 URL 唯一，自指 canonical 此时是正确且被 Google 采信的信号。
 *
 * @param locale 当前页面语言 code
 * @param pathAfterLocale 以 "/" 开头的路径（如 "/apps"、"/apps/123"），首页传 ""
 */
export function localeAlternates(locale: string, pathAfterLocale = "") {
  return {
    canonical: localeUrl(locale, pathAfterLocale),
    languages: localeHreflangMap(pathAfterLocale),
  };
}

/**
 * 根级静态页面（/about /privacy 等，无 locale 前缀）的 alternates。
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
