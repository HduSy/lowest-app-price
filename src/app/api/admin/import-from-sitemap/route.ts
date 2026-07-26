// GET /api/admin/import-from-sitemap?limit=50&offset=0
// 从 appstoreprice.org/sitemap.xml 批量导入 App
// 鉴权：必须 admin；QPS 控制：批量 Lookup 10 个/批，批间 sleep 300ms
import { auth } from "@/lib/auth";
import { getDb, getApp, insertApp } from "@/lib/db";
import { fetchAppsMeta, type AppMeta } from "@/lib/itunes";
import { json, error } from "@/lib/api-response";

const SITEMAP_URL = "https://appstoreprice.org/sitemap.xml";
const BATCH_SIZE = 10;
const BATCH_SLEEP_MS = 300; // 批间间隔，控制 QPS ≈ 10-15

export async function GET(req: Request) {
  // 鉴权：admin 用户，或提供 ADMIN_TOKEN（兜底）
  const session = await auth();
  const isAdmin = session?.user?.role === "admin";
  if (!isAdmin) {
    const token = new URL(req.url).searchParams.get("token");
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const ctx = getCloudflareContext();
    const env = ctx?.env as { ADMIN_TOKEN?: string } | undefined;
    if (!env?.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) {
      return error("Unauthorized", 401);
    }
  }

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") || 50), 200);
  const offset = Number(url.searchParams.get("offset") || 0);

  // 1. 拉 sitemap.xml
  let xml: string;
  try {
    const resp = await fetch(SITEMAP_URL, {
      headers: { "User-Agent": "AppStorePrice-Bot/1.0" },
    });
    if (!resp.ok) return error(`Failed to fetch sitemap: HTTP ${resp.status}`, 502);
    xml = await resp.text();
  } catch (e) {
    return error(`Failed to fetch sitemap: ${e instanceof Error ? e.message : String(e)}`, 502);
  }

  // 2. 提取 appId（/en/apps/{appId}，去重）
  const allIds = [...new Set(
    [...xml.matchAll(/\/en\/apps\/(\d+)/g)].map((m) => m[1])
  )];
  if (allIds.length === 0) {
    return error("No app IDs found in sitemap", 404);
  }

  // 3. 取 offset~offset+limit
  const batch = allIds.slice(offset, offset + limit);
  if (batch.length === 0) {
    return json({ total: allIds.length, processed: 0, imported: 0, skipped: 0, nextOffset: null, message: "No more apps to import" });
  }

  // 4. 批量 Lookup（10 个/批，批间 sleep 控制 QPS）
  const metas: Record<string, AppMeta> = {};
  for (let i = 0; i < batch.length; i += BATCH_SIZE) {
    const subBatch = batch.slice(i, i + BATCH_SIZE);
    try {
      const m = await fetchAppsMeta(subBatch);
      Object.assign(metas, m);
    } catch (e) {
      console.error("[import-from-sitemap] batch failed:", e);
    }
    // 批间 sleep（最后一批不用）
    if (i + BATCH_SIZE < batch.length) {
      await new Promise((r) => setTimeout(r, BATCH_SLEEP_MS));
    }
  }

  // 5. upsert 入库
  const db = await getDb();
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];
  for (const id of batch) {
    const meta = metas[id];
    if (!meta || !meta.name) {
      skipped++;
      continue;
    }
    // 查重：已存在则跳过
    const existing = await getApp(db, id);
    if (existing) {
      skipped++;
      continue;
    }
    try {
      await insertApp(db, {
        app_id: id,
        name: meta.name,
        developer: meta.developer,
        icon_url: meta.iconUrl,
        bundle_id: meta.bundleId,
        category: meta.category,
        genres: meta.genres,
        compatibility: meta.compatibility,
      });
      imported++;
    } catch (e) {
      errors.push(`${id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return json({
    total: allIds.length,
    processed: batch.length,
    imported,
    skipped,
    errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    nextOffset: offset + limit < allIds.length ? offset + limit : null,
  });
}
