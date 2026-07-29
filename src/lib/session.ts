// Server-side session helper：在 Server Component / Route Handler 里拿当前登录用户
import { auth } from "./auth";
import { getEntitlement } from "./entitlement";

export interface CurrentUser {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
  role: string;
  paid: boolean;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const ent = await getEntitlement(session.user.id);
  return {
    id: session.user.id,
    email: session.user.email ?? null,
    name: session.user.name ?? null,
    image: session.user.image ?? null,
    role: session.user.role ?? "user",
    paid: ent.paid,
  };
}
