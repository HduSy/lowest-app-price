// GET /api/admin/cleanup-no-developer?limit=500&dryRun=1&lastId=
// 删除 developer IS NULL 的 app（iTunes Lookup 没拿到 artistName 的占位记录）
// 默认 dryRun=1 只返回待删样本；dryRun=0 才真删
// 游标分页：WHERE app_id > lastId，删除后下一轮自动跳过已删的
// 鉴权：admin 用户，或提供 ADMIN_TOKEN（兜底）
// 不声明 runtime：OpenNext for Cloudflare 默认 nodejs（已开 nodejs_compat）
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { json, error } from "@/lib/api-response";

export async function GET(req: Request) {
  // 鉴权
  const authResp = await requireAdmin(req);
  if (authResp) return authResp;

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") || 500), 1000);
  const lastId = url.searchParams.get("lastId") || "";
  const dryRun = url.searchParams.get("dryRun") !== "0";

  const db = await getDb();

  // 1. 查 developer IS NULL 的 app（游标分页）
  const rows = await db
    .prepare(
      `SELECT app_id, name, developer, category, rating_count, last_fetched_at
       FROM apps
       WHERE developer IS NULL AND app_id > ?1
       ORDER BY app_id
       LIMIT ?2`
    )
    .bind(lastId, limit)
    .all<{
      app_id: string;
      name: string;
      developer: string | null;
      category: string | null;
      rating_count: number | null;
      last_fetched_at: string | null;
    }>();

  const targets = rows.results;

  // 总数（developer IS NULL 的总数，用于判断是否清完）
  const nullCountRow = await db
    .prepare("SELECT COUNT(*) as count FROM apps WHERE developer IS NULL")
    .first<{ count: number }>();
  const remainingTotal = nullCountRow?.count ?? 0;

  if (dryRun) {
    return json({
      dryRun: true,
      remainingTotal,
      inBatch: targets.length,
      sample: targets.slice(0, 20).map((r) => ({
        app_id: r.app_id,
        name: r.name,
        category: r.category,
        rating_count: r.rating_count,
        last_fetched_at: r.last_fetched_at,
      })),
      nextLastId:
        targets.length < limit ? null : targets[targets.length - 1]?.app_id ?? null,
    });
  }

  // 2. 真删：先 prices → app_unlocks → apps
  let deleted = 0;
  for (const t of targets) {
    await db.prepare("DELETE FROM prices WHERE app_id = ?1").bind(t.app_id).run();
    await db.prepare("DELETE FROM app_unlocks WHERE app_id = ?1").bind(t.app_id).run();
    await db.prepare("DELETE FROM apps WHERE app_id = ?1").bind(t.app_id).run();
    deleted++;
  }

  // 3. 查剩余总数 + 剩余 NULL 数
  const countRow = await db.prepare("SELECT COUNT(*) as count FROM apps").first<{ count: number }>();
  const total = countRow?.count ?? 0;
  const afterNullRow = await db
    .prepare("SELECT COUNT(*) as count FROM apps WHERE developer IS NULL")
    .first<{ count: number }>();
  const remainingAfter = afterNullRow?.count ?? 0;

  const nextLastId =
    targets.length < limit ? null : targets[targets.length - 1]?.app_id ?? null;

  return json({
    dryRun: false,
    total,
    inBatch: targets.length,
    deleted,
    remainingNull: remainingAfter,
    deletedSample: targets.slice(0, 5).map((r) => ({ app_id: r.app_id, name: r.name })),
    nextLastId,
  });
}
