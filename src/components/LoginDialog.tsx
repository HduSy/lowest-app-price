"use client";

// 登录弹窗：居中 Modal + 半透明 backdrop，复用 Picker 视觉 token
// 三个 OAuth 按钮（Google / X / GitHub），Esc + 点 backdrop 关闭
// 用 createPortal 渲染到 document.body，避免祖先 backdrop-blur 创建包含块导致 fixed 定位偏移
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { signIn } from "next-auth/react";
import { GoogleIcon, XIcon, GitHubIcon } from "./BrandIcons";

interface LoginDialogProps {
  open: boolean;
  onClose: () => void;
}

export function LoginDialog({ open, onClose }: LoginDialogProps) {
  // Esc 关闭 + 锁定背景滚动
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleSignIn = (provider: string) => {
    signIn(provider, { callbackUrl: window.location.href });
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex cursor-pointer items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="登录"
    >
      <div
        className="picker-panel w-[min(380px,calc(100vw-32px))] cursor-default rounded-[18px] bg-white p-7 shadow-[0_12px_48px_rgba(0,0,0,0.18)]"
        style={{ transformOrigin: "center" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <i className="ph ph-lock-key text-[28px] text-[var(--color-primary-focus)]" />
          <h2 className="mt-2 text-[20px] font-semibold leading-tight">
            登录后，看到完整价格
          </h2>
          <p className="mt-1.5 text-[13px] text-[var(--color-ink-48)]">
            每天 3 次免费 · 或 $1.99 永久买断
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => handleSignIn("google")}
            className="flex w-full items-center justify-center gap-3 rounded-full border border-black/[0.08] bg-white px-5 py-3 text-[15px] font-medium transition-colors hover:bg-[var(--color-parchment)]"
          >
            <GoogleIcon size={18} />
            使用 Google 登录
          </button>
          <button
            type="button"
            onClick={() => handleSignIn("twitter")}
            className="flex w-full items-center justify-center gap-3 rounded-full bg-black px-5 py-3 text-[15px] font-medium text-white transition-colors hover:bg-[#111]"
          >
            <XIcon size={15} />
            使用 X 登录
          </button>
          <button
            type="button"
            onClick={() => handleSignIn("github")}
            className="flex w-full items-center justify-center gap-3 rounded-full bg-[#24292e] px-5 py-3 text-[15px] font-medium text-white transition-colors hover:bg-[#1a1e22]"
          >
            <GitHubIcon size={18} />
            使用 GitHub 登录
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full text-center text-[13px] text-[var(--color-ink-48)] transition-colors hover:text-[var(--color-ink)]"
        >
          稍后再说
        </button>
      </div>
    </div>,
    document.body
  );
}
