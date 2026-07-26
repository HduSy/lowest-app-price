import type { Region } from "./types";

// 全部支持的国家/地区
// - 用于：站点 /<country> 多语言路由 + 首页国家展示 + 详情页比价
// - 同步写入 D1（migrations/0002_seed_regions.sql）
// - flag 不再用 emoji，全站统一走 Flag 组件（alicdn 图片）
export const REGIONS: Region[] = [
  // 美洲
  { code: "us", name: "美国", name_en: "United States", flag: "🇺🇸", currency: "USD", sort_order: 1 },
  { code: "ca", name: "加拿大", name_en: "Canada", flag: "🇨🇦", currency: "CAD", sort_order: 2 },
  { code: "br", name: "巴西", name_en: "Brazil", flag: "🇧🇷", currency: "BRL", sort_order: 3 },
  { code: "mx", name: "墨西哥", name_en: "Mexico", flag: "🇲🇽", currency: "MXN", sort_order: 4 },
  { code: "ar", name: "阿根廷", name_en: "Argentina", flag: "🇦🇷", currency: "ARS", sort_order: 5 },
  { code: "cl", name: "智利", name_en: "Chile", flag: "🇨🇱", currency: "CLP", sort_order: 6 },
  { code: "co", name: "哥伦比亚", name_en: "Colombia", flag: "🇨🇴", currency: "COP", sort_order: 7 },
  // 欧洲
  { code: "gb", name: "英国", name_en: "United Kingdom", flag: "🇬🇧", currency: "GBP", sort_order: 10 },
  { code: "de", name: "德国", name_en: "Germany", flag: "🇩🇪", currency: "EUR", sort_order: 11 },
  { code: "fr", name: "法国", name_en: "France", flag: "🇫🇷", currency: "EUR", sort_order: 12 },
  { code: "tr", name: "土耳其", name_en: "Türkiye", flag: "🇹🇷", currency: "TRY", sort_order: 13 },
  { code: "no", name: "挪威", name_en: "Norway", flag: "🇳🇴", currency: "NOK", sort_order: 14 },
  { code: "ch", name: "瑞士", name_en: "Switzerland", flag: "🇨🇭", currency: "CHF", sort_order: 15 },
  { code: "dk", name: "丹麦", name_en: "Denmark", flag: "🇩🇰", currency: "DKK", sort_order: 16 },
  { code: "il", name: "以色列", name_en: "Israel", flag: "🇮🇱", currency: "ILS", sort_order: 17 },
  // 欧洲补充：5 个高价值独立定价区（EUR / PLN / RUB 都有独立定价，与现有欧洲区不重叠）
  { code: "es", name: "西班牙", name_en: "Spain", flag: "🇪🇸", currency: "EUR", sort_order: 18 },
  { code: "it", name: "意大利", name_en: "Italy", flag: "🇮🇹", currency: "EUR", sort_order: 19 },
  { code: "nl", name: "荷兰", name_en: "Netherlands", flag: "🇳🇱", currency: "EUR", sort_order: 25 },
  { code: "pl", name: "波兰", name_en: "Poland", flag: "🇵🇱", currency: "PLN", sort_order: 26 },
  { code: "ru", name: "俄罗斯", name_en: "Russia", flag: "🇷🇺", currency: "RUB", sort_order: 29 },
  // 中东 + 非洲
  { code: "ae", name: "阿联酋", name_en: "United Arab Emirates", flag: "🇦🇪", currency: "AED", sort_order: 20 },
  { code: "sa", name: "沙特", name_en: "Saudi Arabia", flag: "🇸🇦", currency: "SAR", sort_order: 21 },
  { code: "ng", name: "尼日利亚", name_en: "Nigeria", flag: "🇳🇬", currency: "NGN", sort_order: 22 },
  { code: "za", name: "南非", name_en: "South Africa", flag: "🇿🇦", currency: "ZAR", sort_order: 23 },
  { code: "eg", name: "埃及", name_en: "Egypt", flag: "🇪🇬", currency: "EGP", sort_order: 24 },
  // 亚太
  { code: "jp", name: "日本", name_en: "Japan", flag: "🇯🇵", currency: "JPY", sort_order: 30 },
  { code: "kr", name: "韩国", name_en: "South Korea", flag: "🇰🇷", currency: "KRW", sort_order: 31 },
  { code: "cn", name: "中国大陆", name_en: "China", flag: "🇨🇳", currency: "CNY", sort_order: 32 },
  { code: "hk", name: "香港", name_en: "Hong Kong", flag: "🇭🇰", currency: "HKD", sort_order: 33 },
  { code: "tw", name: "台湾", name_en: "Taiwan", flag: "🇹🇼", currency: "TWD", sort_order: 34 },
  { code: "in", name: "印度", name_en: "India", flag: "🇮🇳", currency: "INR", sort_order: 35 },
  { code: "id", name: "印度尼西亚", name_en: "Indonesia", flag: "🇮🇩", currency: "IDR", sort_order: 36 },
  { code: "th", name: "泰国", name_en: "Thailand", flag: "🇹🇭", currency: "THB", sort_order: 37 },
  { code: "vn", name: "越南", name_en: "Vietnam", flag: "🇻🇳", currency: "VND", sort_order: 38 },
  { code: "ph", name: "菲律宾", name_en: "Philippines", flag: "🇵🇭", currency: "PHP", sort_order: 39 },
  { code: "my", name: "马来西亚", name_en: "Malaysia", flag: "🇲🇾", currency: "MYR", sort_order: 40 },
  { code: "sg", name: "新加坡", name_en: "Singapore", flag: "🇸🇬", currency: "SGD", sort_order: 41 },
  { code: "pk", name: "巴基斯坦", name_en: "Pakistan", flag: "🇵🇰", currency: "PKR", sort_order: 42 },
  { code: "kz", name: "哈萨克斯坦", name_en: "Kazakhstan", flag: "🇰🇿", currency: "KZT", sort_order: 43 },
  // 大洋洲
  { code: "au", name: "澳大利亚", name_en: "Australia", flag: "🇦🇺", currency: "AUD", sort_order: 50 },
];

export const REGION_MAP: Record<string, Region> = Object.fromEntries(
  REGIONS.map((r) => [r.code, r])
);

// 根据国家 code 拿默认币种
export function currencyForCountry(code: string): string {
  return REGION_MAP[code.toLowerCase()]?.currency ?? "USD";
}
