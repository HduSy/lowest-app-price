/** 从用户输入解析出 { country, appId } */
export function parseAppInput(input: string): {
  country: string;
  appId: string;
} | null {
  const s = String(input || "").trim();
  // 完整链接 https://apps.apple.com/us/app/claude.../id6473753684
  const urlM = s.match(/apps\.apple\.com\/([a-z]{2})\/.*?\/id(\d+)/i);
  if (urlM) return { country: urlM[1].toLowerCase(), appId: urlM[2] };
  // 纯数字 或 id123456
  const idM = s.match(/^(?:id)?(\d{6,})$/i);
  if (idM) return { country: "us", appId: idM[1] };
  return null;
}
