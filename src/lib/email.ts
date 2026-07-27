// 邮件发送：Resend HTTP API 封装（edge runtime 兼容，纯 fetch，无 SMTP 协议）
// 申请 key：https://resend.com/api-keys → 域名 DNS 验证后填到 .dev.vars + wrangler secret
// 免费层 3000 封/月 + 100 封/天，对你这个量级够用

const RESEND_API_URL = "https://api.resend.com/emails";

/** 发送 magic link 登录邮件；返回 true 发送成功 / false 失败（调用方静默吞错，对外始终返回 200） */
export async function sendMagicLinkEmail(
  toEmail: string,
  magicLinkUrl: string
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[email] RESEND_API_KEY 未配置");
    return false;
  }
  // 发件人：必须用 Resend 已验证的域名；onboarding@resend.dev 是 Resend 提供的共享测试发件人
  // 生产建议：noreply@yourdomain.com（需在 Resend dashboard 验证域名）
  const fromEmail =
    process.env.MAIL_FROM || "AppStore 比价 <onboarding@resend.dev>";

  const html = renderMagicLinkHtml(magicLinkUrl);
  const text = `点击下方链接登录 App Store 比价：\n\n${magicLinkUrl}\n\n链接 15 分钟内有效。如非本人操作请忽略此邮件。`;

  try {
    const resp = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: toEmail,
        subject: "登录 App Store 比价",
        html,
        text,
        // 加分类标签便于 Resend dashboard 看邮件用途分布
        tags: [{ name: "type", value: "magic_link" }],
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      console.error(
        `[email] Resend API ${resp.status}: ${body.slice(0, 200)}`
      );
      return false;
    }
    return true;
  } catch (e) {
    console.error("[email] sendMagicLinkEmail failed:", e);
    return false;
  }
}

/** magic link 邮件 HTML：主 CTA 按钮 + 15 分钟有效期提示 + 安全说明 */
function renderMagicLinkHtml(magicLinkUrl: string): string {
  // 转义 URL 里可能影响 HTML 结构的字符（URL 通常不含 <>"'，但保险起见）
  const safeUrl = magicLinkUrl
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif;color:#1d1d1f;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:32px 0;">
    <tr><td align="center">
      <table role="presentation" width="420" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;padding:32px 28px;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
        <tr><td style="text-align:center;padding-bottom:8px;">
          <h1 style="margin:0;font-size:20px;font-weight:600;color:#1d1d1f;">登录 App Store 比价</h1>
        </td></tr>
        <tr><td style="text-align:center;color:#6e6e73;font-size:14px;line-height:1.5;padding-bottom:24px;">
          点击下方按钮即可登录，链接 15 分钟内有效。
        </td></tr>
        <tr><td align="center" style="padding-bottom:20px;">
          <a href="${safeUrl}" style="display:inline-block;background:#0071e3;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 28px;border-radius:980px;">点击登录</a>
        </td></tr>
        <tr><td style="color:#6e6e73;font-size:12px;line-height:1.6;border-top:1px solid #f0f0f2;padding-top:16px;">
          按钮无法点击？复制此链接到浏览器：<br>
          <span style="color:#86868b;word-break:break-all;">${safeUrl}</span>
        </td></tr>
        <tr><td style="color:#86868b;font-size:11px;padding-top:12px;">
          如非本人操作，请忽略此邮件，无需任何操作。
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
