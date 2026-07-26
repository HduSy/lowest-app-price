// 品牌标识：蓝底 squircle + 多根白色柱子并排（各地区价格）+ 最矮一根绿色高亮（最便宜的区 = 目标）
// 用于 Nav 等需要内联矢量 logo 的位置；favicon 走 src/app/icon.svg
export function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-label="App Store 全区比价"
    >
      <defs>
        <linearGradient id="logo-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1d1d1f" />
          <stop offset="100%" stopColor="#3a3a3c" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#logo-bg)" />
      {/* 3 根柱子并排对比（SF Symbols chart.bar 语言），中间最矮 = 最便宜的区，纯白实色高亮（无彩色） */}
      <rect x="8" y="10" width="3.5" height="14" fill="#ffffff" opacity="0.4" rx="1.2" />
      <rect x="14" y="16" width="3.5" height="8" fill="#ffffff" rx="1.2" />
      <rect x="20" y="6" width="3.5" height="18" fill="#ffffff" opacity="0.4" rx="1.2" />
    </svg>
  );
}
