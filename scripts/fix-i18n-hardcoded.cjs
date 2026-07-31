// 一次性注入脚本：修复硬编码中文 UI 文案
//   PriceTable: + appPurchaseTier / shareText / prevTier / nextTier
//   AppDetail:  + viewOnAppStore
//   AppsList:   覆盖 addHint（A 版改为"需要付费会员"，因添加 App 现为会员专属）
// NEW_KEYS 幂等（已存在跳过）；OVERWRITE 直接覆盖
// 用法：node scripts/fix-i18n-hardcoded.cjs
const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..", "messages");

// 18 语言翻译；$1.99 保留字面，40 区保留数字
const NEW_KEYS = {
  PriceTable: {
    appPurchaseTier: {
      "zh-CN": "App 下载",
      en: "App Download",
      ar: "تنزيل التطبيق",
      de: "App-Download",
      es: "Descarga de app",
      fr: "Téléchargement de l'app",
      hi: "ऐप डाउनलोड",
      id: "Unduh app",
      it: "Download app",
      ja: "アプリダウンロード",
      ko: "앱 다운로드",
      nl: "App downloaden",
      pl: "Pobranie aplikacji",
      "pt-BR": "Download do app",
      ru: "Скачивание приложения",
      th: "ดาวน์โหลดแอป",
      tr: "Uygulama indirme",
      vi: "Tải ứng dụng",
    },
    shareText: {
      "zh-CN": "LowestAppPrice 全区比价：{name} 最低 {price}（{region}）",
      en: "LowestAppPrice price compare: {name} lowest {price} ({region})",
      ar: "LowestAppPrice مقارنة الأسعار: {name} الأرخص {price} ({region})",
      de: "LowestAppPrice Preisvergleich: {name} günstigste {price} ({region})",
      es: "LowestAppPrice comparar precios: {name} más bajo {price} ({region})",
      fr: "LowestAppPrice comparaison de prix : {name} le moins cher {price} ({region})",
      hi: "LowestAppPrice मूल्य तुलना: {name} सबसे कम {price} ({region})",
      id: "LowestAppPrice bandingkan harga: {name} termurah {price} ({region})",
      it: "LowestAppPrice confronto prezzi: {name} più basso {price} ({region})",
      ja: "LowestAppPrice 価格比較: {name} 最安 {price} ({region})",
      ko: "LowestAppPrice 가격 비교: {name} 최저 {price} ({region})",
      nl: "LowestAppPrice prijzen vergelijken: {name} laagste {price} ({region})",
      pl: "LowestAppPrice porównanie cen: {name} najniższa {price} ({region})",
      "pt-BR": "LowestAppPrice comparar preços: {name} mais barato {price} ({region})",
      ru: "LowestAppPrice сравнение цен: {name}最低 {price} ({region})",
      th: "LowestAppPrice เปรียบเทียบราคา: {name} ถูกที่สุด {price} ({region})",
      tr: "LowestAppPrice fiyat karşılaştırma: {name} en düşük {price} ({region})",
      vi: "LowestAppPrice so sánh giá: {name} rẻ nhất {price} ({region})",
    },
    prevTier: {
      "zh-CN": "上一个",
      en: "Previous",
      ar: "السابق",
      de: "Vorherige",
      es: "Anterior",
      fr: "Précédent",
      hi: "पिछला",
      id: "Sebelumnya",
      it: "Precedente",
      ja: "前へ",
      ko: "이전",
      nl: "Vorige",
      pl: "Poprzedni",
      "pt-BR": "Anterior",
      ru: "Предыдущий",
      th: "ก่อนหน้า",
      tr: "Önceki",
      vi: "Trước",
    },
    nextTier: {
      "zh-CN": "下一个",
      en: "Next",
      ar: "التالي",
      de: "Nächste",
      es: "Siguiente",
      fr: "Suivant",
      hi: "अगला",
      id: "Berikutnya",
      it: "Successivo",
      ja: "次へ",
      ko: "다음",
      nl: "Volgende",
      pl: "Następny",
      "pt-BR": "Próximo",
      ru: "Следующий",
      th: "ถัดไป",
      tr: "Sonraki",
      vi: "Tiếp",
    },
  },
  AppDetail: {
    viewOnAppStore: {
      "zh-CN": "在 {country} App Store 中查看",
      en: "View on {country} App Store",
      ar: "عرض على متجر تطبيقات {country}",
      de: "Im {country} App Store ansehen",
      es: "Ver en App Store de {country}",
      fr: "Voir sur l'App Store {country}",
      hi: "{country} App Store पर देखें",
      id: "Lihat di App Store {country}",
      it: "Vedi sull'App Store {country}",
      ja: "{country}の App Store で表示",
      ko: "{country} App Store에서 보기",
      nl: "Bekijk op {country} App Store",
      pl: "Zobacz w App Store {country}",
      "pt-BR": "Ver na App Store do {country}",
      ru: "Смотреть в App Store {country}",
      th: "ดูบน App Store {country}",
      tr: "{country} App Store'da görüntüle",
      vi: "Xem trên App Store {country}",
    },
  },
};

// 直接覆盖（修改已有 key 的文案）
const OVERWRITE = {
  AppsList: {
    // A 版：添加 App 需要付费会员（原"需要登录"不准确，A 版登录还不够）
    addHint: {
      "zh-CN": "点击「添加」会从 Apple 拉取该 App 信息并触发 40 区价格抓取，需要付费会员。",
      en: "Clicking \"Add\" fetches the app from Apple and triggers a 40-region price crawl. Paid members only.",
      ar: "بالضغط على «إضافة» يتم جلب معلومات التطبيق من Apple وجلب أسعار 40 منطقة. للأعضاء المدفوعين فقط.",
      de: "Auf „Hinzufügen“ klicken ruft App-Infos von Apple ab und startet einen 40-Regionen-Preiscrawl. Nur für zahlende Mitglieder.",
      es: "Al pulsar «Añadir» se obtiene la información de la app de Apple y se rastrean los precios de 40 regiones. Solo miembros de pago.",
      fr: "Cliquer sur « Ajouter » récupère les infos de l'app depuis Apple et lance un crawl des prix sur 40 régions. Réservé aux membres payants.",
      hi: "«जोड़ें» पर क्लिक करने से Apple से ऐप की जानकारी लाता है और 40 क्षेत्रों की कीमतें खंगाता है। केवल सशुल्क सदस्यों के लिए।",
      id: "Klik «Tambah» untuk mengambil info app dari Apple dan memicu crawl harga 40 wilayah. Khusus anggota berbayar.",
      it: "Cliccando «Aggiungi» si ottengono le informazioni dell'app da Apple e si avvia una scansione dei prezzi di 40 regioni. Solo per membri paganti.",
      ja: "「追加」をクリックすると Apple からアプリ情報を取得し、40 地域の価格クロールを開始します。有料会員限定。",
      ko: "「추가」를 클릭하면 Apple에서 앱 정보를 가져와 40개 지역 가격 크롤링을 시작합니다. 유료 멤버 전용.",
      nl: "Klik op «Toevoegen» om app-info van Apple op te halen en een prijscrawl van 40 regio's te starten. Alleen voor betalende leden.",
      pl: "Kliknięcie «Dodaj» pobiera informacje o aplikacji z Apple i uruchamia przeszukiwanie cen w 40 regionach. Tylko dla płacących członków.",
      "pt-BR": "Clicar em «Adicionar» busca informações do app na Apple e inicia um rastreamento de preços em 40 regiões. Apenas para membros pagantes.",
      ru: "Нажатие «Добавить» получает информацию о приложении от Apple и запускает обход цен в 40 регионах. Только для платных участников.",
      th: "การคลิก «เพิ่ม» จะดึงข้อมูลแอปจาก Apple และเริ่มรวบรวมราคา 40 ภูมิภาค สำหรับสมาชิกระดับพิเศษเท่านั้น",
      tr: "«Ekle»ye tıklamak uygulama bilgilerini Apple'dan çeker ve 40 bölge için fiyat taraması başlatır. Yalnızca ücretli üyeler için.",
      vi: "Nhấn «Thêm» để lấy thông tin ứng dụng từ Apple và kích hoạt thu thập giá 40 khu vực. Chỉ dành cho thành viên trả phí.",
    },
  },
};

const LOCALES = [
  "ar", "de", "en", "es", "fr", "hi", "id", "it", "ja", "ko",
  "nl", "pl", "pt-BR", "ru", "th", "tr", "vi", "zh-CN",
];

let added = 0;
let overwritten = 0;
let skipped = 0;

for (const locale of LOCALES) {
  const file = path.join(DIR, `${locale}.json`);
  const raw = fs.readFileSync(file, "utf8");
  const data = JSON.parse(raw);

  // NEW_KEYS：幂等注入
  for (const [ns, keys] of Object.entries(NEW_KEYS)) {
    const nsObj = data[ns] || (data[ns] = {});
    for (const [k, translations] of Object.entries(keys)) {
      if (nsObj[k] == null) {
        nsObj[k] = translations[locale];
        added++;
      } else {
        skipped++;
      }
    }
  }

  // OVERWRITE：直接覆盖
  for (const [ns, keys] of Object.entries(OVERWRITE)) {
    const nsObj = data[ns] || (data[ns] = {});
    for (const [k, translations] of Object.entries(keys)) {
      nsObj[k] = translations[locale];
      overwritten++;
    }
  }

  const out = JSON.stringify(data, null, 2);
  fs.writeFileSync(file, raw.endsWith("\n") ? out + "\n" : out);
}

console.log(`Done: ${added} added, ${overwritten} overwritten, ${skipped} skipped (already existed)`);
