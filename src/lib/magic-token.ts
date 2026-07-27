// Magic Link token 生成 + 验证工具
// 设计要点：
//   1. 用 Web Crypto API（edge runtime 兼容，无 Node 依赖）
//   2. token 明文只发给用户邮件，DB 存 SHA-256 哈希（脱库不致命）
//   3. token 字符集 = urlsafe base64（30 字节 → 40 字符），可放 URL query 不需转义
//   4. 不依赖 AUTH_SECRET 做哈希（SHA-256 单向已足够防脱库）；签名在 CredentialsProvider 路径用

const TOKEN_BYTES = 30; // 240 bit 熵，远超暴力破解上限

/** 生成新 magic link 的原始 token（仅返回给调用方一次，后续不再可见） */
export async function generateRawToken(): Promise<string> {
  const buf = crypto.getRandomValues(new Uint8Array(TOKEN_BYTES));
  return bufferToUrlSafeBase64(buf);
}

/** 把 raw token 转 SHA-256 hex，用于 DB 查找与存储 */
export async function hashToken(rawToken: string): Promise<string> {
  const buf = new TextEncoder().encode(rawToken);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return bufferToHex(new Uint8Array(hash));
}

/** 给 CredentialsProvider 用的 HMAC 签名：验证通过后给 NextAuth 一个"已校验过"的凭证
 *  rawToken 通过 URL 进来，verify 接口验完 DB 里的 token 后，
 *  用 AUTH_SECRET 对 email 签 HMAC，传给 NextAuth.signIn("credentials", {email, sig})
 */
export async function signEmailWithSecret(email: string): Promise<string> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET 未配置");
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
    new TextEncoder().encode(email.toLowerCase())
  );
  return bufferToHex(new Uint8Array(sig));
}

/** 验证 email + sig 是否由本服务用 AUTH_SECRET 签发 */
export async function verifyEmailSignature(
  email: string,
  sig: string
): Promise<boolean> {
  const expected = await signEmailWithSecret(email);
  // 恒定时间比较，防 timing attack
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  }
  return diff === 0;
}

// ============ 内部工具 ============

function bufferToUrlSafeBase64(buf: Uint8Array): string {
  const bytes = Array.from(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  // base64url：把 + → -、/ → _、去掉 = padding
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function bufferToHex(buf: Uint8Array): string {
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
