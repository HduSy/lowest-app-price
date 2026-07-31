// 预渲染默认 OG image 到 public/og.png（由 package.json 的 prebuild 钩子调用）。
// 复用 src/app/opengraph-image.tsx 的渲染逻辑，用 next/og 的 ImageResponse 生成 1200×630 PNG。
// 目的：产出带 .png 扩展名、无查询串、无 RSC vary 的纯静态文件，规避 X/Twitter 爬虫
// 对动态 /opengraph-image route（extensionless + ?hash）的静默降级。
//
// 用 react 的 createElement 手写元素树（而非 JSX），避免 .tsx 编译依赖，
// 脚本可被 `node scripts/generate-og.mjs` 直接运行，无需 tsx loader。
import { createElement } from "react";
import { createRequire } from "node:module";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// next/og 是 CJS 模块（module.exports = require('./dist/server/og/image-response')），
// ESM 无法直接 import "next/og"，用 createRequire 走 CJS 解析。
const require = createRequire(import.meta.url);
const { ImageResponse } = require("next/og");

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SIZE = { width: 1200, height: 630 };

// 拉丁字体（Noto Sans），与 opengraph-image.tsx 的 loadFont 保持一致
async function loadFont(weight) {
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

// 复刻 opengraph-image.tsx 的 JSX 结构。改这里时同步改 route 文件（或反过来）。
function renderOGTree() {
  // 16 根柱：最矮（绿=最便宜）在第 6 位，最高（红=最贵）在第 10 位，两者靠近中间
  const bars = [64, 88, 50, 78, 42, 30, 56, 70, 48, 82, 100, 66, 92, 58, 76, 44];
  // 最矮 = 最便宜（绿），最高 = 最贵（红）
  const LOW_IDX = 5;   // 高度 30，全场最矮
  const HIGH_IDX = 10; // 高度 100，全场最高
  return createElement(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#f5f5f7",
        fontFamily: "Noto Sans, sans-serif",
        padding: "48px 64px",
      },
    },
    // 顶部 header bar：图标 + 品牌名（左上角）
    createElement(
      "div",
      { style: { display: "flex", alignItems: "center", gap: 16 } },
      // Logo mark
      createElement(
        "svg",
        { width: 48, height: 48, viewBox: "0 0 32 32" },
        createElement(
          "defs",
          null,
          createElement(
            "linearGradient",
            { id: "og-bg", x1: "0", y1: "0", x2: "1", y2: "1" },
            createElement("stop", { offset: "0%", stopColor: "#1d1d1f" }),
            createElement("stop", { offset: "100%", stopColor: "#3a3a3c" })
          )
        ),
        createElement("rect", { width: 32, height: 32, rx: 8, fill: "url(#og-bg)" }),
        createElement("rect", { x: 8, y: 10, width: 3.5, height: 14, fill: "#ffffff", opacity: 0.4, rx: 1.2 }),
        createElement("rect", { x: 14, y: 16, width: 3.5, height: 8, fill: "#ffffff", rx: 1.2 }),
        createElement("rect", { x: 20, y: 6, width: 3.5, height: 18, fill: "#ffffff", opacity: 0.4, rx: 1.2 })
      ),
      createElement(
        "div",
        { style: { fontSize: 26, fontWeight: 700, color: "#1d1d1f", letterSpacing: -0.3 } },
        "LowestAppPrice - App Store Compare"
      )
    ),
    // 主区域：居中
    createElement(
      "div",
      {
        style: {
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        },
      },
      // 主标题（= 首页 hero 大标题）
      createElement(
        "div",
        { style: { fontSize: 60, fontWeight: 700, color: "#1d1d1f", letterSpacing: -1.5, lineHeight: 1.1, textAlign: "center" } },
        "One App, switch regions, save half."
      ),
      // 副标题
      createElement(
        "div",
        { style: { fontSize: 26, color: "#7a7a7a", marginTop: 16 } },
        "Cheapest subscription region · 40 countries"
      )
    ),
    // 底部装饰：各地区价格柱状图，从左到右铺满，最矮一根绿色 = 最便宜的区
    createElement(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 8,
          height: 130,
          marginTop: 24,
        },
      },
      ...bars.map((h, i) => {
        const isLow = i === LOW_IDX;
        const isHigh = i === HIGH_IDX;
        return createElement("div", {
          key: i,
          style: {
            flex: 1,
            height: h,
            background: isLow ? "#34c759" : isHigh ? "#ff3b30" : "#0071e3",
            opacity: isLow || isHigh ? 1 : 0.35 + (i % 4) * 0.12,
            borderRadius: 6,
          },
        });
      })
    )
  );
}

async function main() {
  console.log("[generate-og] loading Noto Sans fonts...");
  const [regular, bold] = await Promise.all([loadFont(400), loadFont(700)]);
  console.log("[generate-og] rendering 1200×630 PNG...");
  const response = new ImageResponse(renderOGTree(), {
    ...SIZE,
    fonts: [
      { name: "Noto Sans", data: regular, weight: 400, style: "normal" },
      { name: "Noto Sans", data: bold, weight: 700, style: "normal" },
    ],
  });
  const png = await response.arrayBuffer();
  const outPath = resolve(ROOT, "public/og.png");
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, Buffer.from(png));
  console.log(`[generate-og] wrote ${outPath} (${png.byteLength} bytes)`);
}

main().catch((err) => {
  console.error("[generate-og] failed:", err);
  process.exit(1);
});
