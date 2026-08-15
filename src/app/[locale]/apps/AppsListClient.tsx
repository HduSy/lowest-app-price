"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { App, ExternalSearchItem } from "@/lib/types";
import type { AppSortKey } from "@/lib/db";
import { AppCard } from "@/components/AppCard";
import { ExternalAppCard } from "@/components/ExternalAppCard";
import { usePricingVariant } from "@/lib/app-store";

interface Props {
  initialItems: App[];
  initialTotal: number;
  initialHasMore: boolean;
  initialExternal: ExternalSearchItem[];
  query: string;
  sort: AppSortKey;
  locale: string;
  /** 是否有添加 App 权限（透传给 ExternalAppCard） */
  canAddApp: boolean;
  /** 是否已登录（透传给 ExternalAppCard） */
  loggedIn: boolean;
}

export function AppsListClient({
  initialItems,
  initialTotal,
  initialHasMore,
  initialExternal,
  query,
  sort,
  locale,
  canAddApp,
  loggedIn,
}: Props) {
  const [items, setItems] = useState(initialItems);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const t = useTranslations("AppsList");
  const variant = usePricingVariant();
  const [error, setError] = useState<string | null>(null);
  // 外部搜索结果：仅在本地库 0 结果时展示。SSR 已做过滤，这里直接当受控状态
  const [external, setExternal] = useState(initialExternal);
  const pageRef = useRef(1);
  const sentinelRef = useRef<HTMLDivElement>(null);
  // ref 镜像：IO 回调里读最新值，避免把 loading/hasMore 放进 IO effect 依赖
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(initialHasMore);
  // 当前在途请求的 AbortController：reset 时取消，防止旧请求覆盖新查询结果
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);
  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  // 查询条件变化时重置（首屏由 SSR 处理，这里只处理后续变化）
  useEffect(() => {
    setItems(initialItems);
    setHasMore(initialHasMore);
    setExternal(initialExternal);
    hasMoreRef.current = initialHasMore;
    pageRef.current = 1;
    // 取消在途请求，防止旧结果覆盖新查询
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
    loadingRef.current = false;
    setError(null);
  }, [initialItems, initialHasMore, initialExternal]);

  // observer 只在 query/sort 变化时重建，loading 循环不影响它
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        // 请求在途时跳过；请求完成后 loadMore 内部会主动检查是否还需要继续
        if (loadingRef.current || !hasMoreRef.current) return;
        loadMore();
      },
      { rootMargin: "200px" }
    );
    io.observe(sentinel);
    return () => io.disconnect();
    // loadMore 通过闭包读 query/sort，故依赖这两者；不依赖 loading/hasMore
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, sort]);

  async function loadMore() {
    if (loadingRef.current) return; // 双重保险：并发请求兜底
    setLoading(true);
    loadingRef.current = true;
    setError(null);
    const nextPage = pageRef.current + 1;
    // 为本次请求创建独立的 AbortController，reset 时可取消
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        limit: "30",
      });
      if (query) params.set("q", query);
      if (sort && sort !== "recent") params.set("sort", sort);
      const url = `/api/apps?${params.toString()}`;
      const resp = await fetch(url, { signal: controller.signal });
      const data = (await resp.json()) as {
        error?: string;
        items: App[];
        total: number;
      };
      if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
      setItems((prev) => {
        const next = [...prev, ...data.items];
        setHasMore(next.length < data.total);
        hasMoreRef.current = next.length < data.total;
        return next;
      });
      pageRef.current = nextPage;
    } catch (e) {
      // abort 是预期行为（查询条件变化），不当作错误展示
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      // 只清掉自己的 controller，避免被后到的请求覆盖
      if (abortRef.current === controller) abortRef.current = null;
      setLoading(false);
      loadingRef.current = false;
      // 补偿机制：请求完成后若 sentinel 仍在视窗内（用户快速滚动），主动再触发一次。
      // IO 在请求在途期间会因 loadingRef 跳过，请求完成后即使 sentinel 还在视窗内，
      // IO 也可能不会再回调（浏览器只在交叉变化时通知），这里主动检查兜底。
      if (hasMoreRef.current && sentinelRef.current) {
        const rect = sentinelRef.current.getBoundingClientRect();
        const inView = rect.top < window.innerHeight + 200; // 200 = rootMargin
        if (inView) {
          // 微任务延后，避免在 finally 同步调用导致栈过深
          Promise.resolve().then(() => loadMore());
        }
      }
    }
  }

  return (
    <>
      {items.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((app, i) => (
              <AppCard
                key={app.app_id}
                app={app}
                locale={locale}
                index={i % 30}
              />
            ))}
          </div>
          {/* 底部状态指示器：触底加载更多 / 已加载全部
              sentinel 是稳定元素，始终渲染在最后，IO 一直观察它 */}
          {loading && (
            <div className="mt-6 flex items-center justify-center gap-2 py-4 text-sm text-[var(--color-ink-48)]">
              <span className="spinner" /> {t("loadingMore")}
            </div>
          )}
          {!loading && !hasMore && (
            <div className="mt-6 py-4 text-center text-xs text-[var(--color-ink-48)]">
              {t("allLoaded", { count: items.length })}
            </div>
          )}
        </>
      )}

      {/* 本地库 0 结果时展示 Apple 目录兜底结果：用户可点「添加」走 POST /api/apps */}
      {items.length === 0 && external.length > 0 && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--color-ink-48)]">
              {t("noLocalMatch", { count: external.length })}
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {external.map((item) => (
              <ExternalAppCard
                key={item.appId}
                item={item}
                locale={locale}
                canAddApp={canAddApp}
                loggedIn={loggedIn}
              />
            ))}
          </div>
          <p className="mt-4 text-xs text-[var(--color-ink-48)]">
            {variant === "B" ? t("addHintB") : t("addHint")}
          </p>
        </div>
      )}

      {/* 哨兵：IO 观察它触发加载更多。
          下方留 60vh buffer：加载新内容时 footer 不会被反复推入/推出视窗，
          避免"footer 不断出现又消失"的抖动。 */}
      <div ref={sentinelRef} className="h-4" />
      {hasMore && <div className="h-[60vh]" aria-hidden="true" />}
      {error && (
        <div className="mt-6 rounded-[var(--radius-md)] bg-[rgba(255,59,48,0.08)] px-4 py-3 text-center text-sm text-[var(--color-red)]">
          <i className="ph ph-warning-circle" /> {error}
        </div>
      )}
    </>
  );
}
