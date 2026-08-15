// 语种定义 + 国家->语种映射
// header 里"国旗 + 语种"合并下拉：每个语种绑定一个代表国家国旗

import { REGIONS } from "./regions";

export type Language =
  | "en"
  | "zh-CN"
  | "de"
  | "ja"
  | "ko"
  | "fr"
  | "tr"
  | "pt-BR"
  | "es"
  | "id"
  | "th"
  | "vi"
  | "ru"
  | "ar"
  | "it"
  | "hi"
  | "nl"
  | "pl";

export interface LanguageOption {
  code: Language;
  /** 代表国家 code（用于 Flag 组件渲染国旗） */
  flag: string;
  /** 语种自文名称 */
  label: string;
}

export const LANGUAGES: LanguageOption[] = [
  { code: "en", flag: "us", label: "English" },
  { code: "zh-CN", flag: "cn", label: "中文" },
  { code: "de", flag: "de", label: "Deutsch" },
  { code: "ja", flag: "jp", label: "日本語" },
  { code: "ko", flag: "kr", label: "한국어" },
  { code: "fr", flag: "fr", label: "Français" },
  { code: "tr", flag: "tr", label: "Türkçe" },
  { code: "pt-BR", flag: "br", label: "Português" },
  { code: "es", flag: "mx", label: "Español" },
  { code: "id", flag: "id", label: "Bahasa Indonesia" },
  { code: "th", flag: "th", label: "ไทย" },
  { code: "vi", flag: "vn", label: "Tiếng Việt" },
  { code: "ru", flag: "kz", label: "Русский" },
  { code: "ar", flag: "sa", label: "العربية" },
  { code: "it", flag: "it", label: "Italiano" },
  { code: "hi", flag: "in", label: "हिंदी" },
  { code: "nl", flag: "nl", label: "Nederlands" },
  { code: "pl", flag: "pl", label: "Polski" },
];

const LANGUAGE_MAP: Record<string, LanguageOption> = Object.fromEntries(
  LANGUAGES.map((l) => [l.code, l]),
);

// 国家 code -> 默认语种（IP 检测国家决定默认语种）
const COUNTRY_LANGUAGE: Record<string, Language> = {
  // English
  us: "en", ca: "en", gb: "en", au: "en", ng: "en", za: "en", sg: "en", ph: "en", in: "en",
  // Chinese
  cn: "zh-CN", hk: "zh-CN", tw: "zh-CN",
  // German
  de: "de", ch: "de",
  // Japanese / Korean / French / Turkish
  jp: "ja", kr: "ko", fr: "fr", tr: "tr",
  // Portuguese
  br: "pt-BR",
  // Spanish
  mx: "es", ar: "es", cl: "es", co: "es", es: "es",
  // Italian / Dutch / Polish / Russian
  it: "it", nl: "nl", pl: "pl", ru: "ru", kz: "ru",
  // Southeast Asia
  id: "id", th: "th", vn: "vi",
  // Arabic
  ae: "ar", sa: "ar", eg: "ar",
  // Nordic / 其他 -> English 兜底
  no: "en", dk: "en", il: "en", my: "en", pk: "en",
};

/** 根据国家 code 拿默认语种 */
export function languageForCountry(code: string): Language {
  return COUNTRY_LANGUAGE[code.toLowerCase()] ?? "en";
}

/** 根据语种 code 拿选项（含国旗 + 标签）；入参放宽为 string（URL 段直传场景），未命中回退英文 */
export function languageOption(code: string): LanguageOption {
  return LANGUAGE_MAP[code] ?? LANGUAGES[0];
}

// ============ URL locale 路由派生（40 国 URL -> 18 语言 URL 迁移） ============

/** 全部 locale code（URL 语言段白名单），与 LANGUAGES 同源 */
export const LOCALE_CODES: readonly string[] = LANGUAGES.map((l) => l.code);

// 小写 -> 规范 locale（URL 段大小写不敏感匹配用，如 /zh-cn/ -> zh-CN）
const LOCALE_LOWER_MAP: Record<string, Language> = Object.fromEntries(
  LANGUAGES.map((l) => [l.code.toLowerCase(), l.code])
);

/** URL 首段 -> 规范 locale code；非法段返回 null（大小写不敏感） */
export function normalizeLocaleSegment(seg: string): Language | null {
  return LOCALE_LOWER_MAP[seg.toLowerCase()] ?? null;
}

/**
 * 老 /<country>/ URL -> locale 的 301 重定向表（迁移固化，middleware 永久保留）。
 * 从 REGIONS + COUNTRY_LANGUAGE 派生，不手写，避免两处数据漂移：
 * - 国家码恰为 locale code 的 10 国（de/es/fr/it/nl/pl/ru/th/tr/id）不在此表，
 *   它们的 URL 一字不变，直接被 locale 路由接管；
 * - 特例 ar（阿根廷）：老国家码与阿拉伯语 locale 同码，locale 匹配优先，
 *   老 /ar/ 链接落到阿拉伯语页（西语信号由 hreflang 集群归并到 /es/）。
 */
export const LEGACY_COUNTRY_REDIRECT: Readonly<Record<string, Language>> =
  Object.fromEntries(
    REGIONS.filter((r) => !LOCALE_CODES.includes(r.code)).map((r) => [
      r.code,
      languageForCountry(r.code),
    ])
  );
