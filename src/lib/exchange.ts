// 汇率模块：从 open.er-api.com 获取，带内存缓存（6h TTL）
// 在浏览器和 edge runtime 都能跑

const API = "https://open.er-api.com/v6/latest/";
const TTL = 6 * 60 * 60 * 1000; // 6h

type Rates = Record<string, number>;
export type { Rates };

// 进程内缓存（edge runtime 每个 isolate 一份）
let cacheBase = "";
let cacheRates: Rates | null = null;
let cacheTs = 0;
let inflight: Promise<Rates> | null = null;

export async function getRates(base = "USD"): Promise<Rates> {
  // 缓存命中
  if (cacheBase === base && cacheRates && Date.now() - cacheTs < TTL) {
    return cacheRates;
  }
  // 去重并发请求
  if (inflight && cacheBase === base) return inflight;

  inflight = (async () => {
    try {
      const resp = await fetch(API + base);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = (await resp.json()) as { rates?: Rates };
      if (!json.rates) throw new Error("Missing rates field");
      cacheBase = base;
      cacheRates = json.rates;
      cacheTs = Date.now();
      return json.rates;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** 同步换算（需已加载汇率） */
export function convertSync(
  amount: number,
  from: string,
  to: string,
  rates: Rates
): number | null {
  if (from === to) return amount;
  const fromRate = rates[from];
  const toRate = rates[to];
  if (!fromRate || !toRate) return null;
  // amount_in_base = amount / fromRate ; result = amount_in_base * toRate
  return (amount / fromRate) * toRate;
}

/** 异步换算（自动加载汇率） */
export async function convert(
  amount: number,
  from: string,
  to: string
): Promise<number | null> {
  if (from === to) return amount;
  const rates = await getRates("USD");
  return convertSync(amount, from, to, rates);
}
