import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getDb, listApps, getExistingAppIds, type AppSortKey } from "@/lib/db";
import { searchAppStore } from "@/lib/itunes";
import { AppsListClient } from "./AppsListClient";
import { AppsToolbar } from "./AppsToolbar";
import { AppsSortPicker } from "./AppsSortPicker";
import { REGION_MAP } from "@/lib/regions";
import type { ExternalSearchItem } from "@/lib/types";

const VALID_SORTS = new Set<AppSortKey>(["recent", "rating_count", "rating", "name"]);

export default async function AppsPage({
  params,
  searchParams,
}: {
  params: Promise<{ country: string }>;
  searchParams: Promise<{ q?: string; sort?: string }>;
}) {
  const { country } = await params;
  if (!REGION_MAP[country]) notFound();

  const sp = await searchParams;
  const q = sp.q || "";
  const sortRaw = sp.sort || "rating_count";
  const sort: AppSortKey = VALID_SORTS.has(sortRaw as AppSortKey)
    ? (sortRaw as AppSortKey)
    : "rating_count";
  const db = await getDb();
  const initial = await listApps(db, { q, page: 1, limit: 30, sort });

  // 本地库无结果且有查询词：调 iTunes Search 兜底，标记哪些已收录
  // 接口本身公开（无副作用），真正的鉴权在用户点「添加」走 POST /api/apps 时
  let initialExternal: ExternalSearchItem[] = [];
  if (q && initial.items.length === 0) {
    try {
      const externalRaw = await searchAppStore(q, 8);
      if (externalRaw.length > 0) {
        const existingIds = await getExistingAppIds(
          db,
          externalRaw.map((r) => r.appId)
        );
        initialExternal = externalRaw.map((r) => ({
          appId: r.appId,
          name: r.name,
          developer: r.developer,
          iconUrl: r.iconUrl,
          category: r.category,
          isIndexed: existingIds.has(r.appId),
        }));
      }
    } catch {
      // iTunes 兜底失败：静默，前端按"完全无结果"渲染
    }
  }

  const hasAnyContent = initial.items.length > 0 || initialExternal.length > 0;
  const t = await getTranslations("AppsPage");

  return (
    <main className="mx-auto min-h-[calc(100vh-52px)] max-w-[1200px] px-[22px] py-12">
      <div className="mb-6">
        <h1 className="mb-2 text-3xl font-semibold">{t("title")}</h1>
        <p className="text-[var(--color-ink-48)]">
          {t("desc")}
        </p>
      </div>

      <AppsToolbar country={country} initialQ={q} initialSort={sort} />

      <section>
        {hasAnyContent ? (
          <>
            {initial.items.length > 0 && (
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[var(--color-ink-48)]">
                  {q ? t("searchResults", { count: initial.total }) : t("totalCount", { count: initial.total })}
                </h2>
                <AppsSortPicker country={country} q={q} sort={sort} />
              </div>
            )}
            <AppsListClient
              initialItems={initial.items}
              initialTotal={initial.total}
              initialHasMore={initial.items.length < initial.total}
              initialExternal={initialExternal}
              query={q}
              sort={sort}
              country={country}
            />
          </>
        ) : (
          <div className="rounded-[var(--radius-lg)] border border-black/[0.08] p-12 text-center text-[var(--color-ink-48)]">
            {q
              ? t("noMatch", { q })
              : t("empty")}
          </div>
        )}
      </section>
    </main>
  );
}
