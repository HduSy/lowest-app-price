"use client";

import { create, useStore } from "zustand";
import { createContext, useContext, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Language } from "./languages";
import { languageForCountry } from "./languages";
import { currencyForCountry, REGION_MAP } from "./regions";
import { detectGeo } from "./geo";

// ============ 用户偏好持久化 ============
// 只存用户「手动切换」的币种/语种（Picker 调用 setCurrency/setLanguage 时写入）。
// IP 检测的默认值不写这里--每次访问都跟随 IP 重新检测（applyGeoDefaults）。
// v2：v1 会把 IP 检测结果也写进来，导致换 IP 后语种/币种被冻结，已废弃。
const PREFS_KEY = "appstore:prefs:v2";

interface Prefs {
  currency?: string;
  language?: Language;
}

function readPrefs(): Prefs {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    return raw ? (JSON.parse(raw) as Prefs) : {};
  } catch {
    return {};
  }
}

function writePrefs(patch: Partial<Prefs>) {
  if (typeof window === "undefined") return;
  try {
    const next = { ...readPrefs(), ...patch };
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  } catch {
    /* 忽略隐私模式等写入失败 */
  }
}

// ============ Store ============
interface AppState {
  /** 当前展示币种（用户可在 header 切换） */
  currency: string;
  /** IP 检测到的默认币种（事实，不可改） */
  defaultCurrency: string;
  /** 用户手动切换（持久化到 localStorage） */
  setCurrency: (c: string) => void;

  /** 当前 UI 语种（用户可在 header 切换） */
  language: Language;
  /** IP 检测到的默认语种（事实，不可改） */
  defaultLanguage: Language;
  /** 用户手动切换（持久化到 localStorage） */
  setLanguage: (l: Language) => void;

  /** 应用 IP 检测到的默认值（不持久化，每次访问跟随 IP） */
  applyGeoDefaults: (currency: string, language: Language) => void;
}

function createAppStore(defaultCurrency: string, defaultLanguage: Language) {
  return create<AppState>((set) => ({
    currency: defaultCurrency,
    defaultCurrency,
    setCurrency: (c) => {
      set({ currency: c });
      writePrefs({ currency: c });
    },
    language: defaultLanguage,
    defaultLanguage,
    setLanguage: (l) => {
      set({ language: l });
      writePrefs({ language: l });
    },
    applyGeoDefaults: (currency, language) => set({ currency, language }),
  }));
}

type AppStore = ReturnType<typeof createAppStore>;

const AppStoreContext = createContext<AppStore | null>(null);

export function AppStoreProvider({
  defaultCurrency,
  defaultLanguage,
  geoSource,
  children,
}: {
  defaultCurrency: string;
  defaultLanguage: Language;
  /** "cf" = Cloudflare 边缘 req.cf 已检测（信任服务端）；"fallback" = 需客户端补检 */
  geoSource: "cf" | "fallback";
  children: React.ReactNode;
}) {
  const store = useMemo(
    () => createAppStore(defaultCurrency, defaultLanguage),
    [defaultCurrency, defaultLanguage],
  );
  const language = useStore(store, (s) => s.language);
  const router = useRouter();

  // 首次挂载：
  // 1) 优先恢复用户手动保存的偏好；
  // 2) 无偏好且服务端未用 req.cf / CF-IPCountry 检测到时（本地 dev / 非 CF 部署），
  //    由浏览器直接请求 Geo IP 服务 —— 请求会走用户系统代理（如 Clash），
  //    因此服务看到的是用户真实出口 IP，而非 dev server 看到的 localhost。
  useEffect(() => {
    const prefs = readPrefs();
    const hasPref = Boolean(prefs.currency || prefs.language);
    if (prefs.currency) store.getState().setCurrency(prefs.currency);
    if (prefs.language) store.getState().setLanguage(prefs.language);

    if (!hasPref && geoSource !== "cf") {
      detectGeo().then((info) => {
        if (!info) return; // API 失败，不做任何变更
        const raw = info.country;
        // IP 检测出的国家不在支持列表里时，默认 us
        const country = REGION_MAP[raw] ? raw : "us";
        // 用 applyGeoDefaults 而非 setCurrency/setLanguage--不写 localStorage，
        // 每次访问都跟随 IP 重新检测，避免换 IP 后被首次检测结果冻结
        store.getState().applyGeoDefaults(
          currencyForCountry(country),
          languageForCountry(country)
        );
        try {
          document.cookie = `detected_country=${country}; max-age=2592000; path=/; samesite=lax`;
          // 同步回写时区 cookie，供 middleware 下次请求注入 x-detected-timezone 头
          if (info.timezone) {
            document.cookie = `detected_timezone=${encodeURIComponent(info.timezone)}; max-age=2592000; path=/; samesite=lax`;
          }
        } catch {
          /* 忽略隐私模式等写入失败 */
        }
        // URL 国家段与检测到的不一致时切换路由（fallback 场景：落地时服务端没检到，
        // 用 "us" 兜底，客户端补检后纠正 URL）。仅当 URL 有合法国家前缀时才切，
        // 避免影响 /legal /privacy 等无国家前缀的豁免路径。
        const urlCountry = window.location.pathname.split("/")[1];
        if (urlCountry !== country && REGION_MAP[urlCountry]) {
          const parts = window.location.pathname.split("/");
          parts[1] = country;
          router.replace(parts.join("/") || `/${country}`);
        } else {
          router.refresh();
        }
      });
    }
    // 仅首挂载执行一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 同步 <html lang> 到当前语种
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return (
    <AppStoreContext.Provider value={store}>
      {children}
    </AppStoreContext.Provider>
  );
}

function useStoreContext(): AppStore {
  const store = useContext(AppStoreContext);
  if (!store) {
    throw new Error("store 必须在 AppStoreProvider 内使用");
  }
  return store;
}

export function useCurrency<T>(selector: (s: AppState) => T): T {
  return useStore(useStoreContext(), selector);
}

export function useLanguage<T>(selector: (s: AppState) => T): T {
  return useStore(useStoreContext(), selector);
}

export type { Language } from "./languages";
