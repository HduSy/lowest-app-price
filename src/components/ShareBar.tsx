"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";

// SSR 兜底域名；client 端点击时取 window.location.origin（首页即站点根）
const SITE_URL = "https://lowestappprice.com";

interface Channel {
  key: string;
  icon: string;
  label: string;
  href: (url: string, text: string) => string;
}

// 6 个社交渠道：分享 URL + 文案走各平台原生的 share endpoint
const CHANNELS: Channel[] = [
  {
    key: "x",
    icon: "ph-x-logo",
    label: "X (Twitter)",
    href: (url, text) =>
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
  },
  {
    key: "facebook",
    icon: "ph-facebook-logo",
    label: "Facebook",
    href: (url) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    key: "linkedin",
    icon: "ph-linkedin-logo",
    label: "LinkedIn",
    href: (url) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  },
  {
    key: "reddit",
    icon: "ph-reddit-logo",
    label: "Reddit",
    href: (url, text) =>
      `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}`,
  },
  {
    key: "telegram",
    icon: "ph-telegram-logo",
    label: "Telegram",
    href: (url, text) =>
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  },
  {
    key: "whatsapp",
    icon: "ph-whatsapp-logo",
    label: "WhatsApp",
    href: (url, text) =>
      `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
  },
];

/**
 * 首页分享区块：一排社交图标 + 复制链接。
 * 分享的是站点根 URL（window.location.origin），不带 /{country} 段，
 * 避免把别人引流到某个具体国家区。
 */
export function ShareBar() {
  const t = useTranslations("ShareBar");
  const [copied, setCopied] = useState(false);

  // 点击时才取 url，避免 SSR/client hydration mismatch
  const getUrl = () =>
    typeof window !== "undefined" ? window.location.origin : SITE_URL;

  const openShare = useCallback((href: string) => {
    window.open(href, "_blank", "noopener,noreferrer,width=600,height=600");
  }, []);

  const copyLink = useCallback(async () => {
    const url = getUrl();
    // 优先 Clipboard API；非 HTTPS / 老浏览器会抛错，回退到 execCommand
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
        return;
      }
    } catch {
      // 落到下面的兜底
    }
    try {
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 兜底也失败时仍给反馈，避免用户点了无响应
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }, []);

  const btnCls =
    "flex h-10 w-10 items-center justify-center rounded-full border border-black/[0.08] bg-white text-[var(--color-ink-80)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--color-primary-focus)]/40 hover:text-[var(--color-primary-focus)] hover:shadow-[0_4px_14px_rgba(0,0,0,0.08)]";

  return (
    <section aria-label={t("ariaLabel")} className="px-[22px] py-16">
      <div className="mx-auto max-w-[980px] text-center">
        <h2 className="mb-2 text-[clamp(22px,3vw,30px)] font-semibold">
          {t("title")}
        </h2>
        <p className="mx-auto mb-8 max-w-[60ch] text-sm leading-relaxed text-[var(--color-ink-48)]">
          {t("subtitle")}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {CHANNELS.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => {
                const url = getUrl();
                openShare(c.href(url, t("shareText")));
              }}
              className={btnCls}
              aria-label={c.label}
            >
              <i className={`ph ${c.icon} text-[18px]`} />
            </button>
          ))}

          <div className="mx-1 h-6 w-px bg-[var(--color-divider)]" aria-hidden="true" />

          <button
            type="button"
            onClick={copyLink}
            className={btnCls}
            aria-label={t("copyLink")}
          >
            <i
              className={`ph ${
                copied
                  ? "ph-check text-[var(--color-green-strong)]"
                  : "ph-link-simple-horizontal"
              } text-[18px]`}
            />
          </button>
        </div>
      </div>
    </section>
  );
}
