"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { App } from "@/lib/types";

const compactNum = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function AppCard({
  app,
  country,
  index = 0,
}: {
  app: App;
  country: string;
  index?: number;
}) {
  const t = useTranslations("ExternalAppCard");
  const hasRating = app.rating != null && app.ratingCount != null && app.ratingCount > 0;

  return (
    <Link
      href={`/${country}/apps/${app.app_id}`}
      style={{ animationDelay: `${Math.min(index * 50, 500)}ms` }}
      className="group flex animate-fade-up items-center gap-3 rounded-[var(--radius-md)] border border-black/[0.08] bg-white p-3 transition-colors hover:border-[var(--color-primary-focus)]/40 hover:bg-[var(--color-parchment)]"
    >
      {app.icon_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={app.icon_url}
          alt=""
          loading="lazy"
          className="h-12 w-12 shrink-0 rounded-[var(--radius-md)] object-cover"
        />
      ) : (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-tile)] text-white">
          <i className="ph ph-app-window text-lg" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold">{app.name}</div>
        <div className="truncate text-xs text-[var(--color-ink-48)]">
          {app.developer || t("developerUnknown")}
          {app.category ? ` · ${app.category}` : ""}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
          {hasRating && (
            <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-[var(--color-ink-80)]">
              <i className="ph-fill ph-star text-[#f5a623] text-[10px]" />
              {app.rating!.toFixed(1)}
              <span className="text-[var(--color-ink-48)]">
                ({compactNum.format(app.ratingCount!)})
              </span>
            </span>
          )}
          {app.compatibility && app.compatibility.length > 0 && (
            <>
              {hasRating && <span className="text-[10px] text-[var(--color-ink-48)]">·</span>}
              {app.compatibility.map((p) => (
                <span
                  key={p}
                  className="rounded-full bg-[var(--color-parchment)] px-2 py-0.5 text-[10px] text-[var(--color-ink-48)] transition-colors duration-150 group-hover:bg-[color-mix(in_oklab,var(--color-primary-focus)_12%,white)] group-hover:text-[var(--color-primary-focus)]"
                >
                  {p}
                </span>
              ))}
            </>
          )}
        </div>
      </div>
      <i className="ph ph-arrow-right text-[var(--color-ink-48)] transition-all duration-150 group-hover:translate-x-0.5 group-hover:text-[var(--color-primary-focus)]" />
    </Link>
  );
}
