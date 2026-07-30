// 一次性注入脚本：给 LoginDialog 加添加 App 场景的专属文案 key
//   titleAdd  - 弹窗标题（添加场景）
//   descAdd   - A 版描述（添加场景，强调会员专属 + $1.99 买断）
//   descAddB  - B 版描述（添加场景，强调登录即会员可免费添加）
// 幂等：key 已存在则跳过，避免覆盖手工精修
// 用法：node scripts/add-login-add-keys.js
const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..", "messages");

// 18 语言翻译；$1.99 保留字面，不本地化货币
const TRANSLATIONS = {
  "zh-CN": {
    titleAdd: "登录后，添加 App",
    descAdd: "添加 App 为会员专属 · $1.99 永久买断",
    descAddB: "登录即成会员，可免费添加任意 App",
  },
  en: {
    titleAdd: "Sign in to add apps",
    descAdd: "Adding apps is members-only · $1.99 one-time purchase",
    descAddB: "Sign in to become a member — add any app for free",
  },
  ar: {
    titleAdd: "سجّل الدخول لإضافة التطبيقات",
    descAdd: "إضافة التطبيقات للأعضاء فقط · 1.99 دولار دفعة واحدة",
    descAddB: "سجّل الدخول لتصبح عضوًا وأضف أي تطبيق مجانًا",
  },
  de: {
    titleAdd: "Anmelden, um Apps hinzuzufügen",
    descAdd: "Apps hinzufügen ist nur für Mitglieder · 1,99 $ einmalig",
    descAddB: "Melde dich an, um Mitglied zu werden und beliebig viele Apps kostenlos hinzuzufügen",
  },
  es: {
    titleAdd: "Inicia sesión para añadir apps",
    descAdd: "Añadir apps es exclusivo para miembros · 1,99 $ pago único",
    descAddB: "Inicia sesión para ser miembro y añadir cualquier app gratis",
  },
  fr: {
    titleAdd: "Connectez-vous pour ajouter des apps",
    descAdd: "L'ajout d'apps est réservé aux membres · 1,99 $ achat unique",
    descAddB: "Connectez-vous pour devenir membre et ajouter gratuitement n'importe quelle app",
  },
  hi: {
    titleAdd: "ऐप्स जोड़ने के लिए साइन इन करें",
    descAdd: "ऐप्स जोड़ना सदस्यों के लिए ही है · $1.99 एकमात्र खरीद",
    descAddB: "सदस्य बनने के लिए साइन इन करें और कोई भी ऐप मुफ़्त में जोड़ें",
  },
  id: {
    titleAdd: "Masuk untuk menambahkan app",
    descAdd: "Menambahkan app khusus anggota · $1,99 sekali bayar",
    descAddB: "Masuk untuk menjadi anggota dan tambahkan app apa pun secara gratis",
  },
  it: {
    titleAdd: "Accedi per aggiungere app",
    descAdd: "L'aggiunta di app è riservata ai membri · 1,99 $ pagamento unico",
    descAddB: "Accedi per diventare membro e aggiungere qualsiasi app gratuitamente",
  },
  ja: {
    titleAdd: "アプリを追加するにはログイン",
    descAdd: "アプリの追加はメンバー限定 · 1.99 ドルの一括購入",
    descAddB: "ログインしてメンバーになれば、どんなアプリも無料で追加できます",
  },
  ko: {
    titleAdd: "앱을 추가하려면 로그인",
    descAdd: "앱 추가는 멤버 전용 · 1.99달러 일회성 결제",
    descAddB: "로그인하여 멤버가 되면 모든 앱을 무료로 추가할 수 있습니다",
  },
  nl: {
    titleAdd: "Log in om apps toe te voegen",
    descAdd: "Apps toevoegen is alleen voor leden · $1,99 eenmalig",
    descAddB: "Log in om lid te worden en voeg elke app gratis toe",
  },
  pl: {
    titleAdd: "Zaloguj się, aby dodawać aplikacje",
    descAdd: "Dodawanie aplikacji tylko dla członków · 1,99 $ jednorazowo",
    descAddB: "Zaloguj się, aby zostać członkiem i dodawać dowolne aplikacje za darmo",
  },
  "pt-BR": {
    titleAdd: "Entre para adicionar apps",
    descAdd: "Adicionar apps é exclusivo para membros · US$ 1,99 pagamento único",
    descAddB: "Entre para se tornar membro e adicionar qualquer app gratuitamente",
  },
  ru: {
    titleAdd: "Войдите, чтобы добавлять приложения",
    descAdd: "Добавление приложений только для участников · 1,99 $ разовая оплата",
    descAddB: "Войдите, чтобы стать участником и добавлять любые приложения бесплатно",
  },
  th: {
    titleAdd: "เข้าสู่ระบบเพื่อเพิ่มแอป",
    descAdd: "การเพิ่มแอปสำหรับสมาชิกเท่านั้น · 1.99 ดอลลาร์ จ่ายครั้งเดียว",
    descAddB: "เข้าสู่ระบบเพื่อเป็นสมาชิกและเพิ่มแอปใดก็ได้ฟรี",
  },
  tr: {
    titleAdd: "Uygulama eklemek için giriş yap",
    descAdd: "Uygulama ekleme yalnızca üyelere özeldir · 1,99 $ tek seferlik ödeme",
    descAddB: "Üye olmak için giriş yap ve herhangi bir uygulamayı ücretsiz ekle",
  },
  vi: {
    titleAdd: "Đăng nhập để thêm ứng dụng",
    descAdd: "Thêm ứng dụng dành riêng cho thành viên · 1,99 USD thanh toán một lần",
    descAddB: "Đăng nhập để trở thành thành viên và thêm bất kỳ ứng dụng nào miễn phí",
  },
};

const LOCALES = [
  "ar", "de", "en", "es", "fr", "hi", "id", "it", "ja", "ko",
  "nl", "pl", "pt-BR", "ru", "th", "tr", "vi", "zh-CN",
];

let updated = 0;
let skipped = 0;

for (const locale of LOCALES) {
  const file = path.join(DIR, `${locale}.json`);
  const raw = fs.readFileSync(file, "utf8");
  const data = JSON.parse(raw);
  const ns = data.LoginDialog || (data.LoginDialog = {});
  const keys = TRANSLATIONS[locale];
  if (!keys) {
    console.error(`No translations for ${locale}`);
    continue;
  }
  let changed = false;
  for (const [k, v] of Object.entries(keys)) {
    if (ns[k] == null) {
      ns[k] = v;
      changed = true;
    }
  }
  if (changed) {
    const out = JSON.stringify(data, null, 2);
    fs.writeFileSync(file, raw.endsWith("\n") ? out + "\n" : out);
    console.log(`Updated ${locale}`);
    updated++;
  } else {
    console.log(`Skipped ${locale} (already has keys)`);
    skipped++;
  }
}

console.log(`\nDone: ${updated} updated, ${skipped} skipped`);
