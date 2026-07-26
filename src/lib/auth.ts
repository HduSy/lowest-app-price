// Auth.js v5 配置：Google / Twitter(X) / GitHub 三家 OAuth + JWT strategy
// JWT 无状态，不依赖 KV/D1 session，Cloudflare Workers 友好
import NextAuth, { type DefaultUser } from "next-auth";
import Google from "next-auth/providers/google";
import Twitter from "next-auth/providers/twitter";
import GitHub from "next-auth/providers/github";
import { getDb, getUserByProvider, upsertUser } from "./db";

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

export const authConfig = {
  session: { strategy: "jwt" as const },
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
    Twitter({
      clientId: process.env.AUTH_TWITTER_ID,
      clientSecret: process.env.AUTH_TWITTER_SECRET,
    }),
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    }),
  ],
  callbacks: {
    // 登录时 upsert 用户到 D1 users 表
    async signIn({ user, account }) {
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
    // 后续请求（无 user/account 参数）直接用 token 里的值，不查 DB
    // 注意：手动改 role 后需重新登录才能生效
    async jwt({ token, user, account }) {
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

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
