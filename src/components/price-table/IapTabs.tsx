// IAP 档位 Tab：locked 时第 freeCount+ 个套餐显示锁图标，点击触发解锁
import { useRef, useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { isAppPurchaseName } from "@/lib/iap-constants";

export function IapTabs({
  iaps,
  activeKey,
  onChange,
  locked,
  freeCount,
  onLockedClick,
}: {
  iaps: { key: string; name: string }[];
  activeKey: string | null;
  onChange: (key: string) => void;
  locked: boolean;
  freeCount: number;
  onLockedClick: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);
  const t = useTranslations("PriceTable");

  const syncScrollState = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  };

  useEffect(() => {
    syncScrollState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iaps]);

  if (iaps.length === 0) return null;

  const scrollByDir = (dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  return (
    <div className="mb-5">
      <h3 className="mb-2.5 text-[13px] font-semibold text-[var(--color-ink-48)]">
        {t("tierLabel")}
      </h3>
      <div className="relative">
        <div
          ref={scrollRef}
          onScroll={syncScrollState}
          className="flex gap-0.5 overflow-x-auto rounded-[9px] bg-[#ededf0] p-[2px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
           {iaps.map((iap, idx) => {
             const active = iap.key === activeKey;
             // 非会员 locked：前 freeCount 个（最便宜）解锁，其余锁定
             const isLocked = locked && idx >= freeCount;
             return (
               <button
                 key={iap.key}
                 onClick={() => (isLocked ? onLockedClick() : onChange(iap.key))}
                 className={`flex shrink-0 items-center gap-1 rounded-[7px] px-3.5 py-[6px] text-[13px] font-medium transition-all duration-200 ease-out ${
                   isLocked
                     ? "text-[var(--color-ink-48)] opacity-50 hover:opacity-100"
                     : active
                     ? "bg-white text-[var(--color-ink)] shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                     : "text-[var(--color-ink-48)] hover:text-[var(--color-ink-80)]"
                 }`}
               >
                 {isLocked && <i className="ph ph-lock-key text-[11px]" />}
                 <span className="whitespace-nowrap">{isAppPurchaseName(iap.name) ? t("appPurchaseTier") : iap.name}</span>
               </button>
             );
           })}
        </div>

        {/* 左侧渐隐 + 箭头，到最首时整体渐隐 */}
        <div
          className={`pointer-events-none absolute left-0 top-0 z-10 flex h-full w-10 items-center rounded-l-[9px] bg-gradient-to-r from-[#ededf0] via-[#ededf0]/60 to-transparent transition-opacity duration-200 ${
            canLeft ? "opacity-100" : "opacity-0"
          }`}
        >
          <button
            type="button"
            onClick={() => scrollByDir(-1)}
            aria-label={t("prevTier")}
            className="pointer-events-auto ml-1 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.12)] transition-colors hover:bg-[var(--color-parchment)]"
          >
            <i className="ph ph-caret-left text-[12px]" />
          </button>
        </div>

        {/* 右侧渐隐 + 箭头，到最尾时整体渐隐 */}
        <div
          className={`pointer-events-none absolute right-0 top-0 z-10 flex h-full w-10 items-center justify-end rounded-r-[9px] bg-gradient-to-l from-[#ededf0] via-[#ededf0]/60 to-transparent transition-opacity duration-200 ${
            canRight ? "opacity-100" : "opacity-0"
          }`}
        >
          <button
            type="button"
            onClick={() => scrollByDir(1)}
            aria-label={t("nextTier")}
            className="pointer-events-auto mr-1 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.12)] transition-colors hover:bg-[var(--color-parchment)]"
          >
            <i className="ph ph-caret-right text-[12px]" />
          </button>
        </div>
      </div>
    </div>
  );
}
