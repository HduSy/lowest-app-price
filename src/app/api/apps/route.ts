import { json, error } from "@/lib/api-response";
import { getDb, listApps, insertApp, getApp, type AppSortKey } from "@/lib/db";
import { parseAppInput } from "@/lib/parse-input";
import { fetchAppMeta } from "@/lib/itunes";
import { auth } from "@/lib/auth";
import { getEntitlement } from "@/lib/entitlement";

const VALID_SORTS = new Set<AppSortKey>(["recent", "rating_count", "rating", "name"]);

// GET /api/apps?q=&page=&limit=&sort=
// 公开列表，无需登录
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const params = url.searchParams;
    const sortRaw = params.get("sort") || "rating_count";
    const sort: AppSortKey = VALID_SORTS.has(sortRaw as AppSortKey)
      ? (sortRaw as AppSortKey)
      : "rating_count";
    const db = await getDb();
    const result = await listApps(db, {
      q: params.get("q") || "",
      page: Number(params.get("page") || 1),
      limit: Number(params.get("limit") || 60),
      sort,
    });
    return json(result);
  } catch (e) {
    return json(
      { error: e instanceof Error ? e.message : String(e) },
      500
    );
  }
}

// POST /api/apps  { input: "appid 或链接" }
// 解析 -> 查重 -> iTunes Lookup 拿基本信息 -> 入库
// 鉴权：必须登录 + 会员或付费（B 版=登录即会员；A 版=付费用户）
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return error("Unauthorized", 401);
    }
    // 会员门控：仅 member（B 版登录即会员）或 paid（A 版买断）可添加
    const ent = await getEntitlement(session.user.id);
    if (!ent.member && !ent.paid) {
      return error("Member only", 403);
    }
    const body = (await req.json().catch(() => ({}))) as { input?: string };
    const parsed = parseAppInput(body.input || "");
    if (!parsed) {
      return error("Invalid input. Paste an App Store link or a plain App ID.", 400);
    }
    const appId = parsed.appId;

    const db = await getDb();

    // 查重
    const existing = await getApp(db, appId);
    if (existing) {
      return json({ ok: true, duplicate: true, app: existing });
    }

    // 抓基本信息（iTunes Lookup：稳）
    const meta = await fetchAppMeta(appId);
    if (!meta.name) {
      return error(
        "Apple API didn't find this App. Please double-check the App ID.",
        404
      );
    }

    await insertApp(db, {
      app_id: appId,
      name: meta.name,
      developer: meta.developer,
      icon_url: meta.iconUrl,
      bundle_id: meta.bundleId,
      category: meta.category,
      genres: meta.genres,
      compatibility: meta.compatibility,
      rating: meta.rating,
      ratingCount: meta.ratingCount,
    });

    const app = await getApp(db, appId);
    return json({ ok: true, duplicate: false, app });
  } catch (e) {
    return json(
      { error: e instanceof Error ? e.message : String(e) },
      500
    );
  }
}
