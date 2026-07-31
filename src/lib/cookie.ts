// 从 Cookie header 字符串中读取指定 name 的值（已 decode），找不到返回 null
// 纯字符串处理，无 Node/edge 运行时依赖，可在 middleware / route handler / server component 通用
export function readCookie(cookieHeader: string, name: string): string | null {
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}
