#!/usr/bin/env node
// 一次性 i18n 注入脚本（幂等）：
// 给全部 18 个 locale 补 SEO 用的 metadata key：
//   - HomePage.metaTitle           首页 keyword-rich 标题
//   - AppsPage.metaTitle           应用列表页标题
//   - AppsPage.metaDescription     应用列表页描述
//   - AppDetail.{metaTitle, metaDescription, ogTitle, ogDescription}  应用详情页 metadata
//
// 重复执行安全：每个 key 先检查是否已存在，已存在则跳过，避免覆盖手工精修。
// 用法：node scripts/inject-seo-i18n.cjs

const fs = require("fs");
const path = require("path");

const MSG_DIR = path.join(__dirname, "..", "messages");

// 18 个 locale 与各自的翻译。术语沿用各 locale 已有 metadataDescription / heroSubtitle 用词。
const TRANSLATIONS = {
  en: {
    homeMetaTitle: "App Store Price Compare - Cheapest Region for Subscriptions | LowestAppPrice",
    appsMetaTitle: "All Apps - App Store Price Compare | LowestAppPrice",
    appsMetaDesc: "Browse and compare App Store subscription prices across {count} regions, ranked cheapest first. Search by name or paste an App Store link.",
    appDetail: {
      metaTitle: "{app} Price Compare - Cheapest App Store Region | LowestAppPrice",
      metaDescription: "See {app}'s subscription and in-app purchase prices across {count} App Store regions, converted to one currency and ranked from cheapest to most expensive.",
      ogTitle: "{app} price compare across {count} regions",
      ogDescription: "{count} regions' subscription prices ranked lowest first - see the cheapest at a glance.",
    },
  },
  "zh-CN": {
    homeMetaTitle: "App Store 全区比价 - 订阅哪国最便宜 | LowestAppPrice",
    appsMetaTitle: "全部应用 - App Store 全区比价 | LowestAppPrice",
    appsMetaDesc: "浏览并对比 {count} 个 App Store 地区的订阅价格，从低到高排名。支持按名称搜索或粘贴 App Store 链接。",
    appDetail: {
      metaTitle: "{app} 全区比价 - 哪国最便宜 | LowestAppPrice",
      metaDescription: "查看 {app} 在 {count} 个 App Store 地区的订阅与内购价格，按统一币种换算从低到高排名。",
      ogTitle: "{app} 全区比价",
      ogDescription: "{count} 个地区的订阅价格从低到高排开，哪个区最便宜一目了然。",
    },
  },
  de: {
    homeMetaTitle: "App Store Preisvergleich - Günstigste Region für Abos | LowestAppPrice",
    appsMetaTitle: "Alle Apps - App Store Preisvergleich | LowestAppPrice",
    appsMetaDesc: "Durchsuche und vergleiche App Store-Abo-Preise aus {count} Regionen, sortiert ab dem günstigsten. Suche nach Name oder füge einen App Store-Link ein.",
    appDetail: {
      metaTitle: "{app} Preisvergleich - Günstigste App Store-Region | LowestAppPrice",
      metaDescription: "Sieh Abo- und In-App-Kauf-Preise von {app} aus {count} App Store-Regionen, in einer Währung umgerechnet und ab dem günstigsten sortiert.",
      ogTitle: "{app} Preisvergleich über {count} Regionen",
      ogDescription: "Abo-Preise aus {count} Regionen, ab dem günstigsten sortiert - der niedrigste Preis auf einen Blick.",
    },
  },
  ja: {
    homeMetaTitle: "App Store 価格比較 - サブスクが最安の地域 | LowestAppPrice",
    appsMetaTitle: "全アプリ - App Store 価格比較 | LowestAppPrice",
    appsMetaDesc: "{count} 地域の App Store サブスク価格を閲覧・比較、最安値順に表示。名前で検索するか App Store リンクを貼り付け。",
    appDetail: {
      metaTitle: "{app} 価格比較 - 最安の App Store 地域 | LowestAppPrice",
      metaDescription: "{app} のサブスク・アプリ内課金の価格を {count} 地域で確認、単一通貨に換算して最安値順に表示。",
      ogTitle: "{app} の {count} 地域価格比較",
      ogDescription: "{count} 地域のサブスク価格を最安値順に表示 - 一目でわかります。",
    },
  },
  ko: {
    homeMetaTitle: "App Store 가격 비교 - 구독이 가장 저렴한 지역 | LowestAppPrice",
    appsMetaTitle: "전체 앱 - App Store 가격 비교 | LowestAppPrice",
    appsMetaDesc: "{count}개 지역의 App Store 구독 가격을 탐색하고 비교, 저렴한 순으로 정렬. 이름 검색 또는 App Store 링크 붙여넣기.",
    appDetail: {
      metaTitle: "{app} 가격 비교 - 가장 저렴한 App Store 지역 | LowestAppPrice",
      metaDescription: "{app}의 구독 및 인앱 결제 가격을 {count}개 지역에서 확인, 단일 통화로 변환해 저렴한 순으로 정렬.",
      ogTitle: "{app} {count}개 지역 가격 비교",
      ogDescription: "{count}개 지역의 구독 가격을 저렴한 순으로 - 최저가가 한눈에.",
    },
  },
  fr: {
    homeMetaTitle: "Comparateur de prix App Store - Région la moins chère pour les abonnements | LowestAppPrice",
    appsMetaTitle: "Toutes les apps - Comparateur de prix App Store | LowestAppPrice",
    appsMetaDesc: "Parcourez et comparez les prix d'abonnement App Store de {count} régions, du moins cher au plus cher. Recherche par nom ou collez un lien App Store.",
    appDetail: {
      metaTitle: "{app} - Comparateur de prix, région App Store la moins chère | LowestAppPrice",
      metaDescription: "Voyez les prix d'abonnement et d'achat intégré de {app} dans {count} régions App Store, convertis en une seule devise et classés du moins cher au plus cher.",
      ogTitle: "{app} - comparateur de prix sur {count} régions",
      ogDescription: "Prix d'abonnement de {count} régions, du moins cher au plus cher - le plus bas d'un seul coup d'œil.",
    },
  },
  tr: {
    homeMetaTitle: "App Store Fiyat Karşılaştırma - Abonelik için en ucuz bölge | LowestAppPrice",
    appsMetaTitle: "Tüm uygulamalar - App Store Fiyat Karşılaştırma | LowestAppPrice",
    appsMetaDesc: "{count} bölgedeki App Store abonelik fiyatlarına göz atın ve karşılaştırın, en ucuzdan sıralı. İsimle arayın veya App Store bağlantısı yapıştırın.",
    appDetail: {
      metaTitle: "{app} Fiyat Karşılaştırma - En ucuz App Store bölgesi | LowestAppPrice",
      metaDescription: "{app} abonelik ve uygulama içi satın alma fiyatlarını {count} App Store bölgesinde görün, tek para birimine çevrilip en ucuzdan sıralı.",
      ogTitle: "{app} - {count} bölge fiyat karşılaştırma",
      ogDescription: "{count} bölgenin abonelik fiyatları, en ucuzdan sıralı - en düşük bir bakışta.",
    },
  },
  "pt-BR": {
    homeMetaTitle: "Comparador de preços da App Store - Região mais barata para assinaturas | LowestAppPrice",
    appsMetaTitle: "Todos os apps - Comparador de preços da App Store | LowestAppPrice",
    appsMetaDesc: "Navegue e compare preços de assinatura da App Store em {count} regiões, do mais barato ao mais caro. Pesquise por nome ou cole um link da App Store.",
    appDetail: {
      metaTitle: "{app} - Comparador de preços, região da App Store mais barata | LowestAppPrice",
      metaDescription: "Veja os preços de assinatura e compra integrada de {app} em {count} regiões da App Store, convertidos para uma única moeda e do mais barato ao mais caro.",
      ogTitle: "{app} - comparação de preços em {count} regiões",
      ogDescription: "Preços de assinatura de {count} regiões, do mais barato primeiro - o mais baixo à primeira vista.",
    },
  },
  es: {
    homeMetaTitle: "Comparador de precios del App Store - Región más barata para suscripciones | LowestAppPrice",
    appsMetaTitle: "Todas las apps - Comparador de precios del App Store | LowestAppPrice",
    appsMetaDesc: "Explora y compara los precios de suscripción del App Store en {count} regiones, del más barato al más caro. Busca por nombre o pega un enlace del App Store.",
    appDetail: {
      metaTitle: "{app} - Comparador de precios, región del App Store más barata | LowestAppPrice",
      metaDescription: "Consulta los precios de suscripción y compra integrada de {app} en {count} regiones del App Store, convertidos a una sola moneda y del más barato al más caro.",
      ogTitle: "{app} - comparador de precios en {count} regiones",
      ogDescription: "Precios de suscripción de {count} regiones, del más barato primero - el más bajo de un vistazo.",
    },
  },
  id: {
    homeMetaTitle: "Pembanding Harga App Store - Wilayah termurah untuk langganan | LowestAppPrice",
    appsMetaTitle: "Semua aplikasi - Pembanding Harga App Store | LowestAppPrice",
    appsMetaDesc: "Jelajahi dan bandingkan harga langganan App Store di {count} wilayah, dari termurah. Cari berdasarkan nama atau tempel tautan App Store.",
    appDetail: {
      metaTitle: "{app} - Pembanding harga, wilayah App Store termurah | LowestAppPrice",
      metaDescription: "Lihat harga langganan dan pembelian dalam aplikasi {app} di {count} wilayah App Store, dikonversi ke satu mata uang dan dari termurah.",
      ogTitle: "{app} - pembanding harga di {count} wilayah",
      ogDescription: "Harga langganan dari {count} wilayah, dari termurah - terendah dalam sekejap.",
    },
  },
  th: {
    homeMetaTitle: "เปรียบเทียบราคา App Store - ภูมิภาคถูกที่สุดสำหรับสมัครสมาชิก | LowestAppPrice",
    appsMetaTitle: "แอปทั้งหมด - เปรียบเทียบราคา App Store | LowestAppPrice",
    appsMetaDesc: "เรียกดูและเปรียบเทียบราคาสมัครสมาชิก App Store จาก {count} ภูมิภาค เรียงจากถูกที่สุด ค้นหาด้วยชื่อหรือวางลิงก์ App Store",
    appDetail: {
      metaTitle: "{app} - เปรียบเทียบราคา ภูมิภาค App Store ถูกที่สุด | LowestAppPrice",
      metaDescription: "ดูราคาสมัครสมาชิกและซื้อภายในแอปของ {app} ใน {count} ภูมิภาค App Store แปลงเป็นสกุลเงินเดียวและเรียงจากถูกที่สุด",
      ogTitle: "{app} - เปรียบเทียบราคาใน {count} ภูมิภาค",
      ogDescription: "ราคาสมัครสมาชิกจาก {count} ภูมิภาค เรียงจากถูกที่สุด - เห็นราคาต่ำสุดได้ทันที",
    },
  },
  vi: {
    homeMetaTitle: "So sánh giá App Store - Khu vực rẻ nhất cho đăng ký | LowestAppPrice",
    appsMetaTitle: "Tất cả ứng dụng - So sánh giá App Store | LowestAppPrice",
    appsMetaDesc: "Duyệt và so sánh giá đăng ký App Store tại {count} khu vực, từ rẻ nhất. Tìm theo tên hoặc dán liên kết App Store.",
    appDetail: {
      metaTitle: "{app} - So sánh giá, khu vực App Store rẻ nhất | LowestAppPrice",
      metaDescription: "Xem giá đăng ký và mua hàng trong ứng dụng của {app} tại {count} khu vực App Store, quy đổi sang một loại tiền và từ rẻ nhất.",
      ogTitle: "{app} - so sánh giá tại {count} khu vực",
      ogDescription: "Giá đăng ký từ {count} khu vực, từ rẻ nhất - giá thấp nhất nhìn thấy ngay.",
    },
  },
  ru: {
    homeMetaTitle: "Сравнение цен App Store - Самый дешёвый регион для подписок | LowestAppPrice",
    appsMetaTitle: "Все приложения - Сравнение цен App Store | LowestAppPrice",
    appsMetaDesc: "Просматривайте и сравнивайте цены на подписки App Store в {count} регионах, от самых дешёвых. Поиск по названию или вставьте ссылку App Store.",
    appDetail: {
      metaTitle: "{app} - Сравнение цен, самый дешёвый регион App Store | LowestAppPrice",
      metaDescription: "Смотрите цены на подписки и встроенные покупки {app} в {count} регионах App Store, конвертированные в одну валюту и от самых дешёвых.",
      ogTitle: "{app} - сравнение цен в {count} регионах",
      ogDescription: "Цены на подписки из {count} регионов, от самых дешёвых - самый низкий с первого взгляда.",
    },
  },
  ar: {
    homeMetaTitle: "مقارنة أسعار App Store - أرخص منطقة للاشتراكات | LowestAppPrice",
    appsMetaTitle: "كل التطبيقات - مقارنة أسعار App Store | LowestAppPrice",
    appsMetaDesc: "تصفّح وقارن أسعار اشتراكات App Store في {count} منطقة، من الأرخص أولاً. ابحث بالاسم أو الصق رابط App Store.",
    appDetail: {
      metaTitle: "{app} - مقارنة الأسعار، أرخص منطقة في App Store | LowestAppPrice",
      metaDescription: "اطلع على أسعار اشتراكات ومشتريات داخل التطبيق لـ {app} في {count} منطقة من App Store، محوّلة إلى عملة واحدة ومن الأرخص.",
      ogTitle: "{app} - مقارنة الأسعار في {count} منطقة",
      ogDescription: "أسعار الاشتراك من {count} منطقة، من الأرخص أولاً - الأقل بنظرة واحدة.",
    },
  },
  it: {
    homeMetaTitle: "Comparatore prezzi App Store - Regione più economica per abbonamenti | LowestAppPrice",
    appsMetaTitle: "Tutte le app - Comparatore prezzi App Store | LowestAppPrice",
    appsMetaDesc: "Sfoglia e confronta i prezzi degli abbonamenti App Store in {count} regioni, dal più economico. Cerca per nome o incolla un link dell'App Store.",
    appDetail: {
      metaTitle: "{app} - Comparatore prezzi, regione App Store più economica | LowestAppPrice",
      metaDescription: "Vedi i prezzi degli abbonamenti e acquisti in-app di {app} in {count} regioni dell'App Store, convertiti in una sola valuta e dal più economico.",
      ogTitle: "{app} - comparatore prezzi in {count} regioni",
      ogDescription: "Prezzi degli abbonamenti di {count} regioni, dal più economico - il più basso a colpo d'occhio.",
    },
  },
  hi: {
    homeMetaTitle: "App Store मूल्य तुलना - सदस्यता के लिए सबसे सस्ता क्षेत्र | LowestAppPrice",
    appsMetaTitle: "सभी ऐप्स - App Store मूल्य तुलना | LowestAppPrice",
    appsMetaDesc: "{count} क्षेत्रों में App Store सदस्यता मूल्य ब्राउज़ करें और तुलना करें, सबसे सस्ते से। नाम से खोजें या App Store लिंक पेस्ट करें।",
    appDetail: {
      metaTitle: "{app} - मूल्य तुलना, सबसे सस्ता App Store क्षेत्र | LowestAppPrice",
      metaDescription: "{app} की सदस्यता और इन-ऐप खरीद की कीमतें {count} App Store क्षेत्रों में देखें, एक मुद्रा में परिवर्तित और सबसे सस्ते से।",
      ogTitle: "{app} - {count} क्षेत्रों में मूल्य तुलना",
      ogDescription: "{count} क्षेत्रों के सदस्यता मूल्य, सबसे सस्ते से - सबसे कम एक नज़र में।",
    },
  },
  nl: {
    homeMetaTitle: "App Store prijzen vergelijken - Goedkoopste regio voor abonnementen | LowestAppPrice",
    appsMetaTitle: "Alle apps - App Store prijzen vergelijken | LowestAppPrice",
    appsMetaDesc: "Blader door en vergelijk App Store-abonnementsprijzen uit {count} regio's, van goedkoopste eerst. Zoek op naam of plak een App Store-link.",
    appDetail: {
      metaTitle: "{app} - Prijsvergelijking, goedkoopste App Store-regio | LowestAppPrice",
      metaDescription: "Zie abonnements- en in-app-aankoopprijzen van {app} uit {count} App Store-regio's, omgezet naar één valuta en van goedkoopste eerst.",
      ogTitle: "{app} - prijsvergelijking over {count} regio's",
      ogDescription: "Abonnementsprijzen uit {count} regio's, van goedkoopste eerst - de laagste in één oogopslag.",
    },
  },
  pl: {
    homeMetaTitle: "Porównanie cen App Store - Najtańszy region dla subskrypcji | LowestAppPrice",
    appsMetaTitle: "Wszystkie aplikacje - Porównanie cen App Store | LowestAppPrice",
    appsMetaDesc: "Przeglądaj i porównuj ceny subskrypcji App Store w {count} regionach, od najtańszych. Szukaj po nazwie lub wklej link do App Store.",
    appDetail: {
      metaTitle: "{app} - Porównanie cen, najtańszy region App Store | LowestAppPrice",
      metaDescription: "Zobacz ceny subskrypcji i zakupów w aplikacji {app} w {count} regionach App Store, przeliczone na jedną walutę i od najtańszych.",
      ogTitle: "{app} - porównanie cen w {count} regionach",
      ogDescription: "Ceny subskrypcji z {count} regionów, od najtańszych - najniższa na pierwszy rzut oka.",
    },
  },
};

function injectLocale(locale, t) {
  const file = path.join(MSG_DIR, `${locale}.json`);
  const raw = fs.readFileSync(file, "utf8");
  const data = JSON.parse(raw);
  let changed = false;

  // HomePage.metaTitle
  if (!data.HomePage) data.HomePage = {};
  if (!("metaTitle" in data.HomePage)) {
    data.HomePage.metaTitle = t.homeMetaTitle;
    changed = true;
  }

  // AppsPage.metaTitle + metaDescription
  if (!data.AppsPage) data.AppsPage = {};
  if (!("metaTitle" in data.AppsPage)) {
    data.AppsPage.metaTitle = t.appsMetaTitle;
    changed = true;
  }
  if (!("metaDescription" in data.AppsPage)) {
    data.AppsPage.metaDescription = t.appsMetaDesc;
    changed = true;
  }

  // AppDetail namespace（整体不存在则建；存在则逐 key 幂等）
  if (!data.AppDetail) {
    data.AppDetail = { ...t.appDetail };
    changed = true;
  } else {
    for (const [k, v] of Object.entries(t.appDetail)) {
      if (!(k in data.AppDetail)) {
        data.AppDetail[k] = v;
        changed = true;
      }
    }
  }

  if (changed) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
    console.log(`  ✓ ${locale}: 注入新 key`);
  } else {
    console.log(`  · ${locale}: 已存在，跳过`);
  }
}

console.log("注入 SEO i18n key 到 18 个 locale...");
for (const [locale, t] of Object.entries(TRANSLATIONS)) {
  injectLocale(locale, t);
}
console.log("完成。");
