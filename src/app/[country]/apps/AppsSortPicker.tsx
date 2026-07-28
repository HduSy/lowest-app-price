"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { AppSortKey } from "@/lib/db";
import { Picker, type PickerOption } from "@/components/Picker";

const SORT_KEYS: AppSortKey[] = ["recent", "rating_count", "rating", "name"];

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
  const t = useTranslations("AppsSort");

  const onChange = (newSort: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (newSort && newSort !== "rating_count") params.set("sort", newSort);
    const qs = params.toString();
    router.push(`/${country}/apps${qs ? `?${qs}` : ""}`);
  };

  const options: PickerOption[] = SORT_KEYS.map((key) => ({
    value: key,
    label: t(key),
  }));

  const currentLabel = t(sort);

  return (
    <Picker
      value={sort}
      onChange={onChange}
      options={options}
      trigger={
        <span className="text-xs font-semibold text-[var(--color-ink-48)]">
          {t("sortBy")}: <span className="text-[var(--color-ink)]">{currentLabel}</span>
        </span>
      }
      ariaLabel={t("sortByLabel")}
      variant="text"
    />
  );
}
