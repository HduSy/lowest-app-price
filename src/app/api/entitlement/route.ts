// GET /api/entitlement - 返回当前用户权益状态
// { loggedIn, paid, dailyUsed, dailyLimit, canViewFull }
import { auth } from "@/lib/auth";
import { getEntitlement } from "@/lib/entitlement";
import { json, error } from "@/lib/api-response";

export async function GET() {
  try {
    const session = await auth();
    const userId = session?.user?.id ?? null;
    const entitlement = await getEntitlement(userId);
    return json(entitlement);
  } catch (e) {
    console.error("[api/entitlement] failed:", e);
    return error("Failed to get entitlement", 500);
  }
}
