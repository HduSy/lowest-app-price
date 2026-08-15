"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { REGIONS } from "@/lib/regions";
import dynamic from "next/dynamic";
import { Picker } from "./Picker";
import { useCurrency, useLanguage } from "@/lib/app-store";
import { LANGUAGES, LOCALE_CODES, languageOption } from "@/lib/languages";
import type { Language } from "@/lib/languages";

// 登录弹窗仅在用户点击"登录"时才需要：懒加载，避免 next-auth/react + createPortal
// 的 chunk 进入每个页面的初始包（首页 / 列表 / 详情都不需要它首次渲染）。
const LoginDialog = dynamic(
  () => import("./LoginDialog").then((m) => m.LoginDialog),
  { ssr: false }
);
import { UserMenu } from "./UserMenu";
import { LogoMark } from "./Logo";

// 可切换的币种列表（40 地区去重 + 排序）
const CURRENCY_OPTIONS = [...new Set(REGIONS.map((r) => r.currency))].sort();

// 相对路径链接（会自动拼上当前 URL locale 前缀，仅用于浏览区导航）
const REL_LINKS = [
  { path: "", labelKey: "home" },
  { path: "/apps", labelKey: "apps" },
  { path: "/#regions", labelKey: "regions" },
  { path: "/#pricing", labelKey: "price" },
  { path: "/#faq", labelKey: "faq" },
];

export interface NavUser {
  id: string;
  name: string | null;
  image: string | null;
  email: string | null;
  paid: boolean;
  member: boolean;
}

export function Nav({ user = null }: { user?: NavUser | null }) {
  const t = useTranslations("Nav");
  const tCur = useTranslations("Currencies");
  const pathname = usePathname() || "/";
  // URL 段 = 语言码；不在 locale 白名单时（如 /about 豁免页）仅作链接前缀兜底 "en"
  const segs = pathname.split("/").filter(Boolean);
  const onLocalePage = segs.length > 0 && LOCALE_CODES.includes(segs[0]);
  const urlLocale = onLocalePage ? segs[0] : "en";

  // 全局展示币种 + 语种（用户可在 header 切换）
  const currency = useCurrency((s) => s.currency);
  const setCurrency = useCurrency((s) => s.setCurrency);
  const language = useLanguage((s) => s.language);
  const setLanguage = useLanguage((s) => s.setLanguage);
  const langOpt = languageOption(language);

  const [loginOpen, setLoginOpen] = useState(false);

  // 统一文字链接样式（nav-links / 语种 / 币种 / 价格 / 登录 共用）
  const navTextCls = "text-xs font-semibold text-[var(--color-ink)] transition-colors hover:text-[var(--color-ink-48)]";

  return (
    <nav
      className="sticky top-0 z-50 h-[52px] border-b border-black/[0.08] backdrop-blur-xl"
      style={{ background: "rgba(245,245,247,0.8)" }}
      aria-label={t("mainNav")}
    >
      <div className="mx-auto flex h-full max-w-[1024px] items-center justify-center gap-6 px-[22px]">
        <Link
          href={`/${urlLocale}`}
          className="brand flex items-center gap-2 font-semibold"
        >
          <LogoMark size={22} />
        </Link>

        {/* 导航链接：间距 24px，每个链接左右 padding 8px */}
        {REL_LINKS.map((l) => {
          const href = `/${urlLocale}${l.path}`;
          const relPath = "/" + segs.slice(1).join("/");
          const active =
            l.path === ""
              ? segs.length <= 1
              : relPath === l.path || relPath.startsWith(l.path + "/");
          return (
            <Link
              key={l.path}
              href={href}
              className={`hidden px-2 md:inline ${
                active
                  ? "text-xs font-semibold text-[var(--color-primary-focus)]"
                  : navTextCls
              }`}
            >
              {t(l.labelKey)}
            </Link>
          );
        })}

        <Picker
          ariaLabel={t("languagePicker")}
          variant="text"
          value={language}
          onChange={(v) => {
            const next = v as Language;
            setLanguage(next);
            // URL 段承载语种（SEO 关键）：切语言 = 换首段整页导航，
            // SSR 用新 URL + cookie 渲染对应语种。
            // setLanguage 内部不直接导航（避免 useEffect 恢复 prefs 时死循环）
            if (onLocalePage && urlLocale !== next) {
              const rest = segs.length > 1 ? "/" + segs.slice(1).join("/") : "";
              const qs = window.location.search;
              window.location.assign(`/${next}${rest}${qs}`);
            } else {
              // 豁免页（/about 等）无语言段可换：cookie 驱动，reload 重读即可
              setTimeout(() => window.location.reload(), 0);
            }
          }}
          options={LANGUAGES.map((l) => ({
            value: l.code,
            label: l.label,
          }))}
          trigger={
            <>
              <i className="ph-bold ph-translate text-[13px]" />
              <span>{langOpt.label}</span>
            </>
          }
        />

        <Picker
          ariaLabel={t("currencyPicker")}
          variant="text"
          value={currency}
          onChange={setCurrency}
          options={CURRENCY_OPTIONS.map((c) => ({
            value: c,
            label: (
              <span className="flex items-center gap-2">
                <span className="font-semibold">{c}</span>
                <span className="text-[var(--color-ink-48)]">{tCur(c)}</span>
              </span>
            ),
          }))}
          trigger={<span>{currency}</span>}
        />

        {user ? (
          <UserMenu
            user={{
              name: user.name,
              image: user.image,
              email: user.email,
              paid: user.paid,
              member: user.member,
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setLoginOpen(true)}
            className={navTextCls}
            aria-label={t("login")}
          >
            {t("login")}
          </button>
        )}
      </div>

      <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
    </nav>
  );
}
