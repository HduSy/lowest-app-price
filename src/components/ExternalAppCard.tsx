"use client";

// 外部搜索结果卡片（iTunes Search 兜底场景）
// 与 AppCard 视觉对齐，但不跳转（详情页还不存在），右侧改为「添加」按钮
// 点击 → POST /api/apps → 401 弹登录框 / 成功后跳详情页 / 失败显示错误
// 若 isIndexed（理论上兜底场景下不会发生），按钮变「查看」直接跳详情页
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ExternalSearchItem } from "@/lib/types";
import { LoginDialog } from "./LoginDialog";

type Status = "idle" | "adding" | "error";

export function ExternalAppCard({
  item,
  country,
}: {
  item: ExternalSearchItem;
  country: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [appStoreUrl, setAppStoreUrl] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);

  async function handleAdd(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (status === "adding") return;
    setStatus("adding");
    setErrorMsg(null);
    setAppStoreUrl(null);
    try {
      const resp = await fetch("/api/apps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: item.appId }),
      });
      const data = (await resp.json().catch(() => ({}))) as {
        error?: string;
        appStoreUrl?: string;
      };
      if (!resp.ok) {
        // 未登录：弹登录框，状态恢复 idle 让用户登录后重试
        if (resp.status === 401) {
          setStatus("idle");
          setLoginOpen(true);
          return;
        }
        if (data.appStoreUrl) setAppStoreUrl(data.appStoreUrl);
        throw new Error(data.error || `HTTP ${resp.status}`);
      }
      // 成功：跳详情页，触发价格抓取
      router.push(`/${country}/apps/${item.appId}`);
    } catch (e) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : String(e));
    }
  }

  // 已收录：渲染成普通跳转卡片，跟 AppCard 一致
  if (item.isIndexed) {
    return (
      <Link
        href={`/${country}/apps/${item.appId}`}
        className="group flex items-center gap-3 rounded-[var(--radius-md)] border border-black/[0.08] bg-white p-3 transition-colors hover:border-[var(--color-primary-focus)]/40 hover:bg-[var(--color-parchment)]"
      >
        <CardMedia item={item} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold">{item.name}</div>
          <div className="truncate text-xs text-[var(--color-ink-48)]">
            {item.developer || "未知开发者"}
            {item.category ? ` · ${item.category}` : ""}
          </div>
        </div>
        <span className="shrink-0 text-xs font-medium text-[var(--color-ink-48)]">
          已收录
        </span>
        <i className="ph ph-arrow-right text-[var(--color-ink-48)] transition-all duration-150 group-hover:translate-x-0.5 group-hover:text-[var(--color-primary-focus)]" />
      </Link>
    );
  }

  return (
    <>
      <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-black/[0.08] bg-white p-3">
        <CardMedia item={item} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold">{item.name}</div>
          <div className="truncate text-xs text-[var(--color-ink-48)]">
            {item.developer || "未知开发者"}
            {item.category ? ` · ${item.category}` : ""}
          </div>
          {status === "error" && errorMsg && (
            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[var(--color-red)]">
              <span className="truncate">{errorMsg}</span>
              {appStoreUrl && (
                <a
                  href={appStoreUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex shrink-0 items-center gap-0.5 font-semibold underline decoration-[var(--color-red)]/40 underline-offset-2 hover:decoration-[var(--color-red)]"
                >
                  App Store
                  <i className="ph ph-arrow-square-out" />
                </a>
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={handleAdd}
          disabled={status === "adding"}
          className="flex shrink-0 items-center gap-1 rounded-full bg-[var(--color-primary-focus)] px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:opacity-50"
        >
          {status === "adding" ? (
            <>
              <span className="spinner" /> 添加中
            </>
          ) : (
            <>
              <i className="ph ph-plus text-sm" /> 添加
            </>
          )}
        </button>
      </div>
      {loginOpen && (
        <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
      )}
    </>
  );
}

function CardMedia({ item }: { item: ExternalSearchItem }) {
  if (item.iconUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={item.iconUrl}
        alt=""
        loading="lazy"
        className="h-12 w-12 shrink-0 rounded-[var(--radius-md)]"
      />
    );
  }
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-tile)] text-white">
      <i className="ph ph-app-window text-lg" />
    </div>
  );
}
