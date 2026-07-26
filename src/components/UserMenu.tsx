"use client";

// 用户菜单：复用 Picker 弹层模式（absolute 定位 + 磨砂白 + Esc/外部点击关闭）
// 显示头像/首字母 + 用户信息 + 退出按钮
// 会员状态：paid=true 显示会员版（蓝色 + 光泽动画），否则免费版
import { useState, useRef, useEffect } from "react";
import { signOut } from "next-auth/react";
import { Avatar } from "./Avatar";

interface UserMenuProps {
  user: {
    name: string | null;
    image: string | null;
    email: string | null;
    paid: boolean;
  };
}

export function UserMenu({ user }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const displayName = user.name || user.email || "用户";
  const badge = user.paid
    ? { cls: "bg-[rgba(0,113,227,0.1)] text-[var(--color-primary-focus)]", icon: "ph-crown", label: "会员版" }
    : { cls: "bg-[var(--color-parchment)] text-[var(--color-ink-48)]", icon: "ph-gift", label: "免费版" };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-xs font-semibold text-[var(--color-ink)] transition-colors hover:text-[var(--color-ink-48)]"
        aria-label="账户菜单"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="max-w-[120px] truncate">{displayName}</span>
        <i className="ph ph-caret-down text-[10px] opacity-60" />
      </button>

      {open && (
        <div
          className="picker-panel absolute right-0 top-[calc(100%+8px)] z-50 w-[240px] rounded-[14px] border border-black/[0.06] bg-white p-1.5 shadow-[0_6px_24px_rgba(0,0,0,0.10),0_1px_4px_rgba(0,0,0,0.06)]"
          role="menu"
        >
          <div className="flex items-center justify-between gap-3 px-3 py-2.5">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className={`truncate text-[14px] font-semibold ${user.paid ? "shimmer-text" : "text-[var(--color-ink)]"}`}>
                  {displayName}
                </div>
                <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.cls}`}>
                  <i className={`ph ${badge.icon} text-[10px]`} />
                  {badge.label}
                </span>
              </div>
              {user.email && (
                <div className="mt-0.5 truncate text-[12px] text-[var(--color-ink-48)]">
                  {user.email}
                </div>
              )}
            </div>
            <Avatar src={user.image} name={displayName} size={40} />
          </div>
          <div className="my-1 h-px bg-[var(--color-divider)]" />
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: window.location.href })}
            className="flex w-full items-center gap-2.5 rounded-[9px] px-3 py-2 text-left text-[13px] font-medium text-[var(--color-ink-80)] transition-colors hover:bg-[var(--color-parchment)]"
            role="menuitem"
          >
            <i className="ph ph-sign-out text-[15px]" />
            退出登录
          </button>
        </div>
      )}
    </div>
  );
}
