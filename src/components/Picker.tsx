"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

export interface PickerOption {
  value: string;
  label: ReactNode;
  /** 选项左侧的装饰（如国旗），与 label 对齐 */
  leading?: ReactNode;
}

interface PickerProps {
  value: string;
  onChange: (value: string) => void;
  options: PickerOption[];
  /** 触发器内容（当前选中项的简短展示，不含箭头） */
  trigger: ReactNode;
  ariaLabel?: string;
  /** 面板最小宽度 */
  panelMinWidth?: number;
  /** 触发器样式：pill 胶囊（默认）/ text 文字链接 */
  variant?: "pill" | "text";
}

/**
 * Apple 风自定义下拉：磨砂面板 + 选中项打勾 + 键盘导航。
 * 替代原生 <select>，让 header 的语种/币种切换与系统级 picker 视觉一致。
 */
export function Picker({
  value,
  onChange,
  options,
  trigger,
  ariaLabel,
  panelMinWidth = 200,
  variant = "pill",
}: PickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );

  // 点击外部 / Esc 关闭
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // 打开时把选中项滚进视野
  useEffect(() => {
    if (!open) return;
    const el = panelRef.current?.querySelector<HTMLElement>(
      `[data-idx="${selectedIndex}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [open, selectedIndex]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!open) return;
    const items = panelRef.current?.querySelectorAll<HTMLElement>("[data-idx]");
    if (!items?.length) return;
    const list = Array.from(items);
    const current = list.findIndex((el) => el === document.activeElement);
    let next = current;
    if (e.key === "ArrowDown") {
      next = current < 0 ? 0 : (current + 1) % list.length;
    } else if (e.key === "ArrowUp") {
      next = current <= 0 ? list.length - 1 : current - 1;
    } else {
      return;
    }
    e.preventDefault();
    list[next]?.focus();
  };

  const triggerCls =
    variant === "text"
      ? `inline-flex items-center gap-1 text-xs font-semibold transition-colors ${
          open
            ? "text-[var(--color-primary-focus)]"
            : "text-[var(--color-ink)] hover:text-[var(--color-ink-48)]"
        }`
      : `inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] px-2.5 py-1.5 text-xs font-semibold transition-colors ${
          open
            ? "bg-[var(--color-parchment)]"
            : "bg-white hover:bg-[var(--color-parchment)]"
        }`;

  return (
    <div ref={rootRef} className="relative" onKeyDown={onKeyDown}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={triggerCls}
      >
        {trigger}
        <i
          className={`ph ph-caret-down text-[10px] text-[var(--color-ink-48)] transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div
          ref={panelRef}
          role="listbox"
          className="picker-panel absolute right-0 top-[calc(100%+8px)] z-50 max-h-[min(360px,calc(100vh-80px))] overflow-y-auto rounded-[14px] border border-black/[0.06] bg-white p-1.5 shadow-[0_6px_24px_rgba(0,0,0,0.10),0_1px_4px_rgba(0,0,0,0.06)]"
        >
          {options.map((opt, i) => {
            const selected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={selected}
                data-idx={i}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 rounded-[9px] px-2.5 py-[7px] text-left text-[13px] leading-tight transition-colors hover:bg-[var(--color-parchment)] focus:bg-[var(--color-parchment)] focus:outline-none ${
                  selected
                    ? "font-semibold text-[var(--color-ink)]"
                    : "font-medium text-[var(--color-ink-80)]"
                }`}
              >
                {opt.leading != null && (
                  <span className="flex h-4 w-5 items-center justify-center">
                    {opt.leading}
                  </span>
                )}
                <span className="flex-1 truncate">{opt.label}</span>
                {selected && (
                  <i className="ph-bold ph-check text-[13px] text-[var(--color-primary-focus)]" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
