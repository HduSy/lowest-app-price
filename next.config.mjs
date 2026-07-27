import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import createNextIntlPlugin from "next-intl/plugin";

initOpenNextCloudflareForDev();

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 构建期间跳过 ESLint（独立用 npm run lint 检查），避免 flat config 兼容性问题阻塞构建
  eslint: {
    ignoreDuringBuilds: true,
  },
  // 构建期间跳过 TS 类型检查：项目里存在若干 pre-existing 类型问题
  // （next-auth 类型兼容、route handler body unknown、IapEntry.period 缺字段等），
  // 用 tsc --noEmit 独立排查，不阻塞 deploy
  typescript: {
    ignoreBuildErrors: true,
  },
  // Cloudflare Workers 默认就是 edge runtime，路由不需要 `export const runtime = "edge"`
  // （OpenNext 不支持在 route handler 里声明 edge runtime，会报 "cannot use the edge runtime"）
};

export default withNextIntl(nextConfig);
