"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { AppSortKey } from "@/lib/db";
import { parseAppInput } from "@/lib/parse-input";

// 弹窗仅在点击"添加"且需要登录/付费引导时才需要：懒加载，减小列表页初始 JS。
const LoginDialog = dynamic(
  () => import("@/components/LoginDialog").then((m) => m.LoginDialog),
  { ssr: false }
);
const PricingDialog = dynamic(
  () => import("@/components/PricingDialog").then((m) => m.PricingDialog),
  { ssr: false }
);

export function AppsToolbar({
  country,
  initialQ,
  initialSort,
  canAddApp,
  loggedIn,
}: {
  country: string;
  initialQ: string;
  initialSort: AppSortKey;
  /** 是否有添加 App 权限（登录 && (会员 || 付费)）；false 时按钮显示为锁定态 */
  canAddApp: boolean;
  /** 是否已登录（决定锁定态点击弹登录框还是付费框） */
  loggedIn: boolean;
}) {
  const router = useRouter();
  const t = useTranslations("AppsToolbar");
  const [input, setInput] = useState(initialQ);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addAppStoreUrl, setAddAppStoreUrl] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // IME 组词标记：true 时 onChange 不触发 URL 更新，等 compositionend 才发
  const composingRef = useRef(false);

  // URL 变化时同步 input（比如用户点了浏览器后退）
  useEffect(() => {
    setInput(initialQ);
  }, [initialQ]);

  const pushUrl = useCallback(
    (q: string, sort: AppSortKey) => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      // 默认排序（rating_count）不写进 URL，保持链接简洁
      if (sort && sort !== "rating_count") params.set("sort", sort);
      const qs = params.toString();
      router.push(`/${country}/apps${qs ? `?${qs}` : ""}`);
    },
    [router, country]
  );

  const onSearchChange = (val: string) => {
    setInput(val);
    setAddError(null);
    setAddAppStoreUrl(null);
    // IME 组词中：只更新 input 显示，不发请求
    if (composingRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      pushUrl(val, initialSort);
    }, 250);
  };

  // compositionend：组词确认后立即用最终值触发一次 debounce
  const onCompositionEnd = (val: string) => {
    composingRef.current = false;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      pushUrl(val, initialSort);
    }, 250);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // 检测用户是否粘贴了 App Store 链接或纯 App ID
  const parsedInput = parseAppInput(input);

  async function handleDirectAdd() {
    if (!parsedInput) return;
    setAdding(true);
    setAddError(null);
    setAddAppStoreUrl(null);
    try {
      const resp = await fetch("/api/apps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });
      const data = (await resp.json()) as {
        error?: string;
        reason?: string;
        appStoreUrl?: string;
        duplicate?: boolean;
        app?: { app_id: string };
      };
      if (!resp.ok) {
        // 兜底：session 过期(401)弹登录，权限变化(403)弹付费
        if (resp.status === 401) {
          setAdding(false);
          setLoginOpen(true);
          return;
        }
        if (resp.status === 403) {
          setAdding(false);
          setPricingOpen(true);
          return;
        }
        // no_pricing 等带 appStoreUrl 的拒绝：保留链接供用户跳转
        if (data.appStoreUrl) setAddAppStoreUrl(data.appStoreUrl);
        throw new Error(data.error || `HTTP ${resp.status}`);
      }
      // 添加成功（或已存在）后跳转详情页，触发价格抓取
      const targetId = data.app?.app_id ?? parsedInput.appId;
      router.push(`/${country}/apps/${targetId}`);
    } catch (e) {
      setAdding(false);
      setAddError(e instanceof Error ? e.message : String(e));
    }
  }

  // 点击“添加到库”：有权限走添加；未登录弹登录框；A 版已登录未付费弹付费框
  function handleAddClick() {
    if (canAddApp) {
      void handleDirectAdd();
      return;
    }
    if (!loggedIn) {
      setLoginOpen(true);
      return;
    }
    setPricingOpen(true);
  }

  // 跳转 Paddle Checkout 购买 $1.99 买断
  async function handleBuy() {
    setUnlocking(true);
    setUnlockError(null);
    try {
      const res = await fetch("/api/paddle/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callbackUrl: window.location.href }),
      });
      if (!res.ok) throw new Error("Failed to create checkout session");
      const { url } = (await res.json()) as { url?: string };
      if (url) window.location.href = url;
    } catch (e) {
      setUnlockError(e instanceof Error ? e.message : "Purchase failed");
    } finally {
      setUnlocking(false);
    }
  }

  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <i className="ph ph-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--color-ink-48)]" />
          <input
            type="text"
            value={input}
            onChange={(e) => onSearchChange(e.target.value)}
            onCompositionStart={() => {
              composingRef.current = true;
            }}
            onCompositionEnd={(e) => {
              onCompositionEnd((e.target as HTMLInputElement).value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && parsedInput && !adding) handleAddClick();
            }}
            placeholder={t("searchPlaceholder")}
            autoCorrect="off"
            spellCheck={false}
            className="w-full rounded-[var(--radius-md)] border border-black/[0.08] bg-white py-2.5 pl-9 pr-9 text-sm outline-none transition-colors focus:border-[var(--color-primary-focus)]"
          />
          {input && !parsedInput && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-[var(--color-ink-48)] transition-colors hover:bg-[var(--color-parchment)] hover:text-[var(--color-ink)]"
              aria-label={t("clearSearch")}
            >
              <i className="ph ph-x text-sm" />
            </button>
          )}
        </div>

        {/* 粘贴了 App ID/链接时显示“添加到库”按钮：会员/付费可点，否则锁定态点击弹窗 */}
        {parsedInput && (
          <button
            type="button"
            onClick={handleAddClick}
            disabled={adding}
            className={
              canAddApp
                ? "flex shrink-0 items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-primary-focus)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:opacity-50"
                : "flex shrink-0 items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-parchment)] px-4 py-2.5 text-sm font-semibold text-[var(--color-ink-48)] transition-colors hover:bg-[rgba(0,113,227,0.06)] hover:text-[var(--color-primary-focus)] disabled:opacity-50"
            }
          >
            {adding ? (
              <>
                <span className="spinner" /> {t("adding")}
              </>
            ) : canAddApp ? (
              <>
                <i className="ph ph-plus text-base" /> {t("addToLibrary")}
              </>
            ) : (
              <>
                <i className="ph ph-lock-key text-base" /> {t("addToLibrary")}
              </>
            )}
          </button>
        )}
      </div>

      {addError && (
        <div className="mt-2 rounded-[var(--radius-md)] bg-[rgba(255,59,48,0.08)] px-4 py-2.5 text-sm text-[var(--color-red)]">
          <div className="flex items-center gap-2">
            <i className="ph ph-warning-circle shrink-0" />
            <span>{addError}</span>
          </div>
          {addAppStoreUrl && (
            <a
              href={addAppStoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-red)] underline decoration-[var(--color-red)]/40 underline-offset-2 hover:decoration-[var(--color-red)]"
            >
              {t("viewOnAppStore")}
              <i className="ph ph-arrow-square-out" />
            </a>
          )}
        </div>
      )}

      <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} purpose="add" />
      <PricingDialog
        open={pricingOpen}
        onClose={() => setPricingOpen(false)}
        onBuy={handleBuy}
        buying={unlocking}
        error={unlockError}
      />
    </div>
  );
}
