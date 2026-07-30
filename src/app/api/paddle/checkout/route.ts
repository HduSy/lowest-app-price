// POST /api/paddle/checkout - 创建 $1.99 一次性 Paddle transaction
// 接收 { callbackUrl }，返回 { url } 供前端整页跳转到 Paddle Checkout
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { json, error } from "@/lib/api-response";

// 根据 API key 前缀判断 sandbox / live 的 API base
function paddleApiBase(apiKey: string): string {
  return apiKey.startsWith("pdl_sandbox")
    ? "https://sandbox-api.paddle.com"
    : "https://api.paddle.com";
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return error("Unauthorized", 401);
    }

    // Paddle 密钥：优先从 Cloudflare env 拿，fallback 到 process.env（dev）
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const ctx = getCloudflareContext();
    const env = ctx?.env as
      | { PADDLE_API_KEY?: string; PADDLE_PRICE_ID?: string }
      | undefined;
    const apiKey = env?.PADDLE_API_KEY || process.env.PADDLE_API_KEY;
    const priceId = env?.PADDLE_PRICE_ID || process.env.PADDLE_PRICE_ID;

    if (!apiKey || !priceId) {
      return error("Paddle not configured", 500);
    }

    const body = (await req.json().catch(() => ({}))) as { callbackUrl?: string };
    const callbackUrl: string = body.callbackUrl || `${req.nextUrl.origin}/us`;
    const returnUrl =
      callbackUrl + (callbackUrl.includes("?") ? "&" : "?") + "paid=1";

    // 创建 Paddle transaction（draft 状态，返回 checkout.url 供整页跳转）
    // custom_data.user_id 用于 webhook 回调时关联用户（等价 Stripe metadata）
    const res = await fetch(`${paddleApiBase(apiKey)}/transactions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [{ price_id: priceId, quantity: 1 }],
        checkout: { return_url: returnUrl },
        custom_data: { user_id: userId },
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error(
        "[api/paddle/checkout] Paddle API error:",
        res.status,
        detail
      );
      return error("Failed to create Paddle transaction", 500);
    }

    const data = (await res.json()) as {
      data?: { checkout?: { url?: string } };
    };
    const checkoutUrl = data.data?.checkout?.url;
    if (!checkoutUrl) {
      return error("Failed to create checkout URL", 500);
    }
    return json({ url: checkoutUrl });
  } catch (e) {
    console.error("[api/paddle/checkout] failed:", e);
    return error("Failed to create checkout session", 500);
  }
}
