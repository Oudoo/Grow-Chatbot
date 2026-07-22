"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Language } from "@/lib/types";
import { getDict, type Dict } from "@/lib/i18n";

interface LangContextValue {
  lang: Language;
  dir: "rtl" | "ltr";
  t: Dict;
  setLang: (lang: Language) => void;
  toggle: () => void;
}

const LangContext = createContext<LangContextValue | null>(null);
const STORAGE_KEY = "grow-lang";

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Arabic-first default; matches the server-rendered <html lang="ar" dir="rtl">.
  const [lang, setLangState] = useState<Language>("ar");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "ar" || saved === "en") setLangState(saved);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = getDict(lang).dir;
  }, [lang]);

  const setLang = (l: Language) => {
    setLangState(l);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore storage failures */
    }
  };

  const value: LangContextValue = {
    lang,
    dir: lang === "ar" ? "rtl" : "ltr",
    t: getDict(lang),
    setLang,
    toggle: () => setLang(lang === "ar" ? "en" : "ar"),
  };

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used within LanguageProvider");
  return ctx;
}
