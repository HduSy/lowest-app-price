import { ImageResponse } from "next/og";

export const alt = "LowestAppPrice 全区比价 - 哪国最便宜，一目了然";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// 拉丁字体（Noto Sans，单文件 ~100KB），用于卡片上的英文文案
// CJK 字体被 Google 切成上百片，运行时全量加载不现实，故卡片正文走英文，
// 中文标题/描述由页面 <title> / <meta> 提供，社媒平台会单独读取。
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

export default async function OGImage() {
  const [regular, bold] = await Promise.all([loadFont(400), loadFont(700)]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#f5f5f7",
          fontFamily: "Noto Sans, sans-serif",
        }}
      >
        {/* Logo mark */}
        <svg width="150" height="150" viewBox="0 0 32 32" style={{ marginBottom: 36 }}>
          <defs>
            <linearGradient id="og-bg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#1d1d1f" />
              <stop offset="100%" stopColor="#3a3a3c" />
            </linearGradient>
          </defs>
          <rect width="32" height="32" rx="8" fill="url(#og-bg)" />
          {/* 3 根柱子并排对比（SF Symbols chart.bar 语言），中间最矮 = 最便宜的区，纯白实色高亮（无彩色） */}
          <rect x="8" y="10" width="3.5" height="14" fill="#ffffff" opacity="0.4" rx="1.2" />
          <rect x="14" y="16" width="3.5" height="8" fill="#ffffff" rx="1.2" />
          <rect x="20" y="6" width="3.5" height="18" fill="#ffffff" opacity="0.4" rx="1.2" />
        </svg>

        <div
          style={{
            fontSize: 56,
            fontWeight: 700,
            color: "#1d1d1f",
            letterSpacing: -1,
          }}
        >
          LowestAppPrice Price Compare
        </div>
        <div style={{ fontSize: 26, color: "#7a7a7a", marginTop: 14 }}>
          Cheapest subscription region · 40 countries
        </div>

        {/* 装饰：各地区价格柱状图并排对比，最矮一根绿色 = 最便宜的区 */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 10, marginTop: 40, height: 44 }}>
          {[36, 22, 30, 14, 26].map((h, i) => (
            <div
              key={i}
              style={{
                width: 18,
                height: h,
                background: i === 3 ? "#34c759" : "#0071e3",
                opacity: i === 3 ? 1 : 0.35 + i * 0.1,
                borderRadius: 4,
              }}
            />
          ))}
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
