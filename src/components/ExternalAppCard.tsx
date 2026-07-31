"use client";

// 外部搜索结果卡片（iTunes Search 兜底场景）
// 与 AppCard 视觉对齐，但不跳转（详情页还不存在），右侧改为「添加」按钮
// 点击 -> POST /api/apps -> 成功后跳详情页 / 失败显示错误
// 会员/付费可点添加；未登录点击弹 LoginDialog，A 版已登录未付费弹 PricingDialog
// 若 isIndexed（理论上兜底场景下不会发生），按钮变「查看」直接跳详情页
import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ExternalSearchItem } from "@/lib/types";
import { startCheckout } from "@/lib/paddle";

// 弹窗仅在点击"添加"且需要登录/付费引导时才需要：懒加载。
const LoginDialog = dynamic(
  () => import("./LoginDialog").then((m) => m.LoginDialog),
  { ssr: false }
);
const PricingDialog = dynamic(
  () => import("./PricingDialog").then((m) => m.PricingDialog),
  { ssr: false }
);

type Status = "idle" | "adding" | "error";

export function ExternalAppCard({
  item,
  country,
  canAddApp,
  loggedIn,
}: {
  item: ExternalSearchItem;
  country: string;
  /** 是否有添加权限（会员/付费）；false 时按钮锁定态，点击弹窗 */
  canAddApp: boolean;
  /** 是否已登录（决定锁定态点击弹登录框还是付费框） */
  loggedIn: boolean;
}) {
  const router = useRouter();
  const t = useTranslations("ExternalAppCard");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [appStoreUrl, setAppStoreUrl] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  // 实际发起添加请求（已有权限时调用）
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
        // 兜底：session 过期(401)弹登录，权限变化(403)弹付费
        if (resp.status === 401) {
          setStatus("idle");
          setLoginOpen(true);
          return;
        }
        if (resp.status === 403) {
          setStatus("idle");
          setPricingOpen(true);
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

  // 点击“添加”：有权限走添加；未登录弹登录框；A 版已登录未付费弹付费框
  function handleAddClick(e: React.MouseEvent) {
    if (canAddApp) {
      void handleAdd(e);
      return;
    }
    e.preventDefault();
    e.stopPropagation();
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
      await startCheckout(window.location.href);
    } catch (e) {
      setUnlockError(e instanceof Error ? e.message : "Purchase failed");
    } finally {
      setUnlocking(false);
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
            {item.developer || t("developerUnknown")}
            {item.category ? ` · ${item.category}` : ""}
          </div>
        </div>
        <span className="shrink-0 text-xs font-medium text-[var(--color-ink-48)]">
          {t("indexed")}
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
            {item.developer || t("developerUnknown")}
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
          onClick={handleAddClick}
          disabled={status === "adding"}
          className={
            canAddApp
              ? "flex shrink-0 items-center gap-1 rounded-full bg-[var(--color-primary-focus)] px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:opacity-50"
              : "flex shrink-0 items-center gap-1 rounded-full bg-[var(--color-parchment)] px-3.5 py-1.5 text-xs font-semibold text-[var(--color-ink-48)] transition-colors hover:bg-[rgba(0,113,227,0.06)] hover:text-[var(--color-primary-focus)] disabled:opacity-50"
          }
        >
          {status === "adding" ? (
            <>
              <span className="spinner" /> {t("adding")}
            </>
          ) : canAddApp ? (
            <>
              <i className="ph ph-plus text-sm" /> {t("add")}
            </>
          ) : (
            <>
              <i className="ph ph-lock-key text-sm" /> {t("add")}
            </>
          )}
        </button>
      </div>
      {loginOpen && (
        <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} purpose="add" />
      )}
      <PricingDialog
        open={pricingOpen}
        onClose={() => setPricingOpen(false)}
        onBuy={handleBuy}
        buying={unlocking}
        error={unlockError}
      />
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
        className="h-12 w-12 shrink-0 rounded-[var(--radius-md)] object-cover"
      />
    );
  }
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-tile)] text-white">
      <i className="ph ph-app-window text-lg" />
    </div>
  );
}
