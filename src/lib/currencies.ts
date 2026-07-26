// 货币符号 → ISO 4217 映射 + 价格字符串解析（从旧 js/data/currencies.js 迁移）

const symbolToIso: Record<string, string> = {
  $: "USD",
  US$: "USD",
  "€": "EUR",
  "£": "GBP",
  "¥": "CNY",
  "￥": "JPY",
  "₩": "KRW",
  "₹": "INR",
  "₽": "RUB",
  "₺": "TRY",
  "R$": "BRL",
  "A$": "AUD",
  "C$": "CAD",
  "HK$": "HKD",
  "NT$": "TWD",
  kr: "NOK",
  CHF: "CHF",
  Rp: "IDR",
  "MX$": "MXN",
  "₴": "UAH",
  "฿": "THB",
  RM: "MYR",
  "₱": "PHP",
  R: "ZAR",
};

// 显式 ISO 货币代码集合（用于识别 "USD 20.00" 这类价格串里的币种）
const ISO_CODES = new Set([
  "USD", "CAD", "BRL", "MXN", "ARS", "CLP", "COP", "GBP", "EUR", "TRY", "NOK",
  "CHF", "DKK", "ILS", "AED", "SAR", "NGN", "ZAR", "EGP", "JPY", "KRW", "CNY",
  "HKD", "TWD", "INR", "IDR", "THB", "VND", "PHP", "MYR", "SGD", "PKR", "KZT",
  "AUD", "RUB", "UAH", "SEK", "PLN",
]);

export const fractionDigits: Record<string, number> = {
  USD: 2, EUR: 2, GBP: 2, CAD: 2, AUD: 2, CHF: 2, CNY: 2, HKD: 2, TWD: 0,
  TRY: 2, BRL: 2, MXN: 2, INR: 2, RUB: 2, UAH: 2, THB: 2, MYR: 2, PHP: 2, ZAR: 2,
  JPY: 0, KRW: 0, IDR: 0, NOK: 2, SEK: 2, DKK: 2, PLN: 2, VND: 0,
};

export const currencyNames: Record<string, string> = {
  USD: "美元", EUR: "欧元", GBP: "英镑", CAD: "加元", AUD: "澳元", CHF: "瑞郎",
  CNY: "人民币", HKD: "港币", TWD: "新台币", TRY: "土耳其里拉", BRL: "巴西雷亚尔",
  MXN: "墨西哥比索", INR: "印度卢比", JPY: "日元", KRW: "韩元", IDR: "印尼盾",
  NOK: "挪威克朗", RUB: "卢布", ARS: "阿根廷比索", CLP: "智利比索", COP: "哥伦比亚比索",
  DKK: "丹麦克朗", ILS: "以色列谢克尔", AED: "阿联酋迪拉姆", SAR: "沙特里亚尔",
  NGN: "尼日利亚奈拉", ZAR: "南非兰特", EGP: "埃及镑", THB: "泰铢", VND: "越南盾",
  PHP: "菲律宾比索", MYR: "马来西亚林吉特", SGD: "新加坡元", PKR: "巴基斯坦卢比",
  KZT: "哈萨克斯坦坚戈", SEK: "瑞典克朗", PLN: "波兰兹罗提", UAH: "乌克兰格里夫纳",
};

export interface ParsedPrice {
  amount: number | null;
  currency: string | null;
  /** currency 是否来自显式 ISO 代码（如 "USD 20.00"），而非歧义符号（如 $） */
  currencyExplicit: boolean;
}

/**
 * 解析本地化价格字符串 → { amount, currency }
 * 处理符号前缀/后缀、千分位与小数点的多语言格式
 */
export function parsePrice(raw: string): ParsedPrice {
  if (!raw) return { amount: null, currency: null, currencyExplicit: false };
  const s = String(raw).trim();

  let currency: string | null = null;
  let currencyExplicit = false;
  let numPart = s;

  // 1. 显式 ISO 货币代码前缀/后缀（如阿根廷 "USD 20.00"）
  //    币种明确，应覆盖 storefront 默认币种
  const isoPrefix = s.match(/^([A-Z]{3})\s+(.*)$/);
  if (isoPrefix && ISO_CODES.has(isoPrefix[1])) {
    currency = isoPrefix[1];
    currencyExplicit = true;
    numPart = isoPrefix[2];
  } else {
    const isoSuffix = s.match(/^(.*)\s+([A-Z]{3})$/);
    if (isoSuffix && ISO_CODES.has(isoSuffix[2])) {
      currency = isoSuffix[2];
      currencyExplicit = true;
      numPart = isoSuffix[1];
    }
  }

  // 2. 货币符号（$ € £ 等，有歧义，不设 currencyExplicit）
  if (!currency) {
    const symbols = Object.keys(symbolToIso).sort((a, b) => b.length - a.length);
    for (const sym of symbols) {
      if (s.startsWith(sym)) {
        currency = symbolToIso[sym];
        numPart = s.slice(sym.length).trim();
        break;
      }
      if (s.endsWith(sym)) {
        currency = symbolToIso[sym];
        numPart = s.slice(0, -sym.length).trim();
        break;
      }
    }
  }

  // 3. 印尼语量级后缀：juta=百万，ribu=千（"Rp 3,999juta" -> 3,999,000）
  //    印尼语里逗号是小数点，"3,999juta" = 3.999 × 1,000,000
  let multiplier = 1;
  let indonesianSuffix = false;
  const jutaIdx = numPart.search(/juta/i);
  if (jutaIdx >= 0) {
    multiplier = 1_000_000;
    indonesianSuffix = true;
    numPart = numPart.slice(0, jutaIdx) + numPart.slice(jutaIdx + 4);
  } else {
    const ribuIdx = numPart.search(/ribu/i);
    if (ribuIdx >= 0) {
      multiplier = 1_000;
      indonesianSuffix = true;
      numPart = numPart.slice(0, ribuIdx) + numPart.slice(ribuIdx + 4);
    }
  }

  let cleaned = numPart.replace(/[\s\u00A0]/g, "").replace(/[^\d.,]/g, "");

  if (cleaned.includes(",") && cleaned.includes(".")) {
    if (cleaned.lastIndexOf(",") < cleaned.lastIndexOf(".")) {
      cleaned = cleaned.replace(/,/g, "");
    } else {
      cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    }
  } else if (cleaned.includes(",")) {
    const afterComma = cleaned.split(",")[1] || "";
    // 印尼语后缀语境下逗号是小数点（"3,999juta" = 3.999 百万）
    if (indonesianSuffix || afterComma.length === 2) {
      cleaned = cleaned.replace(",", ".");
    } else {
      cleaned = cleaned.replace(/,/g, "");
    }
  } else if (cleaned.includes(".")) {
    // 只有点：越南/德语等格式里 "." 是千位分隔符
    // 多个点 -> 全是千位 "1.999.000" -> "1999000"
    // 单个点 + 小数点后 3 位 -> 千位 "899.000" -> "899000"
    // 单个点 + 小数点后 1-2 位 -> 小数 "9.99" 保留
    const parts = cleaned.split(".");
    if (parts.length > 2 || (parts[1] || "").length === 3) {
      cleaned = cleaned.replace(/\./g, "");
    }
  }

  const amount = parseFloat(cleaned);
  const finalAmount = isNaN(amount) ? null : amount * multiplier;
  return { amount: finalAmount, currency, currencyExplicit };
}

/** 按 storefront 上下文校正货币：
 *  - 显式 ISO 代码（如阿根廷 "USD 20.00"）优先，覆盖 storefront 默认币种
 *  - 歧义符号（如 $）交给 storefront 消歧
 */
export function resolveCurrency(parsed: ParsedPrice, storefrontCurrency?: string): string {
  if (parsed.currencyExplicit && parsed.currency) return parsed.currency;
  if (storefrontCurrency) return storefrontCurrency;
  return parsed.currency || "USD";
}

/** 格式化金额展示 */
export function formatCurrency(amount: number | null, currency: string): string {
  if (amount == null || isNaN(amount)) return "—";
  try {
    return new Intl.NumberFormat("zh-CN", {
      style: "currency",
      currency,
      minimumFractionDigits: fractionDigits[currency] ?? 2,
      maximumFractionDigits: fractionDigits[currency] ?? 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}
