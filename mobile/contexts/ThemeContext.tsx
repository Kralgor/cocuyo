import React, { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { storage, STORAGE_KEYS } from '@/lib/storage';
import { LIGHT_THEME, DARK_THEME, AMOLED_THEME } from '@/constants/colors';
import type { MobileTheme } from '@/constants/colors';

// ── types ──────────────────────────────────────────────────────────────────────
interface ThemeContextValue {
  theme: MobileTheme;
  override: 'light' | 'dark' | 'amoled' | null;
  setOverride: (v: 'light' | 'dark' | 'amoled' | null) => void;
}

// ── context ────────────────────────────────────────────────────────────────────
const ThemeContext = createContext<ThemeContextValue | null>(null);

// ── provider ───────────────────────────────────────────────────────────────────
// Reads system color scheme via useColorScheme() and MMKV override synchronously.
// MMKV reads are in the render body (not module level) per RESEARCH.md Pitfall 1.
// Default when no preference: 'dark' (OLED screens, power outage context — D-06).
export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme(); // 'light' | 'dark' | 'amoled' | null

  // Read MMKV synchronously in the render body — safe per RESEARCH.md Pitfall 1.
  // Stored value is 'light' | 'dark'; absence means system preference.
  const storedOverride = storage.getString(STORAGE_KEYS.themeOverride) as 'light' | 'dark' | 'amoled' | null ?? null;
  const [overrideState, setOverrideState] = useState<'light' | 'dark' | 'amoled' | null>(storedOverride);

  const effective = overrideState ?? systemScheme ?? 'dark';
  const theme = effective === 'light' ? LIGHT_THEME : effective === 'amoled' ? AMOLED_THEME : DARK_THEME;

  // ── setOverride ────────────────────────────────────────────────────────────
  // Writes to MMKV and updates local state in one call.
  // Passing null removes the key (revert to system preference).
  function setOverride(v: 'light' | 'dark' | 'amoled' | null): void {
    setOverrideState(v);
    if (v !== null) {
      storage.set(STORAGE_KEYS.themeOverride, v);
    } else {
      // MMKV v4 uses remove() not delete() — per 01-01b deviation fix
      storage.remove(STORAGE_KEYS.themeOverride);
    }
  }

  return (
    <ThemeContext.Provider value={{ theme, override: overrideState, setOverride }}>
      {children}
    </ThemeContext.Provider>
  );
}

// ── useTheme (exported from ThemeContext for convenience) ──────────────────────
// Consumer hook with null-guard — throws if used outside ThemeProvider.
// Prefer importing useTheme from hooks/useTheme.ts (re-export of this).
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
