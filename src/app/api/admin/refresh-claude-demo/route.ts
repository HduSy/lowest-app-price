// 定时刷新首页 Claude 演示区价格数据
// 用法：外部 cron 定时调用此端点（如每 6 小时），或在部署后手动触发一次
// 鉴权：登录用户 role=admin，或提供 ADMIN_TOKEN
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { json, error } from "@/lib/api-response";
import { auth } from "@/lib/auth";
import { refreshPrices } from "@/app/[country]/apps/[appId]/refresh";

const CLAUDE_APP_ID = "6473753684";

export async function GET(req: NextRequest) {
  // 鉴权
  const session = await auth();
  const isAdmin = session?.user?.role === "admin";
  if (!isAdmin) {
    const token = req.nextUrl.searchParams.get("token");
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const ctx = getCloudflareContext();
    const env = ctx?.env as { ADMIN_TOKEN?: string } | undefined;
    if (!env?.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) {
      return error("Unauthorized", 401);
    }
  }

  const priorityCountry = req.nextUrl.searchParams.get("country") || "us";
  const db = await getDb();
  const { writtenRegions } = await refreshPrices(db, CLAUDE_APP_ID, priorityCountry);

  return json({ appId: CLAUDE_APP_ID, writtenRegions, refreshedAt: new Date().toISOString() });
}
