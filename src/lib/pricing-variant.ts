// 定价 A/B 实验开关读取：PRICING_VARIANT env（A=付费三档，B=登录即会员免费，默认 A）
// 服务端 helper：entitlement/session/layout 等 server 上下文调用
// 客户端不直接用，改用 usePricingVariant()（Zustand，SSR 注入）

export type PricingVariant = "A" | "B";

export async function getPricingVariant(): Promise<PricingVariant> {
  const { getCloudflareContext } = await import("@opennextjs/cloudflare");
  const ctx = getCloudflareContext();
  const env = ctx?.env as { PRICING_VARIANT?: string } | undefined;
  const v = env?.PRICING_VARIANT || process.env.PRICING_VARIANT;
  return v === "B" ? "B" : "A";
}
