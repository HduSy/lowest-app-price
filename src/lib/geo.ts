// 客户端 Geo 检测：当服务端 req.cf 不可用时（本地 dev / 非 Cloudflare 部署），
// 由浏览器直接请求第三方 Geo IP 服务。浏览器的请求会经过用户系统代理（如 Clash），
// 因此服务看到的是用户真实出口 IP，而不是 dev server 看到的 localhost。
//
// 重要：此函数只能在浏览器侧（client-side useEffect）调用，
// 服务端调用会看到服务器自身出口 IP，毫无意义。

const GEO_ENDPOINT = "https://ipapi.co/json/";
const GEO_TIMEOUT_MS = 5000;

interface IpApiResp {
  country_code?: string;
  timezone?: string;
}

export interface GeoInfo {
  country: string;
  timezone: string | null;
}

/**
 * 返回小写 ISO 国家 code（如 "hk"）+ IANA 时区（如 "Asia/Shanghai"）。
 * 时区解析失败时 country 仍返回，timezone 为 null。
 */
export async function detectGeo(): Promise<GeoInfo | null> {
  try {
    const res = await fetch(GEO_ENDPOINT, {
      signal: AbortSignal.timeout(GEO_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as IpApiResp;
    const code = data?.country_code?.toLowerCase();
    if (!code) return null;
    return { country: code, timezone: data?.timezone ?? null };
  } catch {
    return null;
  }
}
