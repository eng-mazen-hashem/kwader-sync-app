import { createContext, useContext, useState, useEffect } from "react";
import { translations } from "../translations/translations";

const LanguageContext = createContext(undefined);

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState("en");

  const setLanguage = (lang) => {
    setLanguageState(lang);
    localStorage.setItem("kwader-lang", lang);
  };

  useEffect(() => {
    const saved = localStorage.getItem("kwader-lang");
    if (saved && translations[saved]) {
      setLanguageState(saved);
    }
  }, []);

  useEffect(() => {
    const dir = translations[language].dir;
    document.documentElement.setAttribute("dir", dir);
    document.documentElement.setAttribute("lang", language);
  }, [language]);

  const t = translations[language];
  const isRTL = translations[language].dir === "rtl";

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isRTL }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside LanguageProvider");
  return ctx;
}
