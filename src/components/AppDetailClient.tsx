"use client";

import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
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
          <span className="pointer-events-none absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/45 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover/icon:opacity-100">
            <i className="ph ph-arrow-square-out text-[11px]" />
          </span>
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

      {/* 截图画廊：放在比价模块下方，描述上方；iPhone 截图竖向，横向滚动 + 左右箭头 */}
      {app.screenshots && app.screenshots.length > 0 && (
        <ScreenshotGallery
          screenshots={app.screenshots}
          appName={app.name}
        />
      )}

      {/* 完整描述：长文本默认折叠，点击 "展开" 显示全部 */}
      {app.description && (
        <DescriptionBlock text={app.description} />
      )}
    </>
  );
}

/** 截图画廊：横向滚动，支持鼠标拖拽，图多时显示左右箭头（与订阅档位 Tab 一致的交互） */
function ScreenshotGallery({
  screenshots,
  appName,
}: {
  screenshots: string[];
  appName: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  // 拖拽过程中的瞬时状态存 ref，避免每次 mousemove 触发 re-render
  const dragState = useRef({
    isDown: false,
    startX: 0,
    startScrollLeft: 0,
    moved: false,
  });

  const syncScrollState = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  };

  useEffect(() => {
    syncScrollState();
    // 监听容器尺寸变化（窗口缩放/布局变化），保持箭头状态准确
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => syncScrollState());
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenshots]);

  // 拖拽期间监听 window 事件，确保鼠标移出容器仍能继续拖拽
  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      const el = scrollRef.current;
      if (!el || !dragState.current.isDown) return;
      e.preventDefault();
      const walk = e.clientX - dragState.current.startX;
      if (Math.abs(walk) > 4) dragState.current.moved = true;
      el.scrollLeft = dragState.current.startScrollLeft - walk;
    };
    const onUp = () => {
      dragState.current.isDown = false;
      setIsDragging(false);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isDragging]);

  const scrollByDir = (dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  const onMouseDown = (e: ReactMouseEvent) => {
    const el = scrollRef.current;
    if (!el || e.button !== 0) return;
    dragState.current = {
      isDown: true,
      startX: e.clientX,
      startScrollLeft: el.scrollLeft,
      moved: false,
    };
    setIsDragging(true);
  };

  return (
    <section className="mt-10">
      <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-[var(--color-ink-48)]">
        预览
      </h2>
      <div className="relative">
        <div
          ref={scrollRef}
          onScroll={syncScrollState}
          onMouseDown={onMouseDown}
          className={`flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden select-none ${
            isDragging
              ? "cursor-grabbing"
              : canLeft || canRight
                ? "cursor-grab"
                : ""
          }`}
        >
          {screenshots.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={src}
              alt={`${appName} 截图 ${i + 1}`}
              loading="lazy"
              draggable={false}
              onLoad={syncScrollState}
              className="h-[420px] w-auto shrink-0 rounded-[var(--radius-md)] border border-black/[0.06] object-cover"
            />
          ))}
        </div>

        {/* 左侧箭头，到最首时整体渐隐 */}
        <div
          className={`pointer-events-none absolute left-0 top-0 z-10 flex h-full w-12 items-center transition-opacity duration-200 ${
            canLeft ? "opacity-100" : "opacity-0"
          }`}
        >
          <button
            type="button"
            onClick={() => scrollByDir(-1)}
            aria-label="上一张"
            className="pointer-events-auto ml-1 flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.15)] transition-colors hover:bg-[var(--color-parchment)]"
          >
            <i className="ph ph-caret-left text-[13px]" />
          </button>
        </div>

        {/* 右侧箭头，到最尾时整体渐隐 */}
        <div
          className={`pointer-events-none absolute right-0 top-0 z-10 flex h-full w-12 items-center justify-end transition-opacity duration-200 ${
            canRight ? "opacity-100" : "opacity-0"
          }`}
        >
          <button
            type="button"
            onClick={() => scrollByDir(1)}
            aria-label="下一张"
            className="pointer-events-auto mr-1 flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.15)] transition-colors hover:bg-[var(--color-parchment)]"
          >
            <i className="ph ph-caret-right text-[13px]" />
          </button>
        </div>
      </div>
    </section>
  );
}

/** 长描述区：默认折叠到约 6 行；只有当文本实际溢出（被 line-clamp-6 截断）时才显示「展开/收起」按钮
 *  用 scrollHeight vs clientHeight 实测，避免用字符数阈值误判（窄屏少字也可能溢出，宽屏多字也可能不溢出） */
function DescriptionBlock({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      // 展开态下无需重测：按钮已经基于之前的折叠态判定显示
      if (expanded) return;
      // 1px 容差避免子像素取整误判
      setClamped(el.scrollHeight - el.clientHeight > 1);
    };
    measure();
    // 容器尺寸变化（窗口缩放/字体加载完成）时重测
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, expanded]);

  return (
    <section className="mt-10">
      <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-[var(--color-ink-48)]">
        描述
      </h2>
      <p
        ref={ref}
        className={`whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-ink-80)] ${
          expanded ? "" : "line-clamp-6"
        }`}
      >
        {text}
      </p>
      {clamped && (
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-primary-focus)] transition-colors hover:text-[var(--color-primary)]"
          >
            {expanded ? (
              <>
                收起 <i className="ph ph-caret-up" />
              </>
            ) : (
              <>
                展开 <i className="ph ph-caret-down" />
              </>
            )}
          </button>
        </div>
      )}
    </section>
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
