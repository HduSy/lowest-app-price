import Link from "next/link";
import { getDb, listApps } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import type { App } from "@/lib/types";

/**
 * 首页「已收录的 App」滚动楼层：多排铺满。
 * - 4 排轨道铺满楼层高度，方向交替（正/反/正/反），delay 错开
 * - 取较多 App（80 条）随机打乱后分区到 4 排，每排互不重复
 * - 同一 App 在整个楼层只出现一次（跨排去重 + 排内不复制同卡）
 *   注：marquee 无缝循环要求轨道内容前后两半相同，故每排的 app 列表会被整体复制一份，
 *       但同一 App 仍只在其所在排出现，不会跨排重复。
 * - 左右渐隐遮罩
 * - group hover 同时暂停
 * 服务端渲染，静默失败--DB 不可用或无 App 时不渲染。
 */
export async function SupportedAppsSection({ country }: { country: string }) {
  const t = await getTranslations("SupportedApps");
  let apps: App[] = [];
  let total = 0;
  try {
    const db = await getDb();
    // 取 80 条（够分 4 排 × 20），随机打乱后分区，避免每次都展示同一批最新 App
    const result = await listApps(db, { limit: 80, page: 1 });
    apps = result.items;
    total = result.total;
  } catch {
    return null;
  }
  if (!apps.length) return null;

  // Fisher-Yates 随机打乱，让每次刷新首页轮播内容都不同
  for (let i = apps.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [apps[i], apps[j]] = [apps[j], apps[i]];
  }

  // 分配 App 到 4 排：分区去重（每排互不重复），同一 App 只出现在一排
  const ROW_COUNT = 4;
  const delays = [0, -67, -133, -200];
  const reverses = [false, true, false, true];
  const rows: { apps: App[]; delay: number; reverse: boolean }[] = [];

  if (apps.length >= ROW_COUNT) {
    const partitions: App[][] = Array.from({ length: ROW_COUNT }, () => []);
    apps.forEach((app, i) => partitions[i % ROW_COUNT].push(app));
    for (let r = 0; r < ROW_COUNT; r++) {
      const partition = partitions[r];
      if (partition.length === 0) continue;
      // 无缝循环（-50% translate）要求半轨 >= 视口宽度；卡片 256px，按 6 张/半轨估算
      // copies 必须为偶数，保证前后两半完全相同
      const raw = Math.max(2, Math.ceil(12 / partition.length));
      const copies = raw % 2 === 0 ? raw : raw + 1;
      rows.push({
        apps: Array.from({ length: copies }, () => partition).flat(),
        delay: delays[r],
        reverse: reverses[r],
      });
    }
  } else {
    // App 太少不分区：每排展示全部 + 多份复制保证轨道宽度
    const copies = apps.length < 4 ? 8 : 4;
    const base = Array.from({ length: copies }, () => apps).flat();
    const n = base.length;
    rows.push(
      { apps: base, delay: delays[0], reverse: reverses[0] },
      { apps: [...base].reverse(), delay: delays[1], reverse: reverses[1] },
      {
        apps: [...base].slice(Math.floor(n / 4)).concat([...base].slice(0, Math.floor(n / 4))),
        delay: delays[2],
        reverse: reverses[2],
      },
      {
        apps: [...base].slice(Math.floor(n / 2)).concat([...base].slice(0, Math.floor(n / 2))),
        delay: delays[3],
        reverse: reverses[3],
      }
    );
  }

  const duration = Math.max(100, apps.length * 4);

  return (
    <section className="overflow-hidden bg-[var(--color-parchment)] py-20">
      {/* 标题 */}
      <div className="mx-auto mb-10 max-w-[1100px] px-[22px] text-center">
        <h2 className="text-[clamp(28px,4vw,40px)] font-semibold">
          {t("title", { count: total })}
        </h2>
        <p className="mx-auto mt-2 max-w-[42ch] leading-relaxed text-[var(--color-ink-80)]">
          {t("desc")}
        </p>
      </div>

      {/* marquee 多排 */}
      <div className="relative overflow-hidden py-8">
        {/* 左右渐隐遮罩（parchment 底色） */}
        <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-24 bg-gradient-to-r from-[var(--color-parchment)] via-[var(--color-parchment)]/50 to-transparent md:w-44" />
        <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-24 bg-gradient-to-l from-[var(--color-parchment)] via-[var(--color-parchment)]/50 to-transparent md:w-44" />

        <div className="group space-y-4">
          {rows.map((row, idx) => (
            <MarqueeRow
              key={idx}
              apps={row.apps}
              country={country}
              duration={duration}
              delay={row.delay}
              reverse={row.reverse}
            />
          ))}
        </div>
      </div>

      {/* 查看全部 */}
      <div className="mt-10 text-center">
        <Link
          href={`/${country}/apps`}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--color-primary-focus)] px-6 py-2.5 text-sm font-semibold text-[var(--color-primary-focus)] transition-all hover:bg-[var(--color-primary-focus)] hover:text-white active:scale-95"
        >
          查看全部 App
          <i className="ph ph-arrow-right" />
        </Link>
      </div>
    </section>
  );
}

function MarqueeRow({
  apps,
  country,
  duration,
  delay,
  reverse,
}: {
  apps: App[];
  country: string;
  duration: number;
  delay: number;
  reverse: boolean;
}) {
  return (
    <div
      className={`flex w-max gap-4 group-hover:[animation-play-state:paused] ${
        reverse ? "animate-marquee-reverse" : "animate-marquee"
      }`}
      style={
        {
          "--marquee-duration": `${duration}s`,
          animationDelay: `${delay}s`,
        } as React.CSSProperties
      }
    >
      {apps.map((app, i) => (
        <Link
          key={`${app.app_id}-${i}`}
          href={`/${country}/apps/${app.app_id}`}
          className="group/card flex w-[240px] shrink-0 items-center gap-3 rounded-[var(--radius-lg)] border border-black/[0.08] bg-white p-4 transition-shadow hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)]"
        >
          {app.icon_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={app.icon_url}
              alt=""
              className="h-12 w-12 shrink-0 rounded-[10px] object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px] bg-[var(--color-parchment)]">
              <i className="ph ph-app-window text-xl text-[var(--color-ink-48)]" />
            </div>
          )}
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold transition-colors group-hover/card:text-[var(--color-primary-focus)]">
              {app.name}
            </div>
            {app.developer && (
              <div className="truncate text-xs text-[var(--color-ink-48)]">
                {app.developer}
              </div>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
