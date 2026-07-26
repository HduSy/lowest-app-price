import { json } from "@/lib/api-response";
import { getDb, listRegions } from "@/lib/db";

// 公开静态数据，无需登录
export async function GET() {
  try {
    const db = await getDb();
    const items = await listRegions(db);
    return json({ items });
  } catch (e) {
    return json(
      { error: e instanceof Error ? e.message : String(e) },
      500
    );
  }
}
