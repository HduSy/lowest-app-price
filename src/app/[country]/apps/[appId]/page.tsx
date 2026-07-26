import { notFound } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { headers } from "next/headers";
import { getDb, getApp, getPrices, isStale } from "@/lib/db";
import { AppDetailClient } from "@/components/AppDetailClient";
import { RelatedApps } from "@/components/RelatedApps";
import { REGION_MAP } from "@/lib/regions";
import { getCurrentUser } from "@/lib/session";
import { authorizeAppView } from "@/lib/entitlement";
import { filterPricesByAuth, extractIapMetadata, computeFreeCount, filterSubscriptionIaps } from "@/lib/compare";
import { formatUtcInTimezone } from "@/lib/format-time";

const PRICE_TTL_HOURS = 6;

export default async function AppDetailPage({
  params,
}: {
  params: Promise<{ country: string; appId: string }>;
}) {
  const { country, appId } = await params;
  // 校验 country 合法性
  if (!REGION_MAP[country]) notFound();

  // IP 检测到的真实国家 + 时区（由 middleware 注入 x-detected-country / x-detected-timezone 头）
  // 与 URL 里的 country 区分：用户可能手动切换到别的区，但图标跳转应去 IP 检测区
  const h = await headers();
  const headerCountry = h.get("x-detected-country")?.toLowerCase();
  const detectedCountry =
    headerCountry && REGION_MAP[headerCountry] ? headerCountry : country;
  // 时区：用于"上次更新"等时间字段的本地化展示（IANA，如 "Asia/Shanghai"）
  const detectedTimezone = h.get("x-detected-timezone") || null;

  const db = await getDb();

  // App 必须已在库中（通过 /api/apps 显式添加）。未收录的 App 直接 404，
  // 避免相关推荐等入口点进未收录 App 时绕过登录与噪音过滤规则自动入库。
  // 入库后 last_fetched_at 为 null -> isStale=true -> 客户端触发 35 区价格抓取
  const app = await getApp(db, appId);
  if (!app) notFound();

  // 不在 SSR 阻塞 refreshPrices：先返回现有数据渲染，客户端检测 stale 后异步刷新
  // 避免新 App 首次进详情页白屏数秒（35 区抓取耗时）
  const needFetch = isStale(app.last_fetched_at, PRICE_TTL_HOURS);

  const [refreshedApp, rawPrices] = await Promise.all([
    getApp(db, appId),
    getPrices(db, appId),
  ]);

  // 先剔除一次性购买 + 创作者订阅 + 未分类项，只保留真正的订阅档位
  // 与 /api/apps/[appId]/prices 路由保持一致，避免 SSR 与客户端刷新后视觉跳变
  // filterSubscriptionIaps 必须在 filterPricesByAuth / extractIapMetadata 之前应用
  const allPrices = filterSubscriptionIaps(rawPrices);

  // 鉴权：当前用户能否查看全量价格（付费 / 今日已解锁此 App / 配额可用）
  const currentUser = await getCurrentUser();
  const authResult = await authorizeAppView(currentUser?.id ?? null, appId);
  // 按鉴权过滤 prices（canViewFull=false 时只下发最便宜 N 档，阶梯式，防止 curl/view-source 泄露）
  const totalIaps = new Set(allPrices.map((p) => p.iap_key)).size;
  const freeCount = computeFreeCount(totalIaps);
  const prices = filterPricesByAuth(allPrices, authResult.canViewFull, freeCount);
  // 所有 IAP 元数据（用于前端渲染 tab；锁定档位价格不下发，但 tab 可见）
  const iaps = extractIapMetadata(allPrices);

  // 先用 IP 检测到的时区把"上次更新"时间转成本地时间字符串，
  // 转换失败（时区缺失/无效）时为 null，PriceTable 会回退到原始 UTC 字符串
  const lastFetchedAtLocal = formatUtcInTimezone(
    refreshedApp?.last_fetched_at ?? app.last_fetched_at,
    detectedTimezone
  );

  return (
    <main className="mx-auto max-w-[1100px] px-[22px] py-10">
      <Link
        href={`/${country}/apps`}
        className="mb-6 inline-flex items-center gap-1 text-sm text-[var(--color-primary-focus)] hover:underline"
      >
        <i className="ph ph-arrow-left" /> 返回全部 App
      </Link>

      {/* App 头部 + 价格表（客户端包裹：刷新后立即回显 app info） */}
      <AppDetailClient
        app={refreshedApp ?? app}
        prices={prices}
        iaps={iaps}
        cached={!needFetch}
        appId={appId}
        detectedCountry={detectedCountry}
        detectedTimezone={detectedTimezone}
        lastFetchedAtLocal={lastFetchedAtLocal}
        auth={authResult}
        needsRefresh={needFetch}
      />

      {/* 相关推荐 App：独立服务端组件流式加载，不阻塞主体渲染 */}
      <Suspense fallback={null}>
        <RelatedApps appId={appId} country={country} />
      </Suspense>
    </main>
  );
}
