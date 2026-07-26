"use client";

import { useEffect, useRef, useState } from "react";
import { formatCurrency } from "@/lib/currencies";

type FormatType =
  | "integer"
  | "percent-negative"
  | "percent-positive"
  | "currency";

function formatValue(val: number, type: FormatType, currency?: string): string {
  switch (type) {
    case "percent-negative":
      return `-${Math.round(val)}`;
    case "percent-positive":
      return `+${Math.round(val)}`;
    case "currency":
      return currency ? formatCurrency(val, currency) : String(Math.round(val));
    default:
      return String(Math.round(val));
  }
}

/**
 * 数字滚动动效：元素进入视口时从 0 缓动（ease-out cubic）到目标值。
 * SSR 渲染最终值（对无 JS / 爬虫友好），客户端 hydrate 后触发动画。
 * 遵循 prefers-reduced-motion。
 */
export function AnimatedNumber({
  value,
  duration = 1100,
  format = "integer",
  currency,
}: {
  value: number;
  duration?: number;
  format?: FormatType;
  currency?: string;
}) {
  const [display, setDisplay] = useState(value);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const rafRef = useRef<number | null>(null);

  // 元素进入视口才触发
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const from = 0;
    const to = value;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (to - from) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else setDisplay(to);
    };
    setDisplay(from);
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [visible, value, duration]);

  return <span ref={ref}>{formatValue(display, format, currency)}</span>;
}
