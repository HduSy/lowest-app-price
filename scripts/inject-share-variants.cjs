#!/usr/bin/env node
/**
 * 幂等注入分享文案 3 套变体到 16 种非母版语言。
 * 母版 zh-CN + en 已手工写入；此脚本处理其余 16 个：
 *   ar / de / es / fr / hi / id / it / ja / ko / nl / pl / pt-BR / ru / th / tr / vi
 *
 * 每种语言注入 4 个 key：
 *   PriceTable.shareText2 / shareText3  （详情页：利益型 / 情绪型，带占位符 {name}{price}{region}）
 *   ShareBar.shareText2 / shareText3    （首页：工具型 / 口水型，无占位符）
 *
 * 同时修复 id.json 的 {wilayah} -> {region} typo（旧 shareText 残留）。
 * 幂等：key 已存在则跳过，不会覆盖手工精修。
 *
 * 跑法：node scripts/inject-share-variants.js
 */
const fs = require("fs");
const path = require("path");

const MSG_DIR = path.resolve(__dirname, "../messages");

// 详情页套 2（利益型）+ 套 3（情绪型）；占位符 {name}{price}{region} 跨语言通用。
const PRICE_TABLE = {
  // 套 2：利益驱动型
  shareText2: {
    ar: "وفّر على {name}: فقط {price} في {region}. اعثر على أرخص منطقة في App Store مع LowestAppPrice",
    de: "Spar bei {name}: nur {price} in {region}. Finde die günstigste App-Store-Region mit LowestAppPrice",
    es: "Ahorra en {name}: solo {price} en {region}. Encuentra la región más barata de App Store con LowestAppPrice",
    fr: "Économisez sur {name} : seulement {price} en {region}. Trouvez la région App Store la moins chère avec LowestAppPrice",
    hi: "{name} पर बचत करें: सिर्फ़ {price} ({region} में)। LowestAppPrice के साथ सबसे सस्ती App Store क्षेत्र खोजें",
    id: "Hemat di {name}: hanya {price} di {region}. Temukan wilayah App Store termurah dengan LowestAppPrice",
    it: "Risparmia su {name}: solo {price} in {region}. Trova la regione App Store più economica con LowestAppPrice",
    ja: "{name} をお得に：{region} ならたった {price}。LowestAppPrice で最安の App Store リージョンを見つけよう",
    ko: "{name} 저렴하게: {region}에서 단 {price}. LowestAppPrice로 가장 저렴한 App Store 지역을 찾아보세요",
    nl: "Bespaar op {name}: slechts {price} in {region}. Vind de goedkoopste App Store-regio met LowestAppPrice",
    pl: "Oszczędź na {name}: tylko {price} w {region}. Znajdź najtańszy region App Store z LowestAppPrice",
    "pt-BR": "Economize em {name}: apenas {price} em {region}. Encontre a região mais barata da App Store com o LowestAppPrice",
    ru: "Сэкономьте на {name}: всего {price} в {region}. Найдите самый дешёвый регион App Store с LowestAppPrice",
    th: "ประหยัดบน {name}: ที่ {region} แค่ {price} หาภูมิภาค App Store ที่ถูกที่สุดกับ LowestAppPrice",
    tr: "{name}'da tasarruf et: sadece {price} ({region}). LowestAppPrice ile en ucuz App Store bölgesini bulun",
    vi: "Tiết kiệm trên {name}: chỉ {price} tại {region}. Tìm khu vực App Store rẻ nhất với LowestAppPrice",
  },
  // 套 3：情绪爆点型（emoji）
  shareText3: {
    ar: "🔥 {name} بـ {price} فقط في {region}؟! للتو وجدت أرخص منطقة في App Store على LowestAppPrice",
    de: "🔥 {name} für nur {price} in {region}?! Hab gerade die günstigste App-Store-Region auf LowestAppPrice gefunden",
    es: "🔥 ¿{name} por solo {price} en {region}?! Acabo de encontrar la región más barata de App Store en LowestAppPrice",
    fr: "🔥 {name} à seulement {price} en {region} ?! Je viens de trouver la région App Store la moins chère sur LowestAppPrice",
    hi: "🔥 {name} सिर्फ़ {price} में ({region})?! मुझे LowestAppPrice पर सबसे सस्ती App Store क्षेत्र मिली",
    id: "🔥 {name} cuma {price} di {region}?! Baru saja ketemu wilayah App Store termurah di LowestAppPrice",
    it: "🔥 {name} a solo {price} in {region}?! Ho appena trovato la regione App Store più economica su LowestAppPrice",
    ja: "🔥 {name} が {region} でたった {price}？！LowestAppPrice で最安の App Store リージョンを見つけたよ",
    ko: "🔥 {name}이 {region}에서 단 {price}?! LowestAppPrice에서 가장 저렴한 App Store 지역을 찾았어요",
    nl: "🔥 {name} voor slechts {price} in {region}?! Ik vond net de goedkoopste App Store-regio op LowestAppPrice",
    pl: "🔥 {name} za tylko {price} w {region}?! Właśnie znalazłem najtańszy region App Store na LowestAppPrice",
    "pt-BR": "🔥 {name} por apenas {price} em {region}?! Acabei de encontrar a região mais barata da App Store no LowestAppPrice",
    ru: "🔥 {name} всего за {price} в {region}?! Только что нашёл самый дешёвый регион App Store на LowestAppPrice",
    th: "🔥 {name} ที่ {region} แค่ {price}?! เพิ่งเจอภูมิภาค App Store ที่ถูกที่สุดบน LowestAppPrice",
    tr: "🔥 {name} sadece {price} ({region})?! LowestAppPrice'ta en ucuz App Store bölgesini yeni buldum",
    vi: "🔥 {name} chỉ {price} tại {region}?! Vừa tìm thấy khu vực App Store rẻ nhất trên LowestAppPrice",
  },
};

// 首页套 2（工具价值型）+ 套 3（口水号召型）；无占位符。
const SHARE_BAR = {
  // 套 2：工具价值型
  shareText2: {
    ar: "نفس التطبيق على App Store، أسعار تختلف جذريًا بين المناطق. LowestAppPrice يقارن كل المناطق دفعة واحدة لتضمن أفضل صفقة.",
    de: "Gleiche App-Store-App, völlig unterschiedliche Preise je nach Region. LowestAppPrice vergleicht jede Region auf einen Schlag – immer den besten Preis.",
    es: "Misma app de App Store, precios muy distintos según la región. LowestAppPrice compara todas las regiones a la vez para que siempre consigas la mejor oferta.",
    fr: "Même app sur l'App Store, prix très différents selon la région. LowestAppPrice compare toutes les régions d'un coup pour toujours décrocher le meilleur prix.",
    hi: "App Store पर एक ही App, हर क्षेत्र में कीमतें बहुत अलग। LowestAppPrice एक बार में हर क्षेत्र की तुलना करता है ताकि आपको हमेशा सबसे सस्ता सौदा मिले।",
    id: "App yang sama di App Store, harga sangat beda antarwilayah. LowestAppPrice membandingkan semua wilayah sekaligus agar Anda selalu dapat harga termurah.",
    it: "Stessa app sull'App Store, prezzi molto diversi tra regioni. LowestAppPrice confronta tutte le regioni in un colpo solo per farti avere sempre il prezzo migliore.",
    ja: "同じ App Store アプリでも、リージョンで価格が大きく違う。LowestAppPrice が全リージョンを一括比較して、いつでも最安値をお届けします。",
    ko: "같은 App Store 앱이 지역마다 가격이 천차만별. LowestAppPrice가 모든 지역을 한 번에 비교해 가장 저렴한 거래를 보장합니다.",
    nl: "Dezelfde App Store-app, sterk uiteenlopende prijzen per regio. LowestAppPrice vergelijkt alle regio's in één keer, zodat je altijd de beste prijs pakt.",
    pl: "Ta sama aplikacja w App Store, bardzo różne ceny w zależności od regionu. LowestAppPrice porównuje wszystkie regiony naraz, żebyś zawsze miał najlepszą cenę.",
    "pt-BR": "Mesmo app na App Store, preços bem diferentes por região. O LowestAppPrice compara todas as regiões de uma vez para você sempre garantir o melhor preço.",
    ru: "Одно и то же приложение в App Store — цены по регионам сильно разнятся. LowestAppPrice сравнивает все регионы разом, чтобы вы всегда получали лучшую цену.",
    th: "แอปเดียวกันใน App Store ราคาต่างกันมากตามภูมิภาค LowestAppPrice เปรียบเทียบทุกภูมิภาคในครั้งเดียว ให้คุณได้ราคาถูกที่สุดเสมอ",
    tr: "Aynı App Store uygulaması, bölgeler arası çok farklı fiyatlar. LowestAppPrice tüm bölgeleri tek seferde karşılaştırır, en iyi fiyatı her zaman garantiler.",
    vi: "Cùng một app trên App Store, giá chênh lệch mạnh giữa các khu vực. LowestAppPrice so sánh mọi khu vực cùng lúc để bạn luôn có được giá rẻ nhất.",
  },
  // 套 3：口水号召型（emoji）
  shareText3: {
    ar: "لا تشترِ تطبيقًا قبل التحقق هنا أولًا. 🔍 LowestAppPrice يقارن كل منطقة في App Store ليجد لك أرخص سعر.",
    de: "Kauf keine App, ohne vorher hier nachzusehen. 🔍 LowestAppPrice vergleicht jede App-Store-Region und findet den niedrigsten Preis für dich.",
    es: "No compres una app sin revisar esto primero. 🔍 LowestAppPrice compara todas las regiones de App Store para encontrarte el precio más bajo.",
    fr: "N'achetez pas une app sans avoir vérifié ici d'abord. 🔍 LowestAppPrice compare toutes les régions de l'App Store pour vous trouver le prix le plus bas.",
    hi: "यहाँ जाँच किए बिना कोई App खरीदें नहीं। 🔍 LowestAppPrice हर App Store क्षेत्र की तुलना करके आपके लिए सबसे कम कीमत ढूँढता है।",
    id: "Jangan beli app sebelum cek di sini dulu. 🔍 LowestAppPrice membandingkan setiap wilayah App Store untuk menemukan harga termurah buat Anda.",
    it: "Non comprare un'app senza averlo controllato qui prima. 🔍 LowestAppPrice confronta ogni regione dell'App Store per trovarti il prezzo più basso.",
    ja: "アプリを買う前にまずここでチェック。🔍 LowestAppPrice が App Store の全リージョンを比較して、最安値を見つけます。",
    ko: "먼저 여기서 확인하지 않고는 앱을 사지 마세요. 🔍 LowestAppPrice가 App Store의 모든 지역을 비교해 최저가를 찾아드립니다.",
    nl: "Koop geen app zonder dit eerst te checken. 🔍 LowestAppPrice vergelijkt elke App Store-regio en vindt de laagste prijs voor je.",
    pl: "Nie kupuj aplikacji, zanim to sprawdzisz. 🔍 LowestAppPrice porównuje każdy region App Store i znajduje dla Ciebie najniższą cenę.",
    "pt-BR": "Não compre um app sem conferir aqui antes. 🔍 O LowestAppPrice compara todas as regiões da App Store para encontrar o menor preço para você.",
    ru: "Не покупайте приложение, не проверив сначала здесь. 🔍 LowestAppPrice сравнивает каждый регион App Store и находит для вас самую низкую цену.",
    th: "อย่าซื้อแอปก่อนเช็กที่นี่ 🔍 LowestAppPrice เปรียบเทียบทุกภูมิภาคของ App Store เพื่อหาราคาถูกที่สุดให้คุณ",
    tr: "Önce burayı kontrol etmeden bir uygulama satın alma. 🔍 LowestAppPrice her App Store bölgesini karşılaştırır ve senin için en düşük fiyatı bulur.",
    vi: "Đừng mua app khi chưa kiểm tra ở đây trước. 🔍 LowestAppPrice so sánh mọi khu vực App Store để tìm cho bạn mức giá thấp nhất.",
  },
};

// 注入函数：定位到 namespace 下，在 shareText 后面插 shareText2 / shareText3（如缺失）
function injectNamespace(data, namespace, newKeys) {
  if (!data[namespace]) return false;
  let changed = false;
  for (const [key, val] of Object.entries(newKeys)) {
    if (data[namespace][key] === undefined) {
      data[namespace][key] = val;
      changed = true;
    }
  }
  return changed;
}

// 修复 id.json 的 {wilayah} typo（旧 PriceTable.shareText 误用 {wilayah}）
function fixIdWilayah(data, lang) {
  if (lang !== "id") return false;
  const cur = data?.PriceTable?.shareText;
  if (typeof cur === "string" && cur.includes("{wilayah}")) {
    data.PriceTable.shareText = cur.replace(/\{wilayah\}/g, "{region}");
    return true;
  }
  return false;
}

const LANGS = Object.keys(PRICE_TABLE.shareText2);
let summary = [];

for (const lang of LANGS) {
  const file = path.join(MSG_DIR, `${lang}.json`);
  if (!fs.existsSync(file)) {
    summary.push(`${lang}: ⚠️ 文件不存在，跳过`);
    continue;
  }
  const raw = fs.readFileSync(file, "utf8");
  const data = JSON.parse(raw);

  let changed = false;
  const ptNew = {
    shareText2: PRICE_TABLE.shareText2[lang],
    shareText3: PRICE_TABLE.shareText3[lang],
  };
  const sbNew = {
    shareText2: SHARE_BAR.shareText2[lang],
    shareText3: SHARE_BAR.shareText3[lang],
  };

  if (injectNamespace(data, "PriceTable", ptNew)) changed = true;
  if (injectNamespace(data, "ShareBar", sbNew)) changed = true;
  if (fixIdWilayah(data, lang)) {
    changed = true;
    summary.push(`${lang}: ✅ 注入 + 修 {wilayah} typo`);
  }

  if (changed) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
    if (!summary.some((s) => s.startsWith(`${lang}:`))) {
      summary.push(`${lang}: ✅ 注入完成`);
    }
  } else {
    summary.push(`${lang}: ⏭️  已存在，跳过（幂等）`);
  }
}

console.log(summary.join("\n"));
