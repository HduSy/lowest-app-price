// 相关推荐 App 区块（服务端组件）
// 从 App Store HTML 解析 "You Might Also Like" / "More by this developer" 等 shelf 里的 app 链接，
// 用 iTunes Lookup 批量补全元信息后渲染卡片。
// - 已收录：渲染为站内跳转卡片（RelatedAppCard，纯服务端 Link）
// - 未收录：渲染为 ExternalAppCard，展示「添加」按钮；会员/付费可点，否则锁定态点击弹窗
//
// 注意：iTunes Lookup API (itunes.apple.com) 在 Cloudflare Workers 上被 Apple 按出口 IP 段 403 拦截，
// 但 apps.apple.com 详情页 HTML 可以正常抓取。所以这里并发抓每个推荐 App 的 HTML 解析 meta，
// 完全绕开 itunes.apple.com。
import { fetchHtml, parseAppStoreHtml } from "@/lib/crawler";
import { getDb, getExistingAppIds } from "@/lib/db";
import { ExternalAppCard } from "./ExternalAppCard";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/session";
import Link from "next/link";

const MAX_RELATED = 10;
// 并发抓推荐 App HTML 的 worker 数（太多会被 Apple 限流，太少会慢）
const FETCH_CONCURRENCY = 5;

type RelatedMeta = {
  name: string;
  developer: string | null;
  iconUrl: string | null;
};

/** 并发抓 appIds 的 HTML 解析 meta，限并发避免被 Apple 限流 */
async function fetchRelatedMeta(
  appIds: string[],
  country: string
): Promise<Record<string, RelatedMeta>> {
  const out: Record<string, RelatedMeta> = {};
  let cursor = 0;
  async function worker() {
    while (cursor < appIds.length) {
      const id = appIds[cursor++];
      try {
        const html = await fetchHtml(country, id);
        const parsed = parseAppStoreHtml(html);
        if (parsed.name) {
          out[id] = {
            name: parsed.name,
            developer: parsed.developer,
            iconUrl: parsed.iconUrl,
          };
        }
      } catch {
        // 单个失败不影响其他：该 id 不写入 out，后续被过滤掉
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(FETCH_CONCURRENCY, appIds.length) }, () =>
      worker()
    )
  );
  return out;
}

export async function RelatedApps({
  appId,
  country,
}: {
  appId: string;
  country: string;
}) {
  // 添加 App 是会员专属：SSR 算出 canAddApp 传给 ExternalAppCard
  const currentUser = await getCurrentUser();
  const loggedIn = !!currentUser;
  const canAddApp = loggedIn && (currentUser!.paid || currentUser!.member);

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

  // 并发抓每个推荐 App 的 HTML 解析 meta（绕过被 Workers 封禁的 itunes.apple.com）
  const metaMap = await fetchRelatedMeta(relatedIds, country);

  // 配对 appId + meta + 是否已收录，过滤掉没抓到 name 的（HTML 抓取失败或 404）
  type Item = { appId: string; meta: RelatedMeta; indexed: boolean };
  const items = relatedIds
    .map((id) => ({
      appId: id,
      meta: metaMap[id],
      indexed: existingIds.has(id),
    }))
    .filter((x): x is Item => !!x.meta && !!x.meta.name);

  if (items.length === 0) return null;

  const t = await getTranslations("RelatedApps");

  return (
    <section className="mt-10">
      <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-[var(--color-ink-48)]">
        {t("title")}
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((x, i) =>
          x.indexed ? (
            <RelatedAppCard
              key={x.appId}
              appId={x.appId}
              name={x.meta.name}
              developer={x.meta.developer}
              iconUrl={x.meta.iconUrl}
              category={null}
              country={country}
              index={i}
            />
          ) : (
            <ExternalAppCard
              key={x.appId}
              country={country}
              canAddApp={canAddApp}
              loggedIn={loggedIn}
              item={{
                appId: x.appId,
                name: x.meta.name,
                developer: x.meta.developer,
                iconUrl: x.meta.iconUrl,
                category: null,
                isIndexed: false,
              }}
            />
          )
        )}
      </div>
    </section>
  );
}

/** 加载占位：「你可能也喜欢」流式加载期间的提示，跟订阅比价区同款 spinner 风格。 */
export async function RelatedAppsSkeleton() {
  const t = await getTranslations("RelatedApps");
  return (
    <section className="mt-10">
      <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-[var(--color-ink-48)]">
        {t("title")}
      </h2>
      <div className="rounded-[var(--radius-lg)] border border-black/[0.08] p-12 text-center">
        <div className="flex items-center justify-center gap-2 text-sm font-semibold text-[var(--color-ink-48)]">
          <span className="spinner" /> {t("loading")}
        </div>
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
          className="h-12 w-12 shrink-0 rounded-[var(--radius-md)] object-cover"
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
