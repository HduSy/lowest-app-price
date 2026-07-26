import { json, error } from "@/lib/api-response";
import { getDb, getExistingAppIds } from "@/lib/db";
import { searchAppStore } from "@/lib/itunes";
import type { ExternalSearchItem } from "@/lib/types";

// GET /api/apps/search?q=&limit=
// 公开（无需登录）：本地库搜不到时的兜底，调 iTunes Search API 拉全量目录
// 不需要鉴权：浏览 Apple 目录本身无副作用；用户点「添加」时才走 POST /api/apps 触发鉴权
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const params = url.searchParams;
    const q = (params.get("q") || "").trim();
    if (!q) return json({ items: [], total: 0 });

    // 限制 1~20，避免恶意大 limit 把 iTunes 接口拉满
    const limitRaw = Number(params.get("limit") || 8);
    const limit = Math.min(20, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 8));

    // 调 Apple 公开 Search API
    const results = await searchAppStore(q, limit);
    if (results.length === 0) {
      return json({ items: [], total: 0 });
    }

    // 标记哪些已在本地库（前端据此切换"添加"/"查看"按钮）
    const db = await getDb();
    const existingIds = await getExistingAppIds(
      db,
      results.map((r) => r.appId)
    );

    const items: ExternalSearchItem[] = results.map((r) => ({
      appId: r.appId,
      name: r.name,
      developer: r.developer,
      iconUrl: r.iconUrl,
      category: r.category,
      isIndexed: existingIds.has(r.appId),
    }));

    return json({ items, total: items.length });
  } catch (e) {
    return error(e instanceof Error ? e.message : String(e), 500);
  }
}
