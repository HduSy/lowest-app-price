"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { AppSortKey } from "@/lib/db";
import { parseAppInput } from "@/lib/parse-input";

export function AppsToolbar({
  country,
  initialQ,
  initialSort,
}: {
  country: string;
  initialQ: string;
  initialSort: AppSortKey;
}) {
  const router = useRouter();
  const t = useTranslations("AppsToolbar");
  const [input, setInput] = useState(initialQ);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addAppStoreUrl, setAddAppStoreUrl] = useState<string | null>(null);
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
        if (resp.status === 401) throw new Error(t("loginRequired"));
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
              if (e.key === "Enter" && parsedInput && !adding) handleDirectAdd();
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

        {/* 粘贴了 App ID/链接时显示"添加到库"按钮 */}
        {parsedInput && (
          <button
            type="button"
            onClick={handleDirectAdd}
            disabled={adding}
            className="flex shrink-0 items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-primary-focus)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:opacity-50"
          >
            {adding ? (
              <>
                <span className="spinner" /> {t("adding")}
              </>
            ) : (
              <>
                <i className="ph ph-plus text-base" /> {t("addToLibrary")}
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
    </div>
  );
}
