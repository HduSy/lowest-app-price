// 付费下载 App 的合成买断价档位标识
// crawler 写入 DB prices.iap_name 时用 APP_PURCHASE_KEY（稳定内部 key，不本地化）；
// 显示层（PriceTable Tab / OG 图）按 locale 翻译成 appPurchaseTier。
// isAppPurchaseName 兼容 DB 历史值 "App 下载"（旧 crawler 中文硬编码），无需迁移。
export const APP_PURCHASE_KEY = "__app_purchase__";
const APP_PURCHASE_LEGACY = "App 下载";

/** 判断档位名是否为付费下载 App 的合成买断价档位（兼容新旧 DB 值） */
export function isAppPurchaseName(name: string): boolean {
  return name === APP_PURCHASE_KEY || name === APP_PURCHASE_LEGACY;
}
