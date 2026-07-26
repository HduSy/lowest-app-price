"use client";

import { useRouter } from "next/navigation";
import type { AppSortKey } from "@/lib/db";
import { Picker, type PickerOption } from "@/components/Picker";

const SORT_OPTIONS: { value: AppSortKey; label: string }[] = [
  { value: "recent", label: "最新收录" },
  { value: "rating_count", label: "评论数最多" },
  { value: "rating", label: "评分最高" },
  { value: "name", label: "名称 A-Z" },
];

export function AppsSortPicker({
  country,
  q,
  sort,
}: {
  country: string;
  q: string;
  sort: AppSortKey;
}) {
  const router = useRouter();

  const onChange = (newSort: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    // 默认排序（rating_count）不写进 URL，保持链接简洁
    if (newSort && newSort !== "rating_count") params.set("sort", newSort);
    const qs = params.toString();
    router.push(`/${country}/apps${qs ? `?${qs}` : ""}`);
  };

  const options: PickerOption[] = SORT_OPTIONS.map((o) => ({
    value: o.value,
    label: o.label,
  }));

  const currentLabel =
    SORT_OPTIONS.find((o) => o.value === sort)?.label ?? "排序";

  return (
    <Picker
      value={sort}
      onChange={onChange}
      options={options}
      trigger={
        <span className="text-xs font-semibold text-[var(--color-ink-48)]">
          排序：<span className="text-[var(--color-ink)]">{currentLabel}</span>
        </span>
      }
      ariaLabel="排序方式"
      variant="text"
    />
  );
}
