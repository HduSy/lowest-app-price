"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { PriceRow } from "@/lib/types";
import { aggregatePrices, computeFreeCount } from "@/lib/compare";
import { formatCurrency } from "@/lib/currencies";
import { useCurrency, usePricingVariant } from "@/lib/app-store";
import type { AppViewAuth } from "@/lib/entitlement";
import { DAILY_VIEW_LIMIT } from "@/lib/entitlement";
import { Flag } from "./Flag";
import { LoginDialog } from "./LoginDialog";
import { PricingDialog } from "./PricingDialog";
import { ShareButton } from "./ShareButton";

// admin refresh 端点返回结构（保持与 /api/admin/refresh-prices 一致）
type RefreshResponse = {
  app?: {
    name: string;
    developer: string | null;
    icon_url: string | null;
    subtitle: string | null;
    priceLabel: string | null;
    compatibility: string[] | null;
    genres: string[] | null;
    last_fetched_at: string | null;
  };
  prices?: PriceRow[];
  iaps?: { key: string; name: string }[];
};

export function PriceTable({
  prices: initialPrices,
  iaps: initialIaps,
  cached: cachedProp,
  lastFetchedAt,
  appId,
  auth: initialAuth,
  needsRefresh,
  isAdmin,
  onAppRefreshed,
}: {
  prices: PriceRow[];
  iaps: { key: string; name: string }[];
  cached: boolean;
  lastFetchedAt?: string | null;
  appId: string;
  auth: AppViewAuth;
  needsRefresh?: boolean;
  isAdmin?: boolean;
  onAppRefreshed?: (app: {
    name: string;
    developer: string | null;
    icon_url: string | null;
    subtitle: string | null;
    priceLabel: string | null;
    compatibility: string[] | null;
    genres: string[] | null;
    last_fetched_at: string | null;
  }) => void;
}) {
  const t = useTranslations("PriceTable");
  const currency = useCurrency((s) => s.currency);
  const [prices, setPrices] = useState<PriceRow[]>(initialPrices);
  const [iaps, setIaps] = useState(initialIaps);
  // cached 升级为 state：两条刷新路径（stale 自动 + admin 手动）成功后都切到 false，
  // 否则按钮点的"强制刷新"在 UI 上毫无反馈（标签永远停在 SSR 渲染的"上次更新"灰底态）
  const [cached, setCached] = useState(cachedProp);
  const [agg, setAgg] = useState<Awaited<ReturnType<typeof aggregatePrices>> | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 当前激活的 IAP 档位 key
  const [activeIapKey, setActiveIapKey] = useState<string | null>(null);

  // 鉴权状态：初始来自 server，解锁后客户端更新
  const [auth, setAuth] = useState(initialAuth);
  const [loginOpen, setLoginOpen] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // admin 手动刷新独立 loading，避免和 stale 自动刷新 spinner 撞车
  const [adminRefreshing, setAdminRefreshing] = useState(false);

  // 数据过期或首次加载时，客户端触发刷新（避免 SSR 阻塞导致点击进详情页白屏）
  useEffect(() => {
    if (!needsRefresh) return;
    let cancelled = false;
    setRefreshing(true);
    fetch(`/api/apps/${appId}/prices?force=1`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (data.prices) setPrices(data.prices);
        if (data.iaps) setIaps(data.iaps);
        if (data.auth) setAuth(data.auth);
        if (data.app && onAppRefreshed) onAppRefreshed(data.app);
        // 刚抓完全区，UI 切到"最新"绿底态
        setCached(false);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : t("refreshFailed"));
      })
      .finally(() => {
        if (!cancelled) setRefreshing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [needsRefresh, appId, t]);

  // admin 手动强制刷新：调专用端点，忽略 TTL 重新抓取全区
  const handleAdminRefresh = () => {
    setAdminRefreshing(true);
    setError(null);
    fetch(`/api/admin/refresh-prices?appId=${encodeURIComponent(appId)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        const d = data as RefreshResponse;
        if (d.prices) setPrices(d.prices);
        if (d.iaps) setIaps(d.iaps);
        if (d.app && onAppRefreshed) onAppRefreshed(d.app);
        // admin 强制刷新后同样切到"最新"绿底态
        setCached(false);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : t("refreshFailed"));
      })
      .finally(() => setAdminRefreshing(false));
  };

  // locked = 当前不可查看全量（未付费且今日未解锁此 App）
  const locked = !auth.canViewFull;
  // 可见档位数：可看全量时全部可见，否则阶梯式（1~3档->1，4档->2，5+档->3）
  const freeCount = auth.canViewFull ? iaps.length : computeFreeCount(iaps.length);
  // 仅当存在被锁档位（总档位 > 可见数）时才真正限制
  const hasLockedIaps = locked && iaps.length > freeCount;

  // 标签显示"最新/刚刚"还是"上次更新"：
  // 只有刚刷新完（cached=false）且当前没在刷新中（!refreshing）才显示绿色"刚刚"，
  // 其余情况（TTL 内未刷新 / 过期刷新中 / admin 刷新中）一律显示灰色"上次更新 + 旧时间"，
  // 避免刷新过程中"正在刷新"横幅和"最新"标签语义冲突。
  const showFresh = !cached && !refreshing && !adminRefreshing;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    aggregatePrices(prices, currency)
      .then((r) => {
        if (!cancelled) {
          setAgg(r);
          setError(null);
          // 默认选中第一个档位（按最低价升序的第一个）
          if (r.iaps.length && !r.iaps.some((i) => i.key === activeIapKey)) {
            setActiveIapKey(r.iaps[0].key);
          }
        }
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // activeIapKey 不放依赖里：避免档位切换时重新触发聚合
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prices, currency]);

  const activeIap = useMemo(
    () => agg?.iaps.find((i) => i.key === activeIapKey) ?? null,
    [agg, activeIapKey]
  );

  // 跳转 Paddle Checkout 购买 $1.99 买断
  const handleBuy = async () => {
    setUnlocking(true);
    setUnlockError(null);
    try {
      const res = await fetch("/api/paddle/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callbackUrl: window.location.href }),
      });
      if (!res.ok) throw new Error("Failed to create checkout session");
      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch (e) {
      setUnlockError(e instanceof Error ? e.message : "Purchase failed");
    } finally {
      setUnlocking(false);
    }
  };

  // 锁定档位被点击：未登录引导登录，已登录配额用完引导购买
  //（配额由 authorizeAppView 在访问时自动扣减，无需手动解锁）
  const handleLockedClick = () => {
    if (!auth.loggedIn) {
      setLoginOpen(true);
      return;
    }
    // 已登录但配额用完 -> 弹出买断定价
    setPricingOpen(true);
  };

  if (refreshing && !prices.length) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-black/[0.08] p-12 text-center">
        <div className="flex items-center justify-center gap-2 text-sm font-semibold text-[var(--color-ink-48)]">
          <span className="spinner" /> {t("initialLoadingTitle")}
        </div>
        <p className="mt-3 text-xs text-[var(--color-ink-48)]">
          {t("initialLoadingHint")}
        </p>
      </div>
    );
  }

  if (!prices.length) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-black/[0.08] p-12 text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-parchment)] text-[var(--color-ink-48)]">
          <i className="ph ph-tag text-xl" />
        </div>
        <p className="font-semibold">{t("emptyTitle")}</p>
        <p className="mt-2 text-sm text-[var(--color-ink-48)]">
          {t("emptyDesc")}
        </p>
      </div>
    );
  }

  return (
    <div>
      {refreshing && (
        <div className="mb-4 flex items-center gap-2 rounded-[var(--radius-md)] bg-[rgba(0,113,227,0.06)] px-4 py-2.5 text-sm font-semibold text-[var(--color-primary-focus)]">
          <span className="spinner" /> {t("refreshingBanner")}
        </div>
      )}
      {/* 顶部：统计 + 币种 + 缓存标签 */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-5">
          <Stat label={t("regionsStatLabel")} value={agg?.regionsCovered.length ?? 0} />
          <Stat label={t("tiersStatLabel")} value={iaps.length} />
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              showFresh
                ? "bg-[rgba(52,199,89,0.1)] text-[var(--color-green-strong)]"
                : "bg-[var(--color-parchment)] text-[var(--color-ink-48)]"
            }`}
          >
            <i className={`ph ${showFresh ? "ph-check" : "ph-clock"}`} />{" "}
            {showFresh ? t("freshLabel") : t("cachedLabel")}
            {lastFetchedAt && (
              <span className="ml-1 font-normal opacity-70">
                · {lastFetchedAt}
              </span>
            )}
          </span>
          {isAdmin && (
            <button
              type="button"
              onClick={handleAdminRefresh}
              disabled={adminRefreshing || refreshing}
              title={t("forceRefresh")}
              aria-label={t("forceRefresh")}
              className="inline-flex items-center gap-1 rounded-full bg-[var(--color-parchment)] px-3 py-1 text-xs font-semibold text-[var(--color-primary-focus)] transition-colors hover:bg-[rgba(0,113,227,0.1)] disabled:opacity-50"
            >
              {adminRefreshing ? (
                <>
                  <span className="spinner" /> {t("refreshing")}
                </>
              ) : (
                <>
                  <svg
                    width="1em"
                    height="1em"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="lucide lucide-rotate-cw"
                    aria-hidden="true"
                  >
                    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                    <path d="M21 3v5h-5" />
                  </svg>{" "}
                  {t("forceRefresh")}
                </>
              )}
            </button>
          )}
          {activeIap && activeIap.lowest && (
            <ShareButton
              text={
                `LowestAppPrice 全区比价：${activeIap.name} 最低 ${activeIap.lowest.convertedDisplay}` +
                `（${activeIap.lowest.region.name_en}）`
              }
            />
          )}
        </div>
      </div>

       {/* 锁定提示条（仅当有被锁档位时显示，避免单档位 App 出现误导性 CTA） */}
       {hasLockedIaps && (
         <LockedBanner
           auth={auth}
           unlocking={unlocking}
           error={unlockError}
           onBuy={() => setPricingOpen(true)}
           onLogin={() => setLoginOpen(true)}
         />
       )}

      {error && (
        <div className="mb-4 rounded-[var(--radius-md)] bg-[rgba(255,59,48,0.08)] px-4 py-3 text-sm text-[var(--color-red)]">
          <i className="ph ph-warning-circle" /> {error}
        </div>
      )}

      {/* IAP 档位 Tab */}
      {iaps.length > 0 && (
         <IapTabs
           iaps={iaps}
           activeKey={activeIapKey}
           onChange={setActiveIapKey}
           locked={hasLockedIaps}
           freeCount={freeCount}
           onLockedClick={handleLockedClick}
         />
      )}

      {/* 当前激活档位的地区价格表（套餐内所有地区可见）*/}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-[var(--color-ink-48)]">
          <span className="spinner" /> {t("converting")}
        </div>
      ) : activeIap ? (
        <IapPriceList
          iap={activeIap}
          currency={currency}
          appId={appId}
        />
      ) : null}

      <p className="mt-6 text-xs text-[var(--color-ink-48)]">
        {t("disclaimer", { hours: 6 })}
        <span className="ml-2 inline-flex items-center gap-1.5 align-middle">
          <LegendDot className="bg-[var(--color-green)]" /> {t("lowest")}
        </span>
        {activeIap && activeIap.entries.length >= 3 && (
          <span className="ml-2 inline-flex items-center gap-1.5 align-middle">
            <LegendDot className="bg-[var(--color-red)]" /> {t("highest")}
          </span>
        )}
      </p>

      <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
      <PricingDialog
        open={pricingOpen}
        onClose={() => setPricingOpen(false)}
        onBuy={handleBuy}
        buying={unlocking}
        error={unlockError}
      />
    </div>
  );

  function Stat({ label, value }: { label: string; value: number }) {
    return (
      <div>
        <div className="text-2xl font-semibold mono-num">{value}</div>
        <div className="text-xs text-[var(--color-ink-48)]">{label}</div>
      </div>
    );
  }
}

// 锁定提示条：未登录引导登录，配额用完引导购买
function LockedBanner({
  auth,
  unlocking,
  error,
  onBuy,
  onLogin,
}: {
  auth: AppViewAuth;
  unlocking: boolean;
  error: string | null;
  onBuy: () => void;
  onLogin: () => void;
}) {
  const t = useTranslations("PriceTable");
  const variant = usePricingVariant();
  return (
    <div className="mb-4 rounded-[var(--radius-md)] border border-[var(--color-primary-focus)]/20 bg-[rgba(0,113,227,0.06)] px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <i className="ph ph-lock-key text-[var(--color-primary-focus)]" />
          {!auth.loggedIn ? (
            <span>{variant === "B" ? t("lockedHintUnsignedB") : t("lockedHintUnsigned", { limit: DAILY_VIEW_LIMIT })}</span>
          ) : (
            <span>{t("lockedHintExhausted", { limit: DAILY_VIEW_LIMIT })}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!auth.loggedIn ? (
            <button
              type="button"
              onClick={onLogin}
              className="rounded-full bg-[var(--color-primary-focus)] px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[var(--color-primary)]"
            >
              {t("loginCta")}
            </button>
          ) : (
            <button
              type="button"
              onClick={onBuy}
              disabled={unlocking}
              className="rounded-full bg-[var(--color-primary-focus)] px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:opacity-50"
            >
              {unlocking ? <span className="spinner" /> : t("buyCta")}
            </button>
          )}
        </div>
      </div>
      {error && (
        <div className="mt-2 text-xs text-[var(--color-red)]">
          <i className="ph ph-warning-circle" /> {error}
        </div>
      )}
    </div>
  );
}

function LegendDot({ className }: { className: string }) {
  return <span className={`inline-block h-2 w-2 rounded-full ${className}`} />;
}

// ============ IAP 档位 Tab（locked 时第 freeCount+ 个套餐显示锁图标，点击触发解锁）============
function IapTabs({
  iaps,
  activeKey,
  onChange,
  locked,
  freeCount,
  onLockedClick,
}: {
  iaps: { key: string; name: string }[];
  activeKey: string | null;
  onChange: (key: string) => void;
  locked: boolean;
  freeCount: number;
  onLockedClick: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);
  const t = useTranslations("PriceTable");

  const syncScrollState = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  };

  useEffect(() => {
    syncScrollState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iaps]);

  if (iaps.length === 0) return null;

  const scrollByDir = (dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  return (
    <div className="mb-5">
      <h3 className="mb-2.5 text-[13px] font-semibold text-[var(--color-ink-48)]">
        {t("tierLabel")}
      </h3>
      <div className="relative">
        <div
          ref={scrollRef}
          onScroll={syncScrollState}
          className="flex gap-0.5 overflow-x-auto rounded-[9px] bg-[#ededf0] p-[2px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
           {iaps.map((iap, idx) => {
             const active = iap.key === activeKey;
             // 非会员 locked：前 freeCount 个（最便宜）解锁，其余锁定
             const isLocked = locked && idx >= freeCount;
             return (
               <button
                 key={iap.key}
                 onClick={() => (isLocked ? onLockedClick() : onChange(iap.key))}
                 className={`flex shrink-0 items-center gap-1 rounded-[7px] px-3.5 py-[6px] text-[13px] font-medium transition-all duration-200 ease-out ${
                   isLocked
                     ? "text-[var(--color-ink-48)] opacity-50 hover:opacity-100"
                     : active
                     ? "bg-white text-[var(--color-ink)] shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                     : "text-[var(--color-ink-48)] hover:text-[var(--color-ink-80)]"
                 }`}
               >
                 {isLocked && <i className="ph ph-lock-key text-[11px]" />}
                 <span className="whitespace-nowrap">{iap.name}</span>
               </button>
             );
           })}
        </div>

        {/* 左侧渐隐 + 箭头，到最首时整体渐隐 */}
        <div
          className={`pointer-events-none absolute left-0 top-0 z-10 flex h-full w-10 items-center rounded-l-[9px] bg-gradient-to-r from-[#ededf0] via-[#ededf0]/60 to-transparent transition-opacity duration-200 ${
            canLeft ? "opacity-100" : "opacity-0"
          }`}
        >
          <button
            type="button"
            onClick={() => scrollByDir(-1)}
            aria-label="上一个"
            className="pointer-events-auto ml-1 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.12)] transition-colors hover:bg-[var(--color-parchment)]"
          >
            <i className="ph ph-caret-left text-[12px]" />
          </button>
        </div>

        {/* 右侧渐隐 + 箭头，到最尾时整体渐隐 */}
        <div
          className={`pointer-events-none absolute right-0 top-0 z-10 flex h-full w-10 items-center justify-end rounded-r-[9px] bg-gradient-to-l from-[#ededf0] via-[#ededf0]/60 to-transparent transition-opacity duration-200 ${
            canRight ? "opacity-100" : "opacity-0"
          }`}
        >
          <button
            type="button"
            onClick={() => scrollByDir(1)}
            aria-label="下一个"
            className="pointer-events-auto mr-1 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.12)] transition-colors hover:bg-[var(--color-parchment)]"
          >
            <i className="ph ph-caret-right text-[12px]" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ 单个 IAP 档位的地区价格表（套餐内所有地区可见）============
function IapPriceList({
  iap,
  currency,
  appId,
}: {
  iap: NonNullable<Awaited<ReturnType<typeof aggregatePrices>>>["iaps"][number];
  currency: string;
  appId: string;
}) {
  const t = useTranslations("PriceTable");
  const lowest = iap.lowest;
  // 只有当至少 3 个有效条目时，才把"最高"标红--避免和最低重叠
  const validCount = iap.entries.filter(
    (e) => e.convertedAmount != null
  ).length;
  const showHighestRed = validCount >= 3;
  const highest = showHighestRed ? iap.highest : null;

  // 价差：以绝对金额展示「最低比最高省了多少钱」，比百分比更直观
  // 例：lowest=$9.99, highest=$16.80 → 省了 $6.81
  const savedAmount =
    lowest?.convertedAmount != null && iap.highest?.convertedAmount != null
      ? formatCurrency(
          iap.highest.convertedAmount - lowest.convertedAmount,
          currency
        )
      : null;

  return (
    <div className="rounded-[var(--radius-lg)] border border-black/[0.08] overflow-hidden">
      {/* 头部：档位名 + 价差摘要 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/[0.08] bg-[var(--color-parchment)] px-4 py-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold">{iap.name}</div>
          <div className="text-xs text-[var(--color-ink-48)]">
            {t("tierRegionsCount", { count: iap.entries.length })}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs">
          {lowest && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(52,199,89,0.1)] px-2.5 py-1 font-semibold text-[var(--color-green-strong)]">
              <i className="ph ph-tag" />
              {t("lowest")} {lowest.convertedDisplay}
              <span className="inline-flex items-center gap-1 font-normal">
                · <Flag code={lowest.region.code} size={14} /> {lowest.region.name_en}
              </span>
            </span>
          )}
          {highest && showHighestRed && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(255,59,48,0.08)] px-2.5 py-1 font-semibold text-[var(--color-red)]">
              <i className="ph ph-tag" />
              {t("highest")} {highest.convertedDisplay}
              <span className="inline-flex items-center gap-1 font-normal">
                · <Flag code={highest.region.code} size={14} /> {highest.region.name_en}
              </span>
            </span>
          )}
          {savedAmount != null && (
            <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-[var(--color-ink-48)]">
              {t.rich("savedHint", {
                amount: savedAmount,
                bold: (chunks) => (
                  <span className="text-sm font-bold text-[var(--color-ink)]">
                    {chunks}
                  </span>
                ),
              })}
            </span>
          )}
        </div>
      </div>

      {/* 表格头 */}
      <div className="grid grid-cols-[2rem_1fr_1fr_auto] gap-3 border-b border-[var(--color-divider)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-48)]">
        <span>#</span>
        <span>{t("colRegion")}</span>
        <span>{t("colLocalPrice")}</span>
        <span className="text-right">{t("colConverted", { currency })}</span>
      </div>
      <div>
        {iap.entries.map((e, idx) => {
          const isLowest = lowest && e.region.code === lowest.region.code;
          const isHighest =
            highest && showHighestRed && e.region.code === highest.region.code;
          const rowBg = isLowest
            ? "bg-[rgba(52,199,89,0.07)]"
            : isHighest
            ? "bg-[rgba(255,59,48,0.06)]"
            : "";
          const labelChip =
            isLowest || isHighest ? (
              <span
                className={`ml-1.5 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                  isLowest
                    ? "bg-[rgba(52,199,89,0.15)] text-[var(--color-green-strong)]"
                    : "bg-[rgba(255,59,48,0.12)] text-[var(--color-red)]"
                }`}
              >
                {isLowest ? t("lowest") : t("highest")}
              </span>
            ) : null;
          const priceColor = isLowest
            ? "text-[var(--color-green-strong)]"
            : isHighest
            ? "text-[var(--color-red)]"
            : "";
          return (
            <div
              key={e.region.code}
              className={`group grid grid-cols-[2rem_1fr_1fr_auto] items-center gap-3 px-4 py-2.5 text-sm transition-colors ${rowBg}`}
            >
              <span className="text-[var(--color-ink-48)] mono-num">
                {idx + 1}
              </span>
              <span className="flex items-center gap-2">
                <Flag code={e.region.code} size={18} />
                <span>
                  {e.region.name_en}
                  {labelChip}
                </span>
                <a
                  href={`https://apps.apple.com/${e.region.code}/app/id${appId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`View on ${e.region.name_en} App Store`}
                  aria-label={`View on ${e.region.name_en} App Store`}
                  className="inline-flex items-center text-[var(--color-ink-48)] opacity-0 transition-opacity hover:text-[var(--color-primary-focus)] group-hover:opacity-100"
                >
                  <i className="ph ph-arrow-square-out" />
                </a>
              </span>
              <span className="mono-num text-[var(--color-ink-48)]">
                {e.priceRaw}
              </span>
              <span
                className={`text-right font-semibold mono-num ${priceColor}`}
              >
                {e.convertedDisplay}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
