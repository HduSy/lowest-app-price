// POST /api/stripe/checkout - 创建 $1.99 一次性 Stripe Checkout Session
// 接收 { callbackUrl }，返回 { url } 供前端跳转
import { NextRequest } from "next/server";
import Stripe from "stripe";
import { auth } from "@/lib/auth";
import { json, error } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return error("Unauthorized", 401);
    }

    // Stripe 密钥：优先从 Cloudflare env 拿，fallback 到 process.env（dev）
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const ctx = getCloudflareContext();
    const env = ctx?.env as
      | { STRIPE_SECRET_KEY?: string; STRIPE_PRICE_ID?: string }
      | undefined;
    const stripeSecret = env?.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
    const priceId = env?.STRIPE_PRICE_ID || process.env.STRIPE_PRICE_ID;

    if (!stripeSecret || !priceId) {
      return error("Stripe not configured", 500);
    }

    const stripe = new Stripe(stripeSecret);

    const body = await req.json().catch(() => ({}));
    const callbackUrl: string = body.callbackUrl || `${req.nextUrl.origin}/us`;

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url:
        callbackUrl + (callbackUrl.includes("?") ? "&" : "?") + "paid=1",
      cancel_url: callbackUrl,
      // 用 client_reference_id + metadata 双重关联用户 id
      client_reference_id: userId,
      metadata: { user_id: userId },
      // 一次性支付，不需要收邮箱（OAuth 已有）
      customer_creation: "always",
    });

    if (!checkoutSession.url) {
      return error("Failed to create checkout URL", 500);
    }
    return json({ url: checkoutSession.url });
  } catch (e) {
    console.error("[api/stripe/checkout] failed:", e);
    return error("Failed to create checkout session", 500);
  }
}
