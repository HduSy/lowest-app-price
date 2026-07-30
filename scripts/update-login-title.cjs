// 一次性覆盖脚本：LoginDialog.title（view 场景）改为
//   "一键登录，解锁全部订阅档位"
// 复用各语言 tierLabel 的"档位"用词，保持一致
// 用法：node scripts/update-login-title.cjs
const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..", "messages");

const TRANSLATIONS = {
  "zh-CN": "一键登录，解锁全部订阅档位",
  en: "One-click sign in to unlock all subscription tiers",
  ar: "سجّل الدخول بنقرة واحدة لفتح جميع مستويات الاشتراك",
  de: "Mit einem Klick anmelden, alle Abonnement-Stufen freischalten",
  es: "Inicia sesión con un clic para desbloquear todos los niveles de suscripción",
  fr: "Connexion en un clic pour débloquer tous les niveaux d'abonnement",
  hi: "एक क्लिक में साइन इन करें, सभी सदस्यता स्तर अनलॉक करें",
  id: "Masuk sekali klik untuk membuka semua tier langganan",
  it: "Accedi con un clic per sbloccare tutti i livelli di abbonamento",
  ja: "ワンクリックでログイン、すべてのサブスクリプションプランをアンロック",
  ko: "원클릭 로그인으로 모든 구독 등급 잠금 해제",
  nl: "Log in met één klik en ontgrendel alle abonnementsniveaus",
  pl: "Zaloguj się jednym kliknięciem, odblokuj wszystkie poziomy subskrypcji",
  "pt-BR": "Entre com um clique para desbloquear todos os níveis de assinatura",
  ru: "Войдите в один клик, чтобы разблокировать все уровни подписки",
  th: "เข้าสู่ระบบคลิกเดียวเพื่อปลดล็อกระดับการสมัครสมาชิกทั้งหมด",
  tr: "Tek tıkla giriş yap, tüm abonelik seviyelerinin kilidini aç",
  vi: "Đăng nhập một chạm, mở khóa tất cả các cấp đăng ký",
};

const LOCALES = Object.keys(TRANSLATIONS);

for (const locale of LOCALES) {
  const file = path.join(DIR, `${locale}.json`);
  const raw = fs.readFileSync(file, "utf8");
  const data = JSON.parse(raw);
  const ns = data.LoginDialog;
  if (!ns) {
    console.error(`No LoginDialog namespace in ${locale}`);
    continue;
  }
  const old = ns.title;
  ns.title = TRANSLATIONS[locale];
  const out = JSON.stringify(data, null, 2);
  fs.writeFileSync(file, raw.endsWith("\n") ? out + "\n" : out);
  console.log(`${locale}: ${old} -> ${ns.title}`);
}
console.log("\nDone: title updated in " + LOCALES.length + " locales");
