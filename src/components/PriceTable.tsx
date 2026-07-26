"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PriceRow } from "@/lib/types";
import { aggregatePrices, computeFreeCount } from "@/lib/compare";
import { useCurrency } from "@/lib/app-store";
import type { AppViewAuth } from "@/lib/entitlement";
import { DAILY_VIEW_LIMIT } from "@/lib/entitlement";
import { Flag } from "./Flag";
import { LoginDialog } from "./LoginDialog";
import { PricingDialog } from "./PricingDialog";

export function PriceTable({
  prices: initialPrices,
  iaps: initialIaps,
  cached,
  lastFetchedAt,
  appId,
  auth: initialAuth,
  needsRefresh,
  onAppRefreshed,
}: {
  prices: PriceRow[];
  iaps: { key: string; name: string }[];
  cached: boolean;
  lastFetchedAt?: string | null;
  appId: string;
  auth: AppViewAuth;
  needsRefresh?: boolean;
  onAppRefreshed?: (app: {
    name: string;
    developer: string | null;
    icon_url: string | null;
    subtitle: string | null;
    priceLabel: string | null;
    compatibility: string[] | null;
    genres: string[] | null;
    screenshots: string[] | null;
    description: string | null;
    last_fetched_at: string | null;
  }) => void;
}) {
  const currency = useCurrency((s) => s.currency);
  const [prices, setPrices] = useState<PriceRow[]>(initialPrices);
  const [iaps, setIaps] = useState(initialIaps);
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
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "刷新失败");
      })
      .finally(() => {
        if (!cancelled) setRefreshing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [needsRefresh, appId]);

  // locked = 当前不可查看全量（未付费且今日未解锁此 App）
  const locked = !auth.canViewFull;
  // 可见档位数：可看全量时全部可见，否则阶梯式（1~3档->1，4档->2，5+档->3）
  const freeCount = auth.canViewFull ? iaps.length : computeFreeCount(iaps.length);
  // 仅当存在被锁档位（总档位 > 可见数）时才真正限制
  const hasLockedIaps = locked && iaps.length > freeCount;

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

  // 跳转 Stripe Checkout 购买 $1.99 买断
  const handleBuy = async () => {
    setUnlocking(true);
    setUnlockError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callbackUrl: window.location.href }),
      });
      if (!res.ok) throw new Error("创建支付订单失败");
      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch (e) {
      setUnlockError(e instanceof Error ? e.message : "购买失败");
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
        <div className="flex items-center justify-center gap-2 text-sm font-semibold text-[var(--color-primary-focus)]">
          <span className="spinner" /> 正在抓取全球价格…
        </div>
        <p className="mt-3 text-xs text-[var(--color-ink-48)]">
          首次加载需抓取 35 个地区数据，约几秒
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
        <p className="font-semibold">暂无价格数据</p>
        <p className="mt-2 text-sm text-[var(--color-ink-48)]">
          可能是这款 App 没有内购或订阅（买断制或免费 App 不显示价格）。
        </p>
      </div>
    );
  }

  return (
    <div>
      {refreshing && (
        <div className="mb-4 flex items-center gap-2 rounded-[var(--radius-md)] bg-[rgba(0,113,227,0.06)] px-4 py-2.5 text-sm font-semibold text-[var(--color-primary-focus)]">
          <span className="spinner" /> 正在刷新全球价格…
        </div>
      )}
      {/* 顶部：统计 + 币种 + 缓存标签 */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-5">
          <Stat label="个地区已比价" value={agg?.regionsCovered.length ?? 0} />
          <Stat label="个订阅档位" value={iaps.length} />
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              cached
                ? "bg-[var(--color-parchment)] text-[var(--color-ink-48)]"
                : "bg-[rgba(52,199,89,0.1)] text-[var(--color-green-strong)]"
            }`}
          >
            <i className={`ph ${cached ? "ph-clock" : "ph-check"}`} />{" "}
            {cached ? "上次更新" : "最新"}
            {lastFetchedAt && (
              <span className="ml-1 font-normal opacity-70">
                · {lastFetchedAt}
              </span>
            )}
          </span>
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
          <span className="spinner" /> 换算中…
        </div>
      ) : activeIap ? (
        <IapPriceList
          iap={activeIap}
          currency={currency}
          appId={appId}
        />
      ) : null}

      <p className="mt-6 text-xs text-[var(--color-ink-48)]">
        价格每 6 小时更新一次，按当前汇率换算，仅供参考。
        <span className="ml-2 inline-flex items-center gap-1.5 align-middle">
          <LegendDot className="bg-[var(--color-green)]" /> 最低
        </span>
        {activeIap && activeIap.entries.length >= 3 && (
          <span className="ml-2 inline-flex items-center gap-1.5 align-middle">
            <LegendDot className="bg-[var(--color-red)]" /> 最高
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
  return (
    <div className="mb-4 rounded-[var(--radius-md)] border border-[var(--color-primary-focus)]/20 bg-[rgba(0,113,227,0.06)] px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <i className="ph ph-lock-key text-[var(--color-primary-focus)]" />
          {!auth.loggedIn ? (
            <span>登录后每天免费看 {DAILY_VIEW_LIMIT} 个 App 的完整价格</span>
          ) : (
            <span>今日 {DAILY_VIEW_LIMIT} 次免费额度已用完 · $1.99 永久买断后无限看</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!auth.loggedIn ? (
            <button
              type="button"
              onClick={onLogin}
              className="rounded-full bg-[var(--color-primary-focus)] px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[var(--color-primary)]"
            >
              登录
            </button>
          ) : (
            <button
              type="button"
              onClick={onBuy}
              disabled={unlocking}
              className="rounded-full bg-[var(--color-primary-focus)] px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:opacity-50"
            >
              {unlocking ? <span className="spinner" /> : "$1.99 买断"}
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
        订阅档位
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
                 <span className="truncate max-w-[20ch]">{iap.name}</span>
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
  const lowest = iap.lowest;
  // 只有当至少 3 个有效条目时，才把"最高"标红--避免和最低重叠
  const validCount = iap.entries.filter(
    (e) => e.convertedAmount != null
  ).length;
  const showHighestRed = validCount >= 3;
  const highest = showHighestRed ? iap.highest : null;

  const spread =
    lowest?.convertedAmount && iap.highest?.convertedAmount
      ? Math.round(
          (iap.highest.convertedAmount / lowest.convertedAmount - 1) * 100
        )
      : null;

  return (
    <div className="rounded-[var(--radius-lg)] border border-black/[0.08] overflow-hidden">
      {/* 头部：档位名 + 价差摘要 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/[0.08] bg-[var(--color-parchment)] px-4 py-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold">{iap.name}</div>
          <div className="text-xs text-[var(--color-ink-48)]">
            共 {iap.entries.length} 个地区
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs">
          {lowest && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(52,199,89,0.1)] px-2.5 py-1 font-semibold text-[var(--color-green-strong)]">
              <i className="ph ph-tag" />
              最低 {lowest.convertedDisplay}
              <span className="inline-flex items-center gap-1 font-normal">
                · <Flag code={lowest.region.code} size={14} /> {lowest.region.name}
              </span>
            </span>
          )}
          {highest && showHighestRed && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(255,59,48,0.08)] px-2.5 py-1 font-semibold text-[var(--color-red)]">
              <i className="ph ph-tag" />
              最高 {highest.convertedDisplay}
              <span className="inline-flex items-center gap-1 font-normal">
                · <Flag code={highest.region.code} size={14} /> {highest.region.name}
              </span>
            </span>
          )}
          {spread != null && (
            <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-[var(--color-ink-48)]">
              最高比最低贵 {spread}%
            </span>
          )}
        </div>
      </div>

      {/* 表格头 */}
      <div className="grid grid-cols-[2rem_1fr_1fr_auto] gap-3 border-b border-[var(--color-divider)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-48)]">
        <span>#</span>
        <span>地区</span>
        <span>本地价格</span>
        <span className="text-right">换算（{currency}）</span>
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
                {isLowest ? "最低" : "最高"}
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
                  {e.region.name}
                  {labelChip}
                </span>
                <a
                  href={`https://apps.apple.com/${e.region.code}/app/id${appId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`在 ${e.region.name} App Store 中查看`}
                  aria-label={`在 ${e.region.name} App Store 中查看`}
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
