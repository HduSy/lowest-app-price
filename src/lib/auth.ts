// Auth.js v5 配置：Google OAuth + Magic Link（CredentialsProvider 桥接）+ JWT strategy
// JWT 无状态，不依赖 KV/D1 session，Cloudflare Workers 友好
// Twitter / GitHub providers 保留配置但 LoginDialog 暂时不展示（Console 审核未过）
import NextAuth, { type DefaultUser } from "next-auth";
import Google from "next-auth/providers/google";
import Twitter from "next-auth/providers/twitter";
import GitHub from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";
import { getDb, getUserByProvider, upsertUser, upsertUserByEmail } from "./db";
import { verifyEmailSignature } from "./magic-token";
import { error } from "./api-response";

// 扩展类型：把 D1 内部 user id + role 注入 session.user 和 jwt token
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role?: string;
    } & DefaultUser;
  }
}
declare module "next-auth/jwt" {
  interface JWT {
    dbUserId?: string;
    role?: string;
  }
}

// OAuth 凭据必须请求时读取：OpenNext 生产环境只在请求作用域注入 secret
// （getCloudflareContext().env），模块顶层读 process.env 拿到 undefined，
// 会导致全部 OAuth provider 报 error=Configuration。
// 本地 dev（initOpenNextCloudflareForDev）ctx.env 同样可用，process.env 兜底双保险。
async function getAuthEnv(): Promise<Record<string, string | undefined>> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const ctx = getCloudflareContext();
    // CloudflareEnv 含 D1 binding 等非 string 字段，双跳转 unknown 再取 string 键
    const cfEnv = ctx?.env as unknown as Record<string, string | undefined> | undefined;
    return { ...process.env, ...cfEnv };
  } catch {
    return { ...process.env };
  }
}

export const authConfig = {
  session: { strategy: "jwt" as const },
  trustHost: true,
  providers: [
    // Magic Link 桥接：verify 接口验完 DB token 后，签 HMAC 走此 provider 登入
    // authorize 只信任本服务签的 HMAC，外部直接调 signIn("credentials", {...}) 会被 sig 校验拦下
    Credentials({
      id: "magic-link",
      name: "Magic Link",
      credentials: {
        email: { label: "Email", type: "email" },
        sig: { label: "Signature", type: "text" },
      },
      async authorize(creds) {
        const email = creds?.email;
        const sig = creds?.sig;
        if (typeof email !== "string" || typeof sig !== "string") return null;
        if (!(await verifyEmailSignature(email, sig))) {
          console.warn("[auth] magic-link authorize: invalid signature");
          return null;
        }
        try {
          const db = await getDb();
          const u = await upsertUserByEmail(db, email);
          return {
            id: u.id,
            email: u.email,
            name: u.name,
            image: u.image,
            // 自定义字段，jwt callback 用
            role: u.role,
          } as DefaultUser & { role: string };
        } catch (e) {
          console.error("[auth] magic-link authorize upsert failed:", e);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    // 登录时 upsert 用户到 D1 users 表（仅 OAuth 走此分支；magic-link 已在 authorize 内完成 upsert）
    async signIn({ user, account }) {
      if (account?.provider === "magic-link") return true;
      if (!account?.provider || !account?.providerAccountId) return true;
      try {
        const db = await getDb();
        await upsertUser(db, {
          oauth_provider: account.provider,
          oauth_account_id: account.providerAccountId,
          email: user.email ?? null,
          name: user.name ?? null,
          image: user.image ?? null,
        });
      } catch (e) {
        // 写库失败不阻塞登录（用户仍可登录，下次再同步）
        console.error("[auth] upsertUser failed:", e);
      }
      return true;
    },
    // 首次登录时把 D1 user id + role 存入 JWT token
    // OAuth：按 provider + providerAccountId 查
    // Magic Link：authorize 返回的 user.id 已经是 D1 user id，直接用
    async jwt({ token, user, account }) {
      if (user && account?.provider === "magic-link") {
        token.dbUserId = user.id;
        const role = (user as DefaultUser & { role?: string }).role;
        if (role) token.role = role;
        return token;
      }
      if (user && account?.provider && account?.providerAccountId) {
        try {
          const db = await getDb();
          const dbUser = await getUserByProvider(
            db,
            account.provider,
            account.providerAccountId
          );
          if (dbUser) {
            token.dbUserId = dbUser.id;
            token.role = dbUser.role;
          }
        } catch (e) {
          console.error("[auth] jwt DB query failed:", e);
        }
      }
      return token;
    },
    // 把 token.dbUserId + role 注入 session.user
    async session({ session, token }) {
      if (token.dbUserId && session.user) {
        session.user.id = token.dbUserId;
        session.user.role = token.role;
      }
      return session;
    },
  },
};

// 懒初始化：每次请求时构建完整 config，OAuth 凭据从请求作用域 env 读取
// （next-auth v5 支持 config 函数形式，见 node_modules/next-auth/index.d.ts）
export const { handlers, auth, signIn, signOut } = NextAuth(async () => {
  const env = await getAuthEnv();
  return {
    ...authConfig,
    secret: env.AUTH_SECRET,
    providers: [
      Google({
        clientId: env.AUTH_GOOGLE_ID,
        clientSecret: env.AUTH_GOOGLE_SECRET,
      }),
      // Twitter / GitHub 暂不展示在 LoginDialog，但 provider 配置保留以便审核过后直接放出
      Twitter({
        clientId: env.AUTH_TWITTER_ID,
        clientSecret: env.AUTH_TWITTER_SECRET,
      }),
      GitHub({
        clientId: env.AUTH_GITHUB_ID,
        clientSecret: env.AUTH_GITHUB_SECRET,
      }),
      ...authConfig.providers,
    ],
  };
});

// Admin 路由统一鉴权：登录用户 role=admin，或 query 参数 token === env.ADMIN_TOKEN
// 返回 null 表示通过，返回 Response 表示拒绝（直接 return 该 Response 即可）
// 接受 Request 基类，兼容 NextRequest 与 web 标准 Request 两种 route handler 签名
export async function requireAdmin(req: Request): Promise<Response | null> {
  const session = await auth();
  if (session?.user?.role === "admin") return null;
  const token = new URL(req.url).searchParams.get("token");
  const { getCloudflareContext } = await import("@opennextjs/cloudflare");
  const ctx = getCloudflareContext();
  const env = ctx?.env as { ADMIN_TOKEN?: string } | undefined;
  if (!env?.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) {
    return error("Unauthorized", 401);
  }
  return null;
}
