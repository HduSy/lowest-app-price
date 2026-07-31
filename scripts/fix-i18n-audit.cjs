// i18n 审查全量修复脚本：S1-S5 严重 + M1-M3 $1.99 + G1-G10 术语润色
// 用法：node scripts/fix-i18n-audit.cjs
// 幂等：NEW_KEYS 已存在跳过；OVERWRITE/REGEX/TERM 每次执行都应用（确保修正生效）
const fs = require("fs");
const path = require("path");
const DIR = path.join(__dirname, "..", "messages");

const LOCALES = ["ar","de","en","es","fr","hi","id","it","ja","ko","nl","pl","pt-BR","ru","th","tr","vi","zh-CN"];
const read = (l) => JSON.parse(fs.readFileSync(path.join(DIR, `${l}.json`), "utf8"));
const write = (l, data, raw) => {
  const out = JSON.stringify(data, null, 2);
  fs.writeFileSync(path.join(DIR, `${l}.json`), raw.endsWith("\n") ? out + "\n" : out);
};

// ===== S1: ExternalAppCard namespace（16 语言补齐 4 key）=====
const EXTERNAL_APP_CARD = {
  ar: { add: "إضافة", adding: "جارٍ الإضافة", indexed: "مُفهرس", developerUnknown: "مطوّر غير معروف" },
  de: { add: "Hinzufügen", adding: "Wird hinzugefügt", indexed: "Indiziert", developerUnknown: "Unbekannter Entwickler" },
  es: { add: "Añadir", adding: "Añadiendo", indexed: "Indexado", developerUnknown: "Desarrollador desconocido" },
  fr: { add: "Ajouter", adding: "Ajout en cours", indexed: "Indexé", developerUnknown: "Développeur inconnu" },
  hi: { add: "जोड़ें", adding: "जोड़ा जा रहा है", indexed: "अनुक्रमित", developerUnknown: "अज्ञात डेवलपर" },
  id: { add: "Tambah", adding: "Menambah", indexed: "Terindeks", developerUnknown: "Pengembang tidak diketahui" },
  it: { add: "Aggiungi", adding: "Aggiunta in corso", indexed: "Indicizzato", developerUnknown: "Sviluppatore sconosciuto" },
  ja: { add: "追加", adding: "追加中", indexed: "インデックス済み", developerUnknown: "不明な開発者" },
  ko: { add: "추가", adding: "추가 중", indexed: "인덱싱됨", developerUnknown: "알 수 없는 개발자" },
  nl: { add: "Toevoegen", adding: "Toevoegen…", indexed: "Geïndexeerd", developerUnknown: "Onbekende ontwikkelaar" },
  pl: { add: "Dodaj", adding: "Dodawanie", indexed: "Zaindeksowane", developerUnknown: "Nieznany deweloper" },
  "pt-BR": { add: "Adicionar", adding: "Adicionando", indexed: "Indexado", developerUnknown: "Desenvolvedor desconhecido" },
  ru: { add: "Добавить", adding: "Добавление", indexed: "Индексировано", developerUnknown: "Неизвестный разработчик" },
  th: { add: "เพิ่ม", adding: "กำลังเพิ่ม", indexed: "จัดทำดัชนีแล้ว", developerUnknown: "นักพัฒนาไม่ทราบตัว" },
  tr: { add: "Ekle", adding: "Ekleniyor", indexed: "Dizine eklendi", developerUnknown: "Bilinmeyen geliştirici" },
  vi: { add: "Thêm", adding: "Đang thêm", indexed: "Đã đánh chỉ mục", developerUnknown: "Nhà phát triển không rõ" },
};

// ===== S2: AppsToolbar.searchPlaceholderB（16 语言补齐）=====
const SEARCH_PLACEHOLDER_B = {
  ar: "ابحث بالاسم، أو الصق رابط App Store / المعرف (الأعضاء يمكنهم الإضافة)",
  de: "Nach Name suchen, oder App Store-Link / ID einfügen (Mitglieder können hinzufügen)",
  es: "Busca por nombre, o pega enlace / ID de App Store (los miembros pueden añadir)",
  fr: "Rechercher par nom, ou coller lien / ID App Store (les membres peuvent ajouter)",
  hi: "नाम से खोजें, या App Store लिंक / ID पेस्ट करें (सदस्य जोड़ सकते हैं)",
  id: "Cari nama, atau tempel link / ID App Store (anggota bisa menambahkan)",
  it: "Cerca per nome, o incolla link / ID App Store (i membri possono aggiungere)",
  ja: "名前で検索、または App Store リンク / ID を貼り付け（メンバーが追加可）",
  ko: "이름 검색, 또는 App Store 링크 / ID 붙여넣기 (멤버 추가 가능)",
  nl: "Zoek op naam, of plak App Store-link / ID (leden kunnen toevoegen)",
  pl: "Szukaj po nazwie, lub wklej link / ID App Store (członkowie mogą dodawać)",
  "pt-BR": "Busque por nome, ou cole link / ID da App Store (membros podem adicionar)",
  ru: "Искать по названию, или вставить ссылку / ID App Store (участники могут добавлять)",
  th: "ค้นตามชื่อ หรือวางลิงก์ / ID ของ App Store (สมาชิกเพิ่มได้)",
  tr: "İsme göre ara, veya App Store bağlantısı / ID'sini yapıştır (üyeler ekleyebilir)",
  vi: "Tìm theo tên, hoặc dán link / ID App Store (thành viên có thể thêm)",
};

// ===== S3: AppsList.addHintB（16 语言补齐）=====
const ADD_HINT_B = {
  ar: "بالضغط على «إضافة» يتم جلب معلومات التطبيق من Apple وجلب أسعار 40 منطقة. للأعضاء فقط (سجّل الدخول لتصبح عضوًا).",
  de: "Auf „Hinzufügen“ klicken ruft App-Infos von Apple ab und startet einen 40-Regionen-Preiscrawl. Nur für Mitglieder (Anmelden = Mitglied werden).",
  es: "Al pulsar «Añadir» se obtiene la información de la app de Apple y se rastrean los precios de 40 regiones. Solo miembros (inicia sesión para ser miembro).",
  fr: "Cliquer sur « Ajouter » récupère les infos de l'app depuis Apple et lance un crawl des prix sur 40 régions. Membres uniquement (connectez-vous pour devenir membre).",
  hi: "«जोड़ें» पर क्लिक करने से Apple से ऐप की जानकारी लाता है और 40 क्षेत्रों की कीमतें खंगाता है। केवल सदस्यों के लिए (साइन इन करें = सदस्य बनें)।",
  id: "Klik «Tambah» untuk mengambil info app dari Apple dan memicu crawl harga 40 wilayah. Khusus anggota (masuk untuk menjadi anggota).",
  it: "Cliccando «Aggiungi» si ottengono le informazioni dell'app da Apple e si avvia una scansione dei prezzi di 40 regioni. Solo membri (accedi per diventare membro).",
  ja: "「追加」をクリックすると Apple からアプリ情報を取得し、40 地域の価格クロールを開始します。会員限定（ログインで会員になれます）。",
  ko: "「추가」를 클릭하면 Apple에서 앱 정보를 가져와 40개 지역 가격 크롤링을 시작합니다. 회원 전용 (로그인 시 회원 가능).",
  nl: "Klik op «Toevoegen» om app-info van Apple op te halen en een prijscrawl van 40 regio's te starten. Alleen leden (inloggen = lid worden).",
  pl: "Kliknięcie «Dodaj» pobiera informacje o aplikacji z Apple i uruchamia przeszukiwanie cen w 40 regionach. Tylko członkowie (zaloguj się, aby zostać członkiem).",
  "pt-BR": "Clicar em «Adicionar» busca informações do app na Apple e inicia rastreamento de preços em 40 regiões. Membros apenas (entre para se tornar membro).",
  ru: "Нажатие «Добавить» получает информацию о приложении от Apple и запускает обход цен в 40 регионах. Только участники (войдите, чтобы стать участником).",
  th: "การคลิก «เพิ่ม» จะดึงข้อมูลแอปจาก Apple และเริ่มรวบรวมราคา 40 ภูมิภาค สำหรับสมาชิกเท่านั้น (เข้าสู่ระบบเพื่อเป็นสมาชิก)",
  tr: "«Ekle»ye tıklamak uygulama bilgilerini Apple'dan çeker ve 40 bölge için fiyat taraması başlatır. Yalnızca üyeler (giriş yaparak üye olun).",
  vi: "Nhấn «Thêm» để lấy thông tin ứng dụng từ Apple và kích hoạt thu thập giá 40 khu vực. Chỉ thành viên (đăng nhập để trở thành thành viên).",
};

// ===== S4 + G10: zh-CN AppDetail.ogTitle 补 {count} + 润色 =====
// ===== S5: ru PriceTable.shareText 去中文「最低」=====
// ===== M1: LoginDialog.descAdd 15 语言 $1.99 字面 =====
const DESC_ADD_FIX = {
  ar: "إضافة التطبيقات للأعضاء فقط · $1.99 دفعة واحدة",
  de: "Apps hinzufügen ist nur für Mitglieder · $1.99 einmalig",
  es: "Añadir apps es exclusivo para miembros · $1.99 pago único",
  fr: "L'ajout d'apps est réservé aux membres · $1.99 achat unique",
  id: "Menambahkan app khusus anggota · $1.99 sekali bayar",
  it: "L'aggiunta di app è riservata ai membri · $1.99 pagamento unico",
  ja: "アプリの追加はメンバー限定 · $1.99 の一括購入",
  ko: "앱 추가는 멤버 전용 · $1.99 일회성 결제",
  nl: "Apps toevoegen is alleen voor leden · $1.99 eenmalig",
  pl: "Dodawanie aplikacji tylko dla członków · $1.99 jednorazowo",
  "pt-BR": "Adicionar apps é exclusivo para membros · $1.99 pagamento único",
  ru: "Добавление приложений только для участников · $1.99 разовая оплата",
  th: "การเพิ่มแอปสำหรับสมาชิกเท่านั้น · $1.99 จ่ายครั้งเดียว",
  tr: "Uygulama ekleme yalnızca üyelere özeldir · $1.99 tek seferlik ödeme",
  vi: "Thêm ứng dụng dành riêng cho thành viên · $1.99 thanh toán một lần",
};

// ===== G9: zh-CN PriceTable.savedHint 感叹号移出 <bold> =====
// zh-CN: "最低比最高省了 <bold>{amount}！</bold>" -> "最低比最高省了 <bold>{amount}</bold>！"

// 正则修复 $1.99 本地化变体 -> 字面 $1.99（M2 feature4Body + M3 ar PricingDialog）
function fixPrice(s) {
  return s
    .replace(/US\$ ?1,99/g, "$1.99")
    .replace(/\$1,99/g, "$1.99")
    .replace(/1,99 ?\$/g, "$1.99")
    .replace(/1\.99 ?\$/g, "$1.99")
    .replace(/1[,.]99 ?USD/g, "$1.99")
    .replace(/1\.99 ?ドル/g, "$1.99")
    .replace(/1\.99 ?달러/g, "$1.99")
    .replace(/1\.99 ?دولار[ًا]?/g, "$1.99")
    .replace(/1\.99 ?ดอลลาร์/g, "$1.99");
}

// 术语替换表（G1-G8）：locale -> [from, to] 列表
// G1 ar: الأقل -> الأرخص（价格语境）；G2 id: region -> wilayah；G3 vi: vùng -> khu vực
// G4 tr: katman -> seviye（档位）；G5 de: Tarife -> Stufe；G6 fr: palier -> niveau
// G7 ja: ティア -> プラン；G8 id About.intentBody "Saka" 单独处理
const TERM_FIXES = {
  ar: [["الأقل بنظرة", "الأرخص بنظرة"], ["من الأقل أولًا", "من الأرخص أولًا"], ["من الأقل اولًا", "من الأرخص أولًا"]],
  id: [["region", "wilayah"], ["Saka langganan", "Harga langganan"]],
  vi: [["vùng", "khu vực"]],
  tr: [["katman", "seviye"], ["katmanlarını", "seviyelerini"]],
  de: [["Tarife", "Stufe"]],
  fr: [["paliers", "niveaux"], ["palier", "niveau"]],
  ja: [["サブスクリプションティア", "サブスクリプションプラン"]],
};

let stats = { added: 0, overwritten: 0, regexFixed: 0, termFixed: 0 };

for (const l of LOCALES) {
  const file = path.join(DIR, `${l}.json`);
  const raw = fs.readFileSync(file, "utf8");
  const data = JSON.parse(raw);

  // S1: ExternalAppCard 补齐（幂等）
  if (EXTERNAL_APP_CARD[l]) {
    data.ExternalAppCard = data.ExternalAppCard || {};
    for (const [k, v] of Object.entries(EXTERNAL_APP_CARD[l])) {
      if (data.ExternalAppCard[k] == null) { data.ExternalAppCard[k] = v; stats.added++; }
    }
  }
  // S2: searchPlaceholderB 补齐（幂等）
  if (SEARCH_PLACEHOLDER_B[l]) {
    data.AppsToolbar = data.AppsToolbar || {};
    if (data.AppsToolbar.searchPlaceholderB == null) { data.AppsToolbar.searchPlaceholderB = SEARCH_PLACEHOLDER_B[l]; stats.added++; }
  }
  // S3: addHintB 补齐（幂等）
  if (ADD_HINT_B[l]) {
    data.AppsList = data.AppsList || {};
    if (data.AppsList.addHintB == null) { data.AppsList.addHintB = ADD_HINT_B[l]; stats.added++; }
  }

  // S4 + G10: zh-CN ogTitle 补 {count}
  if (l === "zh-CN" && data.AppDetail?.ogTitle) {
    data.AppDetail.ogTitle = "{app} 全区比价 - {count} 个地区最便宜";
    stats.overwritten++;
  }
  // S5: ru shareText 去中文
  if (l === "ru" && data.PriceTable?.shareText) {
    data.PriceTable.shareText = "LowestAppPrice сравнение цен: {name} самый низкий {price} ({region})";
    stats.overwritten++;
  }
  // G9: zh-CN savedHint 感叹号移出 <bold>
  if (l === "zh-CN" && data.PriceTable?.savedHint) {
    data.PriceTable.savedHint = "最低比最高省了 <bold>{amount}</bold>！";
    stats.overwritten++;
  }
  // M1: descAdd 15 语言 $1.99 字面
  if (DESC_ADD_FIX[l] && data.LoginDialog?.descAdd != null) {
    data.LoginDialog.descAdd = DESC_ADD_FIX[l];
    stats.overwritten++;
  }

  // M2/M3: 正则修复 $1.99（feature4Body + ar PricingDialog.title/buyCta）
  const priceKeys = [
    ["About", "feature4Body"],
    ["PricingDialog", "title"],
    ["PricingDialog", "buyCta"],
  ];
  for (const [ns, k] of priceKeys) {
    if (data[ns]?.[k] != null) {
      const before = data[ns][k];
      const after = fixPrice(before);
      if (after !== before) { data[ns][k] = after; stats.regexFixed++; }
    }
  }

  // G1-G8: 术语替换
  if (TERM_FIXES[l]) {
    const walk = (obj) => {
      for (const key of Object.keys(obj)) {
        if (typeof obj[key] === "string") {
          let s = obj[key];
          for (const [from, to] of TERM_FIXES[l]) {
            if (s.includes(from)) { s = s.split(from).join(to); }
          }
          if (s !== obj[key]) { obj[key] = s; stats.termFixed++; }
        } else if (obj[key] && typeof obj[key] === "object") {
          walk(obj[key]);
        }
      }
    };
    walk(data);
  }

  write(l, data, raw);
}

console.log(`Done: ${stats.added} added, ${stats.overwritten} overwritten, ${stats.regexFixed} price-fixed, ${stats.termFixed} term-fixed`);
