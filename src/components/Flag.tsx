import { REGIONS, REGION_MAP } from "@/lib/regions";

// 全站统一国旗组件：用 alicdn 图片，不用 emoji
// 用法：<Flag code="us" /> 或 <Flag code="us" size={20} />

const FLAG_CDN_BASE = "https://s.alicdn.com/@icon/flag/assets";

export function Flag({
  code,
  size = 20,
  className = "",
}: {
  code: string;
  size?: number;
  className?: string;
}) {
  const c = code.toLowerCase();
  const region = REGION_MAP[c];
  const alt = region ? `${region.name_en} flag` : `${c} flag`;
  const h = Math.round((size * 3) / 4);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`${FLAG_CDN_BASE}/${c}.png`}
      alt={alt}
      width={size}
      height={h}
      loading="lazy"
      className={`inline-block shrink-0 rounded-[2px] object-cover align-middle ${className}`}
      style={{ width: size, height: h }}
    />
  );
}

// 导出所有支持的国家 code 列表（用于 i18n 路由）
export const ALL_COUNTRY_CODES = REGIONS.map((r) => r.code);

