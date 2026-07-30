#!/usr/bin/env node
// 一次性 i18n 注入脚本（幂等，第二批）：AI-SEO 专用
// 给全部 18 个 locale 的 AppDetail namespace 补两个 key：
//   - AppDetail.faqQ1            "哪个 App Store 区最便宜？" 问题
//   - AppDetail.cheapestAnswer   含 {app}/{region}/{price}/{count} 的可抽取答案块
//
// cheapestAnswer 同时用作：可见的答案段落（<p>）+ FAQPage JSON-LD 的 acceptedAnswer.text，
// 保证 AI 引擎抽取的文本与页面可见内容一致。
// 重复执行安全：key 已存在则跳过。用法：node scripts/inject-seo-i18n-2.cjs

const fs = require("fs");
const path = require("path");

const MSG_DIR = path.join(__dirname, "..", "messages");

const TRANSLATIONS = {
  en: {
    faqQ1: "Which App Store region is cheapest for {app}?",
    cheapestAnswer: "The cheapest App Store region for {app} is {region} at {price}. This page compares {app}'s subscription and in-app purchase prices across {count} App Store regions, converted to one currency and ranked from cheapest to most expensive.",
  },
  "zh-CN": {
    faqQ1: "{app} 在哪个 App Store 区最便宜？",
    cheapestAnswer: "{app} 最便宜的 App Store 区是 {region}，价格 {price}。本页对比 {app} 在 {count} 个 App Store 地区的订阅与内购价格，按统一币种换算从低到高排名。",
  },
  de: {
    faqQ1: "In welcher App Store-Region ist {app} am günstigsten?",
    cheapestAnswer: "Die günstigste App Store-Region für {app} ist {region} bei {price}. Diese Seite vergleicht Abo- und In-App-Kauf-Preise von {app} aus {count} App Store-Regionen, umgerechnet in eine Währung und ab dem günstigsten sortiert.",
  },
  ja: {
    faqQ1: "{app} はどの App Store 地域が最安ですか？",
    cheapestAnswer: "{app} の最安の App Store 地域は {region}（{price}）です。本ページでは {app} のサブスク・アプリ内課金の価格を {count} 地域で比較し、単一通貨に換算して最安値順に並べています。",
  },
  ko: {
    faqQ1: "{app}은(는) 어떤 App Store 지역이 가장 저렴한가요?",
    cheapestAnswer: "{app}의 가장 저렴한 App Store 지역은 {region}으로 {price}입니다. 이 페이지는 {app}의 구독 및 인앱 결제 가격을 {count}개 지역에서 비교해 단일 통화로 변환하고 저렴한 순으로 정렬합니다.",
  },
  fr: {
    faqQ1: "Dans quelle région de l'App Store {app} est-il le moins cher ?",
    cheapestAnswer: "La région App Store la moins chère pour {app} est {region} à {price}. Cette page compare les prix d'abonnement et d'achat intégré de {app} dans {count} régions App Store, convertis en une seule devise et classés du moins cher au plus cher.",
  },
  tr: {
    faqQ1: "{app} hangi App Store bölgesinde en ucuz?",
    cheapestAnswer: "{app} için en ucuz App Store bölgesi {price} ile {region}. Bu sayfa, {app} abonelik ve uygulama içi satın alma fiyatlarını {count} App Store bölgesinde karşılaştırır, tek para birimine çevirip en ucuzdan sıralar.",
  },
  "pt-BR": {
    faqQ1: "Em qual região da App Store {app} é mais barato?",
    cheapestAnswer: "A região da App Store mais barata para {app} é {region} por {price}. Esta página compara os preços de assinatura e compra integrada de {app} em {count} regiões da App Store, convertidos para uma única moeda e do mais barato ao mais caro.",
  },
  es: {
    faqQ1: "¿En qué región del App Store {app} es más barato?",
    cheapestAnswer: "La región del App Store más barata para {app} es {region} a {price}. Esta página compara los precios de suscripción y compra integrada de {app} en {count} regiones del App Store, convertidos a una sola moneda y del más barato al más caro.",
  },
  id: {
    faqQ1: "Di wilayah App Store mana {app} paling murah?",
    cheapestAnswer: "Wilayah App Store termurah untuk {app} adalah {region} seharga {price}. Halaman ini membandingkan harga langganan dan pembelian dalam aplikasi {app} di {count} wilayah App Store, dikonversi ke satu mata uang dan dari termurah.",
  },
  th: {
    faqQ1: "{app} ถูกที่สุดในภูมิภาค App Store ใด?",
    cheapestAnswer: "ภูมิภาค App Store ที่ถูกที่สุดสำหรับ {app} คือ {region} ที่ {price} หน้านี้เปรียบเทียบราคาสมัครสมาชิกและซื้อภายในแอปของ {app} ใน {count} ภูมิภาค แปลงเป็นสกุลเงินเดียวและเรียงจากถูกที่สุด",
  },
  vi: {
    faqQ1: "{app} rẻ nhất ở khu vực App Store nào?",
    cheapestAnswer: "Khu vực App Store rẻ nhất cho {app} là {region} với giá {price}. Trang này so sánh giá đăng ký và mua hàng trong ứng dụng của {app} tại {count} khu vực App Store, quy đổi sang một loại tiền và từ rẻ nhất.",
  },
  ru: {
    faqQ1: "В каком регионе App Store {app} самый дешёвый?",
    cheapestAnswer: "Самый дешёвый регион App Store для {app} — {region} по {price}. Эта страница сравнивает цены на подписки и встроенные покупки {app} в {count} регионах App Store, конвертированные в одну валюту и от самых дешёвых.",
  },
  ar: {
    faqQ1: "في أي منطقة من App Store يكون {app} أرخص؟",
    cheapestAnswer: "أرخص منطقة في App Store لـ {app} هي {region} بسعر {price}. تقارن هذه الصفحة أسعار اشتراكات ومشتريات داخل التطبيق لـ {app} في {count} منطقة من App Store، محوّلة إلى عملة واحدة ومن الأرخص.",
  },
  it: {
    faqQ1: "In quale regione dell'App Store {app} è più economico?",
    cheapestAnswer: "La regione App Store più economica per {app} è {region} a {price}. Questa pagina confronta i prezzi degli abbonamenti e acquisti in-app di {app} in {count} regioni App Store, convertiti in una sola valuta e dal più economico.",
  },
  hi: {
    faqQ1: "{app} किस App Store क्षेत्र में सबसे सस्ता है?",
    cheapestAnswer: "{app} के लिए सबसे सस्ता App Store क्षेत्र {price} पर {region} है। यह पेज {count} App Store क्षेत्रों में {app} की सदस्यता और इन-ऐप खरीद की कीमतों की तुलना करता है, एक मुद्रा में परिवर्तित और सबसे सस्ते से।",
  },
  nl: {
    faqQ1: "In welke App Store-regio is {app} het goedkoopst?",
    cheapestAnswer: "De goedkoopste App Store-regio voor {app} is {region} bij {price}. Deze pagina vergelijkt abonnements- en in-app-aankoopprijzen van {app} uit {count} App Store-regio's, omgezet naar één valuta en van goedkoopste eerst.",
  },
  pl: {
    faqQ1: "W którym regionie App Store {app} jest najtańszy?",
    cheapestAnswer: "Najtańszy region App Store dla {app} to {region} w cenie {price}. Ta strona porównuje ceny subskrypcji i zakupów w aplikacji {app} w {count} regionach App Store, przeliczone na jedną walutę i od najtańszych.",
  },
};

function injectLocale(locale, t) {
  const file = path.join(MSG_DIR, `${locale}.json`);
  const raw = fs.readFileSync(file, "utf8");
  const data = JSON.parse(raw);
  let changed = false;

  if (!data.AppDetail) data.AppDetail = {};
  for (const [k, v] of Object.entries(t)) {
    if (!(k in data.AppDetail)) {
      data.AppDetail[k] = v;
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
    console.log(`  ✓ ${locale}: 注入新 key`);
  } else {
    console.log(`  · ${locale}: 已存在，跳过`);
  }
}

console.log("注入 AI-SEO i18n key（AppDetail.faqQ1 / cheapestAnswer）...");
for (const [locale, t] of Object.entries(TRANSLATIONS)) {
  injectLocale(locale, t);
}
console.log("完成。");
