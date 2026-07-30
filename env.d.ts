// Cloudflare bindings 类型增强
// D1Database 等基础类型来自 @cloudflare/workers-types
// CloudflareEnv 接口由 @opennextjs/cloudflare 声明为 global，
// 这里用 interface 合并把 DB 字段加进去（等价于 wrangler types 生成的结果）

declare global {
  interface CloudflareEnv {
    DB: D1Database;
    DEFAULT_CURRENCY?: string;
    // Auth (Auth.js v5) - OAuth provider credentials + JWT secret
    AUTH_SECRET?: string;
    AUTH_GOOGLE_ID?: string;
    AUTH_GOOGLE_SECRET?: string;
    AUTH_TWITTER_ID?: string;
    AUTH_TWITTER_SECRET?: string;
    AUTH_GITHUB_ID?: string;
    AUTH_GITHUB_SECRET?: string;
    // Paddle - $1.99 一次性买断（MoR，代收税）
    PADDLE_API_KEY?: string;
    PADDLE_WEBHOOK_SECRET?: string;
    PADDLE_PRICE_ID?: string;
    // Email (Resend) - magic link 发件
    RESEND_API_KEY?: string;
    MAIL_FROM?: string;
    // Admin - 一次性回填/运维接口鉴权
    ADMIN_TOKEN?: string;
    // Pricing A/B 实验开关（A=付费三档，B=登录即会员免费），默认 A
    PRICING_VARIANT?: "A" | "B";
  }
}

export {};
