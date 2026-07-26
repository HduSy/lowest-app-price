import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// 使用默认配置：incrementalCache/queue 都用 Cloudflare 原生实现
export default defineCloudflareConfig();
