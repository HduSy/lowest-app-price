"use client";

import { useState } from "react";
import type { App, PriceRow } from "@/lib/types";
import type { AppViewAuth } from "@/lib/entitlement";
import { PriceTable } from "./PriceTable";
import { deviceIcon } from "./icons/DeviceIcons";
import { formatUtcInTimezone } from "@/lib/format-time";

/**
 * 客户端包裹层：管理 app 状态，PriceTable 刷新后立即回显 app info 到 header。
 * 解决新 App 首次进详情页时 priceLabel / subtitle / compatibility 缺失的问题--
 * SSR 渲染空值，客户端刷新完成后通过 onAppRefreshed 回调更新 header。
 */
export function AppDetailClient({
  app: initialApp,
  prices,
  iaps,
  cached,
  appId,
  detectedCountry,
  detectedTimezone,
  lastFetchedAtLocal: initialLastFetchedAtLocal,
  auth,
  needsRefresh,
}: {
  app: App;
  prices: PriceRow[];
  iaps: { key: string; name: string }[];
  cached: boolean;
  appId: string;
  detectedCountry: string;
  detectedTimezone: string | null;
  lastFetchedAtLocal: string | null;
  auth: AppViewAuth;
  needsRefresh?: boolean;
}) {
  const [app, setApp] = useState<App>(initialApp);
  // "上次更新"本地时间字符串：SSR 阶段已转换，客户端刷新后用同一时区重新格式化
  const [lastFetchedAtLocal, setLastFetchedAtLocal] = useState<string | null>(
    initialLastFetchedAtLocal
  );

  return (
    <>
      {/* App 头部 */}
      <header className="mb-8 grid grid-cols-[auto_1fr] items-start gap-5">
        <a
          href={`https://apps.apple.com/${detectedCountry}/app/id${appId}`}
          target="_blank"
          rel="noopener noreferrer"
          title={`在 ${detectedCountry.toUpperCase()} App Store 中查看`}
          aria-label={`在 ${detectedCountry.toUpperCase()} App Store 中查看`}
          className="group/icon relative block h-28 w-28 shrink-0 overflow-hidden rounded-[var(--radius-lg)] transition-opacity hover:opacity-90"
        >
          {app.icon_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={app.icon_url}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-tile)] text-white">
              <i className="ph ph-app-window text-3xl" />
            </div>
          )}
        </a>
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold">
            {app.name}
            {app.developer && (
              <span className="ml-1.5 text-base font-normal text-[var(--color-ink-48)]">
                · {app.developer}
              </span>
            )}
          </h1>
          {app.subtitle && (
            <p className="mt-1.5 text-lg text-[var(--color-ink-80)] line-clamp-2">
              {app.subtitle}
            </p>
          )}
          {(app.priceLabel ||
            (app.genres && app.genres.length > 0)) && (
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {app.priceLabel && (
                <span className="text-sm font-semibold text-[var(--color-ink-48)]">
                  {app.priceLabel}
                </span>
              )}
              {app.genres?.map((g) => (
                <span
                  key={g}
                  className="rounded-full bg-[var(--color-parchment)] px-2.5 py-1 text-xs text-[var(--color-ink-80)]"
                >
                  {g}
                </span>
              ))}
            </div>
          )}
          {app.compatibility && app.compatibility.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {app.compatibility.map((p) => {
                const Icon = deviceIcon(p);
                return (
                  <span
                    key={p}
                    className="inline-flex items-center gap-1 rounded-full bg-[var(--color-parchment)] px-2.5 py-1 text-xs text-[var(--color-ink-80)]"
                  >
                    {Icon ? (
                      <Icon />
                    ) : (
                      <i className={`ph ${platformIcon(p)} text-sm`} />
                    )}
                    {p}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </header>

      {/* 价格表（刷新完成后通过 onAppRefreshed 回调更新上方 header） */}
      <PriceTable
        prices={prices}
        iaps={iaps}
        cached={cached}
        lastFetchedAt={lastFetchedAtLocal ?? app.last_fetched_at}
        appId={appId}
        auth={auth}
        needsRefresh={needsRefresh}
        onAppRefreshed={(updated) => {
          setApp((prev) => ({ ...prev, ...updated }));
          // 刷新拿到新的 last_fetched_at（UTC），用同一时区重新格式化本地时间
          if (updated.last_fetched_at) {
            const local = formatUtcInTimezone(
              updated.last_fetched_at,
              detectedTimezone
            );
            if (local) setLastFetchedAtLocal(local);
          }
        }}
      />
    </>
  );
}

function platformIcon(p: string): string {
  const m: Record<string, string> = {
    iPhone: "ph-device-mobile",
    iPad: "ph-device-tablet",
    Mac: "ph-laptop",
    "iPod touch": "ph-device-mobile",
    "Apple TV": "ph-television",
    "Apple Watch": "ph-watch",
  };
  return m[p] || "ph-device-mobile";
}
