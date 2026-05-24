import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ThemeName, THEMES, Theme, applyTheme } from '../lib/theme';
import { Lang } from '../lib/i18n';

interface AppContextValue {
  themeName: ThemeName;
  theme: Theme;
  lang: Lang;
  selectedRegion: string | null;
  setTheme: (name: ThemeName) => void;
  toggleTheme: () => void;
  setLang: (lang: Lang) => void;
  setSelectedRegion: (region: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

const STORAGE_THEME  = 'cocuyo_theme';
const STORAGE_LANG   = 'cocuyo_lang';
const STORAGE_REGION = 'cocuyo_region';

export function AppProvider({ children }: { children: ReactNode }) {
  const [themeName, setThemeState] = useState<ThemeName>('tinta');
  const [lang, setLangState] = useState<Lang>('es');
  const [selectedRegion, setRegionState] = useState<string | null>(null);

  useEffect(() => {
    const storedTheme  = localStorage.getItem(STORAGE_THEME)  as ThemeName | null;
    const storedLang   = localStorage.getItem(STORAGE_LANG)   as Lang | null;
    const storedRegion = localStorage.getItem(STORAGE_REGION);

    if (storedTheme && THEMES[storedTheme]) setThemeState(storedTheme);
    if (storedLang === 'es' || storedLang === 'en') setLangState(storedLang);
    if (storedRegion) setRegionState(storedRegion);
  }, []);

  useEffect(() => {
    applyTheme(THEMES[themeName]);
  }, [themeName]);

  function setTheme(name: ThemeName) {
    setThemeState(name);
    localStorage.setItem(STORAGE_THEME, name);
  }

  function toggleTheme() {
    setTheme(themeName === 'tinta' ? 'estudio' : 'tinta');
  }

  function setLang(l: Lang) {
    setLangState(l);
    localStorage.setItem(STORAGE_LANG, l);
  }

  function setSelectedRegion(region: string) {
    setRegionState(region);
    localStorage.setItem(STORAGE_REGION, region);
  }

  return (
    <AppContext.Provider value={{
      themeName,
      theme: THEMES[themeName],
      lang,
      selectedRegion,
      setTheme,
      toggleTheme,
      setLang,
      setSelectedRegion,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
