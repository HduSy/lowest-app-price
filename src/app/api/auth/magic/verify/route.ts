// GET /api/auth/magic/verify?token=...
// 验证 magic link token + 用 NextAuth 凭证签发 session，最后 302 跳首页
// 错误一律跳回 /?magic_error=... 由前端 LoginDialog 展示
import { getDb, consumeMagicLinkToken } from "@/lib/db";
import { hashToken, signEmailWithSecret } from "@/lib/magic-token";
import { signIn } from "@/lib/auth";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const rawToken = url.searchParams.get("token") || "";
  const origin = url.origin;

  if (!rawToken) {
    return Response.redirect(`${origin}/?magic_error=missing_token`);
  }

  try {
    const tokenHash = await hashToken(rawToken);
    const db = await getDb();
    const result = await consumeMagicLinkToken(db, tokenHash);

    if (!result.ok) {
      const reason =
        result.reason === "expired"
          ? "expired"
          : result.reason === "used"
            ? "used"
            : "invalid";
      return Response.redirect(`${origin}/?magic_error=${reason}`);
    }

    // token 消费成功，签 HMAC 给 NextAuth credentials provider
    const sig = await signEmailWithSecret(result.email);

    // signIn 会触发 CredentialsProvider.authorize，内部 upsertUserByEmail 创建/找到用户
    // callbackUrl 指定登录后跳首页
    // redirect: false 时返回 URL 字符串；为 true 时 signIn 自身做 302
    // 这里在 Worker 内手动捕获返回的 URL，自己发 redirect，避免 signIn 内部抛 Response 混淆
    try {
      await signIn("magic-link", {
        email: result.email,
        sig,
        redirect: false,
        // callbackUrl 不影响 redirect:false 的行为，但保留语义
        callbackUrl: `${origin}/?magic_ok=1`,
      });
      // signIn redirect:false 时返回的不是 Response；登录成功后我们手动跳首页
      return Response.redirect(`${origin}/?magic_ok=1`);
    } catch (e) {
      console.error("[magic/verify] signIn failed:", e);
      return Response.redirect(`${origin}/?magic_error=signin_failed`);
    }
  } catch (e) {
    console.error("[magic/verify] unexpected error:", e);
    return Response.redirect(`${origin}/?magic_error=server_error`);
  }
}
