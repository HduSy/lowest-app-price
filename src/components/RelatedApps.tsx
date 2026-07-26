// 相关推荐 App 区块（服务端组件）
// 从 App Store HTML 解析 "You Might Also Like" / "More by this developer" 等 shelf 里的 app 链接，
// 用 iTunes Lookup 批量补全元信息后渲染卡片。
// - 已收录：渲染为站内跳转卡片（RelatedAppCard，纯服务端 Link）
// - 未收录：渲染为 ExternalAppCard，展示「添加」按钮；未登录点击会弹 LoginDialog
import { fetchHtml, parseAppStoreHtml } from "@/lib/crawler";
import { fetchAppsMeta, type AppMeta } from "@/lib/itunes";
import { getDb, getExistingAppIds } from "@/lib/db";
import { ExternalAppCard } from "./ExternalAppCard";
import Link from "next/link";

const MAX_RELATED = 10;

export async function RelatedApps({
  appId,
  country,
}: {
  appId: string;
  country: string;
}) {
  // 抓取当前 App 在 App Store 的详情页 HTML，解析出相关推荐 app id 列表
  let relatedIds: string[] = [];
  try {
    const html = await fetchHtml(country, appId);
    const parsed = parseAppStoreHtml(html);
    // 排除当前 App 自身（Apple 页面里可能含其 canonical 链接）
    relatedIds = parsed.relatedAppIds.filter((id) => id !== appId);
  } catch {
    // HTML 抓取失败时静默不渲染（不阻塞详情页主体）
    return null;
  }

  // 保留 Apple 的原始排序，截取前 MAX_RELATED 个
  relatedIds = relatedIds.slice(0, MAX_RELATED);
  if (relatedIds.length === 0) return null;

  // 区分已收录 / 未收录（用于决定渲染成跳转卡片还是「添加」卡片）
  const db = await getDb();
  const existingIds = await getExistingAppIds(db, relatedIds);

  // iTunes Lookup 批量补全元信息（每批 10 个，一次 HTTP）
  const metaMap = await fetchAppsMeta(relatedIds);

  // 配对 appId + meta + 是否已收录，过滤掉 iTunes 未找到的 stub（name === null 或无图标）
  type Item = { appId: string; meta: AppMeta; indexed: boolean };
  const items = relatedIds
    .map((id) => ({
      appId: id,
      meta: metaMap[id],
      indexed: existingIds.has(id),
    }))
    .filter(
      (x): x is Item => !!x.meta && !!x.meta.name && !!x.meta.iconUrl
    );

  if (items.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-[var(--color-ink-48)]">
        你可能也喜欢
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((x, i) =>
          x.indexed ? (
            <RelatedAppCard
              key={x.appId}
              appId={x.appId}
              name={x.meta.name!}
              developer={x.meta.developer}
              iconUrl={x.meta.iconUrl}
              category={x.meta.category}
              country={country}
              index={i}
            />
          ) : (
            <ExternalAppCard
              key={x.appId}
              country={country}
              item={{
                appId: x.appId,
                name: x.meta.name!,
                developer: x.meta.developer,
                iconUrl: x.meta.iconUrl,
                category: x.meta.category,
                isIndexed: false,
              }}
            />
          )
        )}
      </div>
    </section>
  );
}

/** 单张推荐卡片：纯服务端 Link，无客户端 JS，视觉与 AppCard 对齐但更简洁 */
function RelatedAppCard({
  appId,
  name,
  developer,
  iconUrl,
  category,
  country,
  index,
}: {
  appId: string;
  name: string;
  developer: string | null;
  iconUrl: string | null;
  category: string | null;
  country: string;
  index: number;
}) {
  return (
    <Link
      href={`/${country}/apps/${appId}`}
      style={{ animationDelay: `${Math.min(index * 50, 400)}ms` }}
      className="group flex items-center gap-3 rounded-[var(--radius-md)] border border-black/[0.08] bg-white p-3 transition-colors hover:border-[var(--color-primary-focus)]/40 hover:bg-[var(--color-parchment)] animate-fade-up"
    >
      {iconUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={iconUrl}
          alt=""
          loading="lazy"
          className="h-12 w-12 shrink-0 rounded-[var(--radius-md)]"
        />
      ) : (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-tile)] text-white">
          <i className="ph ph-app-window text-lg" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold">{name}</div>
        <div className="truncate text-xs text-[var(--color-ink-48)]">
          {developer || "未知开发者"}
          {category ? ` · ${category}` : ""}
        </div>
      </div>
      <i className="ph ph-arrow-right text-[var(--color-ink-48)] transition-all duration-150 group-hover:translate-x-0.5 group-hover:text-[var(--color-primary-focus)]" />
    </Link>
  );
}
