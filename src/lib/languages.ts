// 语种定义 + 国家->语种映射
// header 里"国旗 + 语种"合并下拉：每个语种绑定一个代表国家国旗

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
  | "ar";

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
  mx: "es", ar: "es", cl: "es", co: "es",
  // Southeast Asia
  id: "id", th: "th", vn: "vi",
  // Russian / Arabic
  kz: "ru", ae: "ar", sa: "ar", eg: "ar",
  // Nordic / 其他 -> English 兜底
  no: "en", dk: "en", il: "en", my: "en", pk: "en",
};

/** 根据国家 code 拿默认语种 */
export function languageForCountry(code: string): Language {
  return COUNTRY_LANGUAGE[code.toLowerCase()] ?? "en";
}

/** 根据语种 code 拿选项（含国旗 + 标签） */
export function languageOption(code: Language): LanguageOption {
  return LANGUAGE_MAP[code] ?? LANGUAGES[0];
}
