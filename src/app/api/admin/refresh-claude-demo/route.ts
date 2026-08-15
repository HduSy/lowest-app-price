// 定时刷新首页 Claude 演示区价格数据
// 用法：外部 cron 定时调用此端点（如每 6 小时），或在部署后手动触发一次
// 鉴权：登录用户 role=admin，或提供 ADMIN_TOKEN
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { json, error } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth";
import { refreshPrices } from "@/app/[locale]/apps/[appId]/refresh";

const CLAUDE_APP_ID = "6473753684";

export async function GET(req: NextRequest) {
  // 鉴权
  const authResp = await requireAdmin(req);
  if (authResp) return authResp;

  const priorityCountry = req.nextUrl.searchParams.get("country") || "us";
  const db = await getDb();
  const { writtenRegions } = await refreshPrices(db, CLAUDE_APP_ID, priorityCountry);

  return json({ appId: CLAUDE_APP_ID, writtenRegions, refreshedAt: new Date().toISOString() });
}
