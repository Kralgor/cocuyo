// ── useTheme ───────────────────────────────────────────────────────────────────
// Re-exports the useTheme consumer hook from ThemeContext.
// This is the canonical import path for all components — prefer this over
// importing directly from contexts/ThemeContext.tsx.
//
// Throws: "useTheme must be used inside ThemeProvider" if used outside provider.
// Pattern: useContext + null-guard (app/contexts/AppContext.tsx lines 76–80).
export { useTheme } from '@/contexts/ThemeContext';
