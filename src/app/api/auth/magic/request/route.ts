// POST /api/auth/magic/request  { email }
// 生成 magic link token 入库 + 发邮件
// 安全要点：
//   - 无论邮箱是否存在 / 邮件是否真发出，始终返回 200 OK（防邮箱枚举）
//   - 60 秒内同邮箱不允许重复请求（限流）
//   - email 格式校验在前，避免脏数据进库
import { json, error } from "@/lib/api-response";
import { getDb, createMagicLinkToken, recentMagicLinkForEmail } from "@/lib/db";
import { generateRawToken, hashToken } from "@/lib/magic-token";
import { sendMagicLinkEmail } from "@/lib/email";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RATE_LIMIT_SECONDS = 60;
const TTL_MINUTES = 15;

export async function POST(req: Request) {
  let email = "";
  try {
    const body = (await req.json().catch(() => ({}))) as { email?: string };
    email = (body.email || "").trim().toLowerCase();
  } catch {
    return error("Invalid request", 400);
  }
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return error("Please enter a valid email address", 400);
  }

  try {
    const db = await getDb();

    // 限流：60 秒内同邮箱只能请求一次（不区分 IP，防简单滥用）
    const recent = await recentMagicLinkForEmail(db, email, RATE_LIMIT_SECONDS);
    if (recent) {
      // 静默返回 OK，避免泄露"该邮箱刚请求过"的信息
      return json({ ok: true });
    }

    // 生成 token + 哈希入库
    const rawToken = await generateRawToken();
    const tokenHash = await hashToken(rawToken);
    const expiresAt = new Date(Date.now() + TTL_MINUTES * 60 * 1000).toISOString();
    const ip =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for") ||
      null;
    await createMagicLinkToken(db, { email, tokenHash, expiresAt, ip });

    // 拼 magic link URL（与 verify route 对齐）
    const origin = new URL(req.url).origin;
    const magicLinkUrl = `${origin}/api/auth/magic/verify?token=${rawToken}`;

    // 异步发邮件（失败不阻塞响应，调用方对外始终 200）
    // 注意：CF Workers 没有 background task 概念，await 等真发完
    // Resend 通常 < 500ms，可接受
    await sendMagicLinkEmail(email, magicLinkUrl);
  } catch (e) {
    console.error("[magic/request] failed:", e);
    // 仍返回 OK，防邮箱枚举 + 不暴露内部错误
  }
  return json({ ok: true });
}
