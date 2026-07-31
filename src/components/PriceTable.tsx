"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import type { PriceRow } from "@/lib/types";
import { aggregatePrices, computeFreeCount } from "@/lib/compare";
import { isAppPurchaseName } from "@/lib/iap-constants";
import { useCurrency } from "@/lib/app-store";
import type { AppViewAuth } from "@/lib/entitlement";
import { startCheckout } from "@/lib/paddle";
import { ShareButton } from "./ShareButton";
import { LockedBanner } from "./price-table/LockedBanner";
import { IapTabs } from "./price-table/IapTabs";
import { IapPriceList } from "./price-table/IapPriceList";

// 弹窗仅在点击解锁/购买时才需要：懒加载，避免 next-auth/react + checkout 逻辑
// 进入详情页的初始包（详情页首屏只需价格表，弹窗是交互副作用）。
const LoginDialog = dynamic(
  () => import("./LoginDialog").then((m) => m.LoginDialog),
  { ssr: false }
);
const PricingDialog = dynamic(
  () => import("./PricingDialog").then((m) => m.PricingDialog),
  { ssr: false }
);

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
      await startCheckout(window.location.href);
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
                  <i className="ph ph-arrow-clockwise" aria-hidden="true" />{" "}
                  {t("forceRefresh")}
                </>
              )}
            </button>
          )}
          {activeIap && activeIap.lowest && (
            <ShareButton
              text={t("shareText", {
                name: isAppPurchaseName(activeIap.name) ? t("appPurchaseTier") : activeIap.name,
                price: activeIap.lowest.convertedDisplay,
                region: activeIap.lowest.region.name_en,
              })}
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

function LegendDot({ className }: { className: string }) {
  return <span className={`inline-block h-2 w-2 rounded-full ${className}`} />;
}
