// API 工具：JSON 响应、错误处理、CORS

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Cache-Control": "no-store",
    },
  });
}

export function error(message: string, status = 400): Response {
  return json({ error: message }, status);
}

export function handleOptions(): Response | null {
  return null; // Next.js 自动处理 OPTIONS，留空占位
}
