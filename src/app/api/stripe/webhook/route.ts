// POST /api/stripe/webhook - 接收 Stripe webhook，验签后写 purchases 表
// Stripe -> checkout.session.completed 时插入购买记录（幂等）
import { NextRequest } from "next/server";
import Stripe from "stripe";
import { getDb, insertPurchase } from "@/lib/db";
import { json, error } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const ctx = getCloudflareContext();
    const env = ctx?.env as
      | { STRIPE_SECRET_KEY?: string; STRIPE_WEBHOOK_SECRET?: string }
      | undefined;
    const stripeSecret = env?.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
    const webhookSecret =
      env?.STRIPE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;

    if (!stripeSecret || !webhookSecret) {
      return error("Stripe not configured", 500);
    }

    const stripe = new Stripe(stripeSecret);
    const body = await req.text();
    const sig = req.headers.get("stripe-signature");
    if (!sig) return error("Missing stripe-signature header", 400);

    // Workers 下用 Web Crypto 验签（stripe-node 5.x+ 自动 fallback）
    const event = await stripe.webhooks.constructEventAsync(
      body,
      sig,
      webhookSecret
    );

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id;
      if (userId) {
        const db = await getDb();
        // 幂等：ON CONFLICT(stripe_session_id) DO NOTHING
        await insertPurchase(db, {
          id: crypto.randomUUID(),
          user_id: userId,
          stripe_session_id: session.id,
          stripe_customer_id:
            typeof session.customer === "string" ? session.customer : null,
          amount_cents: session.amount_total ?? 199,
          currency: session.currency ?? "usd",
          status: "paid",
        });
        console.log(`[stripe/webhook] purchase recorded: user=${userId} session=${session.id}`);
      }
    }

    return json({ received: true });
  } catch (e) {
    console.error("[api/stripe/webhook] failed:", e);
    return error("Webhook verification failed", 400);
  }
}
