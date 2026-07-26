// 一次性回填：对现有 prices 行用 detectPeriod 重算 period 列
// 鉴权：登录用户 role=admin，或提供 ADMIN_TOKEN（兜底）
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { detectPeriod } from "@/lib/crawler";
import { json, error } from "@/lib/api-response";
import { auth } from "@/lib/auth";
import type { SubscriptionPeriod } from "@/lib/types";

export async function GET(req: NextRequest) {
  // 鉴权：登录用户 role=admin，或提供正确的 ADMIN_TOKEN（兜底）
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

  const db = await getDb();
  const rows = await db
    .prepare("SELECT app_id, region_code, iap_key, iap_name FROM prices")
    .all<{ app_id: string; region_code: string; iap_key: string; iap_name: string }>();

  let updated = 0;
  const byPeriod: Record<string, number> = {};
  for (const r of rows.results) {
    const period: SubscriptionPeriod = detectPeriod(r.iap_name);
    await db
      .prepare(
        "UPDATE prices SET period = ?1 WHERE app_id = ?2 AND region_code = ?3 AND iap_key = ?4"
      )
      .bind(period, r.app_id, r.region_code, r.iap_key)
      .run();
    updated++;
    const key = period ?? "null";
    byPeriod[key] = (byPeriod[key] ?? 0) + 1;
  }

  return json({ total: rows.results.length, updated, byPeriod });
}
