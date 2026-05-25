import type { MobileTheme } from '../constants/colors';
import type { Lang } from './i18n';

// Re-export MobileTheme so downstream files can import from a single lib/ path.
export type { MobileTheme };

// ── statusColor ────────────────────────────────────────────────────────────────
// Maps pipeline status strings to mobile theme color tokens.
// Source: RESEARCH.md Pattern 7 + 01-UI-SPEC.md Status Color Mapping
//
// Pipeline status values: 'no_power' | 'power_back' | 'unstable' | 'normal' | 'no_data'
// These are the same values written to status.json — never invent new values here.
export function statusColor(status: string, theme: MobileTheme): string {
  switch (status) {
    case 'no_power':   return theme.danger;   // red — SIN LUZ
    case 'unstable':   return theme.warn;     // orange — INESTABLE
    case 'power_back': return theme.ok;       // green — CON LUZ
    case 'normal':     return theme.ok;       // green — NORMAL
    case 'no_data':    return theme.inkFaint; // faint — SIN DATOS
    default:           return theme.inkFaint; // unknown status — treat as no_data
  }
}

// ── statusLabel ────────────────────────────────────────────────────────────────
// Maps pipeline status strings to hero display labels in ES and EN.
// Source: RESEARCH.md Pattern 7 + 01-UI-SPEC.md Status Color Mapping
export function statusLabel(status: string, lang: Lang): string {
  const labels: Record<string, { es: string; en: string }> = {
    no_power:   { es: 'SIN LUZ',   en: 'NO POWER' },
    power_back: { es: 'CON LUZ',   en: 'POWER ON' },
    unstable:   { es: 'INESTABLE', en: 'UNSTABLE' },
    normal:     { es: 'NORMAL',    en: 'NORMAL' },
    no_data:    { es: 'SIN DATOS', en: 'NO DATA' },
  };
  return labels[status]?.[lang] ?? status.toUpperCase();
}
