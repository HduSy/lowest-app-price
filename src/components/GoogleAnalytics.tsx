import Script from "next/script";

// Google Analytics 4 (gtag.js)
// afterInteractive: 客户端 hydration 后加载，不阻塞首屏。
// GA4 内置的 pageview 测量会监听 History API，客户端路由切换自动上报，无需手动 hook。
const GA_MEASUREMENT_ID = "G-TRNTZKYFM0";

export function GoogleAnalytics() {
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}');
        `}
      </Script>
    </>
  );
}
