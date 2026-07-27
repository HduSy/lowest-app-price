"use client";

// 登录弹窗：居中 Modal + 半透明 backdrop，复用 Picker 视觉 token
// Google OAuth + 邮箱 Magic Link 两种登录方式
// Twitter / GitHub 暂时隐藏（OAuth Console 审核未过，恢复时把下方注释块改回即可）
// 用 createPortal 渲染到 document.body，避免祖先 backdrop-blur 创建包含块导致 fixed 定位偏移
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { signIn } from "next-auth/react";
import { GoogleIcon } from "./BrandIcons";

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

        {/* OAuth：仅展示 Google（Twitter / GitHub 等过审后再放出） */}
        <div className="mt-5 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => handleSignIn("google")}
            className="flex w-full items-center justify-center gap-3 rounded-full border border-black/[0.08] bg-white px-5 py-3 text-[15px] font-medium transition-colors hover:bg-[var(--color-parchment)]"
          >
            <GoogleIcon size={18} />
            使用 Google 登录
          </button>
          {/* Twitter / GitHub 暂时隐藏 — 恢复时取消注释：
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
          */}
        </div>

        {/* 分隔线 */}
        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-black/[0.08]" />
          <span className="text-[11px] uppercase tracking-wider text-[var(--color-ink-48)]">或</span>
          <div className="h-px flex-1 bg-black/[0.08]" />
        </div>

        <MagicLinkForm />

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

/** 邮箱 Magic Link 表单：输入邮箱 → POST /api/auth/magic/request → 显示"已发送"提示 */
function MagicLinkForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "sending") return;
    const trimmed = email.trim();
    if (!trimmed) return;
    setStatus("sending");
    setErrorMsg(null);
    try {
      const resp = await fetch("/api/auth/magic/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      // 后端无论邮箱是否存在都返回 200（防枚举），所以这里无 4xx 分支
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      setStatus("sent");
    } catch (e) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : String(e));
    }
  }

  if (status === "sent") {
    return (
      <div className="mt-5 rounded-[var(--radius-md)] bg-[rgba(52,199,89,0.08)] px-4 py-3 text-center">
        <i className="ph ph-check-circle text-[20px] text-[var(--color-green-strong)]" />
        <div className="mt-1 text-[13px] font-medium text-[var(--color-ink-80)]">
          登录链接已发送至
        </div>
        <div className="text-[14px] font-semibold text-[var(--color-ink)]">
          {email}
        </div>
        <div className="mt-1 text-[12px] text-[var(--color-ink-48)]">
          请在 15 分钟内查收邮件并点击其中的按钮登录。
        </div>
        <button
          type="button"
          onClick={() => {
            setStatus("idle");
            setEmail("");
          }}
          className="mt-2 text-[12px] font-medium text-[var(--color-primary-focus)] transition-colors hover:text-[var(--color-primary)]"
        >
          换个邮箱
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-5">
      <div className="relative">
        <i className="ph ph-envelope-simple absolute left-3.5 top-1/2 -translate-y-1/2 text-base text-[var(--color-ink-48)]" />
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          placeholder="邮箱"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={status === "sending"}
          className="w-full rounded-full border border-black/[0.08] bg-white py-3 pl-10 pr-4 text-[14px] outline-none transition-colors focus:border-[var(--color-primary-focus)] disabled:opacity-50"
        />
      </div>
      <button
        type="submit"
        disabled={status === "sending" || !email.trim()}
        className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-primary-focus)] px-5 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:opacity-50"
      >
        {status === "sending" ? (
          <>
            <span className="spinner" /> 发送中
          </>
        ) : (
          <>
            <i className="ph ph-paper-plane-tilt" /> 发送登录链接
          </>
        )}
      </button>
      {status === "error" && errorMsg && (
        <div className="mt-2 text-[12px] text-[var(--color-red)]">
          <i className="ph ph-warning-circle" /> {errorMsg}
        </div>
      )}
    </form>
  );
}
