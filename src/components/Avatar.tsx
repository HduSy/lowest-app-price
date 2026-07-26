"use client";

import { useState } from "react";

/**
 * 头像组件：优先展示图片，加载失败（429 防盗链 / URL 过期 / 网络错误）回退到首字母圆形。
 * Google lh3.googleusercontent.com 头像常有 429 防盗链问题，必须有兜底。
 */
export function Avatar({
  src,
  name,
  size = 40,
  className = "",
}: {
  src: string | null;
  name: string;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const initial = (name || "?").charAt(0).toUpperCase();

  // 图片 URL 存在且未失败：尝试加载图片
  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        onError={() => setFailed(true)}
        className={`shrink-0 rounded-full object-cover ${className}`}
        style={{ width: size, height: size }}
        referrerPolicy="no-referrer"
      />
    );
  }

  // 兜底：蓝色底 + 白色首字母
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-focus)] font-semibold text-white ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}
