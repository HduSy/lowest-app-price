// POST /api/paddle/webhook - 接收 Paddle webhook，HMAC-SHA256 验签后写 purchases 表
// transaction.completed 时插入购买记录（幂等：paddle_transaction_id 冲突时忽略）
import { NextRequest } from "next/server";
import { getDb, insertPurchase } from "@/lib/db";
import { json, error } from "@/lib/api-response";

/**
 * 验签 Paddle webhook：HMAC-SHA256(secret, `${ts}:${rawBody}`) == h1
 * header 格式：ts=<unix>;h1=<hex>
 * 用 Web Crypto（Cloudflare Workers 原生），timing-safe 比较
 */
async function verifyPaddleSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string
): Promise<boolean> {
  const parts = Object.fromEntries(
    signatureHeader
      .split(";")
      .map((kv) => kv.split("="))
      .map(([k, v]) => [k.trim(), v?.trim() ?? ""])
  );
  const ts = parts["ts"];
  const h1 = parts["h1"];
  if (!ts || !h1) return false;

  // 防重放：时间戳偏离当前 ±5 秒则拒绝
  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) return false;
  if (Math.abs(Date.now() / 1000 - tsNum) > 5) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${ts}:${rawBody}`)
  );
  const computedHex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // timing-safe 比较
  if (computedHex.length !== h1.length) return false;
  let diff = 0;
  for (let i = 0; i < computedHex.length; i++) {
    diff |= computedHex.charCodeAt(i) ^ h1.charCodeAt(i);
  }
  return diff === 0;
}

interface PaddleTransactionEvent {
  event_type: string;
  data: {
    id: string;
    status: string;
    customer_id: string | null;
    currency_code: string;
    totals?: { total?: string };
    custom_data?: { user_id?: string } | null;
  };
}

export async function POST(req: NextRequest) {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const ctx = getCloudflareContext();
    const env = ctx?.env as { PADDLE_WEBHOOK_SECRET?: string } | undefined;
    const webhookSecret =
      env?.PADDLE_WEBHOOK_SECRET || process.env.PADDLE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      return error("Paddle not configured", 500);
    }

    const rawBody = await req.text();
    const sig = req.headers.get("paddle-signature");
    if (!sig) return error("Missing paddle-signature header", 400);

    const ok = await verifyPaddleSignature(rawBody, sig, webhookSecret);
    if (!ok) return error("Webhook verification failed", 400);

    const event = JSON.parse(rawBody) as PaddleTransactionEvent;

    if (event.event_type === "transaction.completed") {
      const txn = event.data;
      const userId = txn.custom_data?.user_id;
      if (userId) {
        const db = await getDb();
        // Paddle 是 MoR 含税，实收金额因地区而异；存实际收取金额
        const total = txn.totals?.total;
        const amountCents = total
          ? Math.round(parseFloat(total) * 100)
          : 199; // fallback $1.99
        await insertPurchase(db, {
          id: crypto.randomUUID(),
          user_id: userId,
          paddle_transaction_id: txn.id,
          paddle_customer_id: txn.customer_id,
          amount_cents: amountCents,
          currency: (txn.currency_code || "USD").toLowerCase(),
          status: "paid",
        });
        console.log(
          `[api/paddle/webhook] purchase recorded: user=${userId} txn=${txn.id}`
        );
      }
    }

    return json({ received: true });
  } catch (e) {
    console.error("[api/paddle/webhook] failed:", e);
    return error("Webhook verification failed", 400);
  }
}
