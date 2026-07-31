// GET /api/admin/import-from-sitemap?sitemap=<URL>&limit=50&offset=0
// 从管理员指定的 sitemap.xml 批量导入 App。
// 数据源 URL 由调用方通过 `sitemap` 参数传入（不硬编码，避免绑定/暴露特定站点）。
// 鉴权：必须 admin；QPS 控制：批量 Lookup 10 个/批，批间 sleep 300ms
import { requireAdmin } from "@/lib/auth";
import { getDb, getApp, insertApp } from "@/lib/db";
import { fetchAppsMeta, type AppMeta } from "@/lib/itunes";
import { json, error } from "@/lib/api-response";

const BATCH_SIZE = 10;
const BATCH_SLEEP_MS = 300; // 批间间隔，控制 QPS ≈ 10-15

export async function GET(req: Request) {
  // 鉴权：admin 用户，或提供 ADMIN_TOKEN（兜底）
  const authResp = await requireAdmin(req);
  if (authResp) return authResp;

  const url = new URL(req.url);
  const sitemapUrl = url.searchParams.get("sitemap");
  if (!sitemapUrl) {
    return error("Missing 'sitemap' query param", 400);
  }
  // 校验：仅允许 https，避免明文传输与协议注入
  try {
    const parsed = new URL(sitemapUrl);
    if (parsed.protocol !== "https:") {
      return error("sitemap URL must use https", 400);
    }
  } catch {
    return error("Invalid sitemap URL", 400);
  }

  const limit = Math.min(Number(url.searchParams.get("limit") || 50), 200);
  const offset = Number(url.searchParams.get("offset") || 0);

  // 1. 拉 sitemap.xml（不设暴露身份的自定义 UA，用默认）
  let xml: string;
  try {
    const resp = await fetch(sitemapUrl);
    if (!resp.ok) return error(`Failed to fetch sitemap: HTTP ${resp.status}`, 502);
    xml = await resp.text();
  } catch (e) {
    return error(`Failed to fetch sitemap: ${e instanceof Error ? e.message : String(e)}`, 502);
  }

  // 2. 提取 appId：兼容多种 App 路径格式
  //    匹配 /apps/{id}、/app/{id}、/app/id{id}、/{locale}/apps/{id} 等，不绑定特定站点
  const allIds = [...new Set(
    [...xml.matchAll(/\/app(?:s?\/|\/id)(\d+)/gi)].map((m) => m[1])
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
