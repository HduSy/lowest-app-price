// GET /api/admin/cleanup-unavailable?limit=100&lastId=
// 批量验证 DB 里的 App 是否仍可用（iTunes Lookup），删除下架/不可用的
// 游标分页：WHERE app_id > lastId，不受删除影响
// 鉴权：admin 用户，或提供 ADMIN_TOKEN（兜底）
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { json, error } from "@/lib/api-response";

const BATCH_SIZE = 10;
const BATCH_SLEEP_MS = 300;

export async function GET(req: Request) {
  // 鉴权
  const authResp = await requireAdmin(req);
  if (authResp) return authResp;

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") || 100), 500);
  const lastId = url.searchParams.get("lastId") || "";

  const db = await getDb();

  // 1. 查 DB 里的 app_id（游标分页：WHERE app_id > lastId，不受删除影响）
  const rows = await db
    .prepare("SELECT app_id FROM apps WHERE app_id > ?1 ORDER BY app_id LIMIT ?2")
    .bind(lastId, limit)
    .all<{ app_id: string }>();

  const appIds = rows.results.map((r) => r.app_id);
  if (appIds.length === 0) {
    const countRow = await db.prepare("SELECT COUNT(*) as count FROM apps").first<{ count: number }>();
    return json({ total: countRow?.count ?? 0, checked: 0, deleted: 0, nextLastId: null });
  }

  // 2. 批量 iTunes Lookup 验证可用性
  const unavailable: string[] = [];
  for (let i = 0; i < appIds.length; i += BATCH_SIZE) {
    const batch = appIds.slice(i, i + BATCH_SIZE);
    try {
      const resp = await fetch(
        `https://itunes.apple.com/lookup?id=${batch.join(",")}&country=us`
      );
      const data = (await resp.json()) as { resultCount?: number; results?: { trackId?: number }[] };
      const foundIds = new Set(
        (data.results || []).map((r) => String(r.trackId))
      );
      for (const id of batch) {
        if (!foundIds.has(id)) {
          unavailable.push(id);
        }
      }
    } catch (e) {
      console.error("[cleanup] batch check failed:", e);
    }
    if (i + BATCH_SIZE < appIds.length) {
      await new Promise((r) => setTimeout(r, BATCH_SLEEP_MS));
    }
  }

  // 3. 删除不可用的（先删 prices/app_unlocks，再删 apps）
  let deleted = 0;
  for (const id of unavailable) {
    await db.prepare("DELETE FROM prices WHERE app_id = ?1").bind(id).run();
    await db.prepare("DELETE FROM app_unlocks WHERE app_id = ?1").bind(id).run();
    await db.prepare("DELETE FROM apps WHERE app_id = ?1").bind(id).run();
    deleted++;
  }

  // 4. 查剩余总数
  const countRow = await db.prepare("SELECT COUNT(*) as count FROM apps").first<{ count: number }>();
  const total = countRow?.count ?? 0;

  const nextLastId = appIds.length < limit ? null : appIds[appIds.length - 1];
  return json({
    total,
    checked: appIds.length,
    deleted,
    unavailableSample: unavailable.slice(0, 5),
    nextLastId,
  });
}
