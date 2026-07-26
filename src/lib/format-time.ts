/**
 * 时间格式化工具：把 SQLite datetime('now') 产出的 UTC 字符串
 * 按指定 IANA 时区转换为本地时间字符串展示。
 *
 * 写入侧：SQLite datetime('now') -> "2024-01-15 08:30:45"（UTC，无后缀）
 * 解析侧：补 "T" + "Z" 显式声明 UTC，再交给 Intl.DateTimeFormat 转目标时区。
 */

/**
 * 把 UTC 时间字符串按指定时区格式化为 "YYYY-MM-DD HH:MM"。
 * - 输入格式："2024-01-15 08:30:45" 或 "2024-01-15T08:30:45Z" 等
 * - timezone 为 null / 无效 / 与输入不匹配时返回 null（调用方回退到原始字符串）
 */
export function formatUtcInTimezone(
  utcStr: string | null | undefined,
  timezone: string | null | undefined
): string | null {
  if (!utcStr) return null;
  // 兼容 SQLite 默认格式 "YYYY-MM-DD HH:MM:SS"（无 T 无 Z）
  const normalized = utcStr.includes("T")
    ? utcStr
    : utcStr.replace(" ", "T");
  // 显式声明 UTC：已有 Z/+/- 时不再追加
  const isoLike = /[zZ]|[+-]\d{2}:?\d{2}$/.test(normalized)
    ? normalized
    : normalized + "Z";
  const ts = Date.parse(isoLike);
  if (Number.isNaN(ts)) return null;

  // 时区无效时回退（Intl 会抛 RangeError）
  let tz = timezone;
  if (tz) {
    try {
      // 探测时区是否被 Intl 接受
      Intl.DateTimeFormat("en-US", { timeZone: tz });
    } catch {
      tz = null;
    }
  }
  if (!tz) return null;

  try {
    const parts = new Intl.DateTimeFormat("zh-CN", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date(ts));
    const get = (type: string) =>
      parts.find((p) => p.type === type)?.value ?? "";
    return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
  } catch {
    return null;
  }
}
