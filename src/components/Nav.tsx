"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { REGIONS, REGION_MAP } from "@/lib/regions";
import { Picker } from "./Picker";
import { useCurrency, useLanguage } from "@/lib/app-store";
import { LANGUAGES, languageOption } from "@/lib/languages";
import { currencyNames } from "@/lib/currencies";
import type { Language } from "@/lib/languages";
import { LoginDialog } from "./LoginDialog";
import { UserMenu } from "./UserMenu";
import { LogoMark } from "./Logo";

// 可切换的币种列表（35 地区去重 + 排序）
const CURRENCY_OPTIONS = [...new Set(REGIONS.map((r) => r.currency))].sort();

// 相对路径链接（会自动拼上当前 URL country 前缀，仅用于浏览区导航）
const REL_LINKS = [
  { path: "", label: "首页" },
  { path: "/apps", label: "应用" },
  { path: "/#regions", label: "地区" },
  { path: "/#pricing", label: "价格" },
  { path: "/#faq", label: "常见问题" },
];

export interface NavUser {
  id: string;
  name: string | null;
  image: string | null;
  email: string | null;
  paid: boolean;
}

export function Nav({ user = null }: { user?: NavUser | null }) {
  const pathname = usePathname() || "/";
  // URL 段 = 浏览区（可随意输），仅用于拼 nav 链接前缀
  const segs = pathname.split("/").filter(Boolean);
  const urlCountry = segs[0] && REGION_MAP[segs[0]] ? segs[0] : "us";

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
      aria-label="主导航"
    >
      <div className="mx-auto flex h-full max-w-[1024px] items-center justify-center gap-6 px-[22px]">
        <Link
          href={`/${urlCountry}`}
          className="brand flex items-center gap-2 font-semibold"
        >
          <LogoMark size={22} />
        </Link>

        {/* 导航链接：间距 24px，每个链接左右 padding 8px */}
        {REL_LINKS.map((l) => {
          const href = `/${urlCountry}${l.path}`;
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
              {l.label}
            </Link>
          );
        })}

        <Picker
          ariaLabel="界面语种"
          variant="text"
          value={language}
          onChange={(v) => setLanguage(v as Language)}
          options={LANGUAGES.map((l) => ({
            value: l.code,
            label: l.label,
          }))}
          trigger={<span>{langOpt.label}</span>}
        />

        <Picker
          ariaLabel="展示币种"
          variant="text"
          value={currency}
          onChange={setCurrency}
          options={CURRENCY_OPTIONS.map((c) => ({
            value: c,
            label: currencyNames[c] ? (
              <span className="flex items-center gap-2">
                <span className="font-semibold">{c}</span>
                <span className="text-[var(--color-ink-48)]">{currencyNames[c]}</span>
              </span>
            ) : (
              c
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
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setLoginOpen(true)}
            className={navTextCls}
            aria-label="登录"
          >
            登录
          </button>
        )}
      </div>

      <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
    </nav>
  );
}
