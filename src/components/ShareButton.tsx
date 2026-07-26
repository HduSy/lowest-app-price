"use client";

import { useState, useRef, useEffect } from "react";

interface ShareButtonProps {
  /** 分享链接（默认当前页） */
  url?: string;
  /** 分享文案 */
  text: string;
}

/**
 * 分享按钮：纯图标，点击后根据环境选择分享方式。
 * - 移动端优先 navigator.share 原生面板（自动列出所有 App）
 * - 桌面端/不支持原生 Share：弹出小面板（X / Facebook / LinkedIn / 复制链接）
 */
export function ShareButton({ url, text }: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const shareUrl = url || (typeof window !== "undefined" ? window.location.href : "");

  const cancelHide = () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  };

  // hover 触发显示，移出延迟 200ms 隐藏（留时间让用户移到面板上）
  const handleEnter = () => {
    cancelHide();
    setOpen(true);
  };
  const handleLeave = () => {
    cancelHide();
    hideTimer.current = setTimeout(() => {
      setOpen(false);
      setCopied(false);
    }, 200);
  };

  useEffect(() => {
    return () => cancelHide();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleShare = () => {
    setOpen((v) => !v);
  };

  const shareToX = () => {
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`,
      "_blank",
      "noopener,noreferrer"
    );
    setOpen(false);
  };

  const shareToFacebook = () => {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
      "_blank",
      "noopener,noreferrer"
    );
    setOpen(false);
  };

  const shareToLinkedIn = () => {
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
      "_blank",
      "noopener,noreferrer"
    );
    setOpen(false);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setOpen(false);
      }, 1500);
    } catch {
      // 忽略
    }
  };

  const btnCls =
    "flex w-full items-center gap-2.5 rounded-[9px] px-3 py-2 text-left text-[13px] font-medium transition-colors hover:bg-[var(--color-parchment)]";

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <button
        type="button"
        onClick={handleShare}
        className="flex items-center justify-center text-[var(--color-ink-48)] transition-colors hover:text-[var(--color-ink)]"
        aria-label="分享"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <i className="ph ph-share-network text-[18px]" />
      </button>

      {open && (
        <div
          className="picker-panel absolute left-full top-0 z-50 ml-2 w-max min-w-[160px] rounded-[14px] border border-black/[0.06] bg-white p-1.5 shadow-[0_6px_24px_rgba(0,0,0,0.10),0_1px_4px_rgba(0,0,0,0.06)]"
          role="menu"
        >
          <button type="button" onClick={shareToX} className={btnCls} role="menuitem">
            <i className="ph ph-x-logo text-[15px]" />
            <span>X (Twitter)</span>
          </button>
          <button type="button" onClick={shareToFacebook} className={btnCls} role="menuitem">
            <i className="ph ph-facebook-logo text-[15px]" />
            <span>Facebook</span>
          </button>
          <button type="button" onClick={shareToLinkedIn} className={btnCls} role="menuitem">
            <i className="ph ph-linkedin-logo text-[15px]" />
            <span>LinkedIn</span>
          </button>
          <div className="my-1 h-px bg-[var(--color-divider)]" />
          <button type="button" onClick={copyLink} className={btnCls} role="menuitem">
            <i className={`ph ${copied ? "ph-check text-[var(--color-green-strong)]" : "ph-link-simple-horizontal"} text-[15px]`} />
            <span>{copied ? "已复制" : "复制链接"}</span>
          </button>
        </div>
      )}
    </div>
  );
}
