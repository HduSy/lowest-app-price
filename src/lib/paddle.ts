// 客户端 Paddle checkout 调用：POST /api/paddle/checkout 拿到 checkout URL 后整页跳转
// 仅在浏览器侧调用（依赖 window.location.href 跳转）；失败抛 Error，调用方负责 catch + 展示错误文案
export async function startCheckout(callbackUrl: string): Promise<void> {
  const res = await fetch("/api/paddle/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callbackUrl }),
  });
  if (!res.ok) throw new Error("Failed to create checkout session");
  const { url } = (await res.json()) as { url?: string };
  if (url) window.location.href = url;
}
