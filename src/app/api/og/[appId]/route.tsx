import { ImageResponse } from "next/og";
import { getDb, getApp, getPrices } from "@/lib/db";
import { aggregatePrices, filterSubscriptionIaps } from "@/lib/compare";
import { REGION_MAP } from "@/lib/regions";

export const runtime = "nodejs";

export const alt = "LowestAppPrice 全区比价";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// 拉丁字体（Noto Sans），CJK 走页面 meta，卡片正文用英文/数字
async function loadFont(weight: number): Promise<ArrayBuffer> {
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=Noto+Sans:wght@${weight}&display=swap`,
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
    }
  ).then((r) => r.text());
  const m = css.match(/src:\s*url\((https:\/\/[^)]+)\)/);
  if (!m) throw new Error("font url not found");
  return fetch(m[1]).then((r) => r.arrayBuffer());
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ appId: string }> }
) {
  const { appId } = await params;
  const url = new URL(req.url);
  const iapKey = url.searchParams.get("iap") || "";
  const currency = url.searchParams.get("c") || "USD";

  const db = await getDb();
  const app = await getApp(db, appId);
  if (!app) {
    return new Response("Not found", { status: 404 });
  }

  const rawPrices = await getPrices(db, appId);
  const allPrices = filterSubscriptionIaps(rawPrices);
  const agg = await aggregatePrices(allPrices, currency);
  // 找到目标 IAP（按 key 匹配；未指定则取最便宜档位）
  const targetIap =
    agg.iaps.find((i) => i.key === iapKey) || agg.iaps[0] || null;

  if (!targetIap) {
    return new Response("No IAP data", { status: 404 });
  }

  const entries = targetIap.entries.filter(
    (e) => e.convertedAmount != null
  );
  const lowest = targetIap.lowest;
  const highest = targetIap.highest;
  const spread =
    lowest?.convertedAmount && highest?.convertedAmount
      ? Math.round(
          (highest.convertedAmount / lowest.convertedAmount - 1) * 100
        )
      : null;

  const [regular, bold] = await Promise.all([loadFont(400), loadFont(700)]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#f5f5f7",
          fontFamily: "Noto Sans, sans-serif",
          padding: "60px 64px",
        }}
      >
        {/* 顶部：App 信息 */}
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {app.icon_url ? (
            <img
              src={app.icon_url}
              width={88}
              height={88}
              style={{ borderRadius: 20 }}
              alt=""
            />
          ) : (
            <div
              style={{
                width: 88,
                height: 88,
                borderRadius: 20,
                background: "#272729",
              }}
            />
          )}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 40, fontWeight: 700, color: "#1d1d1f" }}>
              {app.name}
            </div>
            {app.developer && (
              <div style={{ fontSize: 20, color: "#7a7a7a", marginTop: 4 }}>
                {app.developer}
              </div>
            )}
          </div>
        </div>

        {/* 中间：档位 + 价差摘要 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginTop: 36,
          }}
        >
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "#1d1d1f",
              background: "white",
              padding: "10px 20px",
              borderRadius: 12,
              border: "1px solid #e0e0e0",
            }}
          >
            {targetIap.name}
          </div>
          {spread != null && (
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: "#0071e3",
              }}
            >
              最高比最低贵 {spread}%
            </div>
          )}
        </div>

        {/* 价格列表：Top 5 最低 + Top 3 最高（共 8 条，社交图适宜） */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 28,
            gap: 8,
          }}
        >
          {entries.slice(0, 8).map((e, idx) => {
            const isLow = lowest && e.region.code === lowest.region.code;
            const isHigh = highest && entries.length >= 3 && e.region.code === highest.region.code;
            const flag = REGION_MAP[e.region.code]?.flag || "🏳️";
            return (
              <div
                key={e.region.code}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: isLow
                    ? "rgba(52,199,89,0.12)"
                    : isHigh
                    ? "rgba(255,59,48,0.08)"
                    : "white",
                  padding: "12px 20px",
                  borderRadius: 10,
                  border: isLow
                    ? "1px solid rgba(52,199,89,0.3)"
                    : isHigh
                    ? "1px solid rgba(255,59,48,0.2)"
                    : "1px solid #e0e0e0",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: 12 }}
                >
                  <span style={{ fontSize: 22 }}>{flag}</span>
                  <span
                    style={{
                      fontSize: 18,
                      fontWeight: 600,
                      color: "#1d1d1f",
                    }}
                  >
                    {e.region.name_en}
                  </span>
                  {isLow && (
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#248a3d",
                        background: "rgba(52,199,89,0.2)",
                        padding: "2px 8px",
                        borderRadius: 6,
                      }}
                    >
                      LOWEST
                    </span>
                  )}
                  {isHigh && (
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#ff3b30",
                        background: "rgba(255,59,48,0.15)",
                        padding: "2px 8px",
                        borderRadius: 6,
                      }}
                    >
                      HIGHEST
                    </span>
                  )}
                </div>
                <span
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    color: isLow
                      ? "#248a3d"
                      : isHigh
                      ? "#ff3b30"
                      : "#1d1d1f",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {e.convertedDisplay}
                </span>
              </div>
            );
          })}
        </div>

        {/* 底部：站点信息 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: "auto",
            paddingTop: 20,
          }}
        >
          <div style={{ fontSize: 18, color: "#7a7a7a" }}>
            {entries.length} regions · {currency}
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#0071e3" }}>
            LowestAppPrice 全区比价
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Noto Sans", data: regular, weight: 400, style: "normal" },
        { name: "Noto Sans", data: bold, weight: 700, style: "normal" },
      ],
    }
  );
}
