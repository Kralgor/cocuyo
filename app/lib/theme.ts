export type ThemeName = 'tinta' | 'estudio';

export interface Theme {
  name: ThemeName;
  bg: string;
  panel: string;
  panel2: string;
  line: string;
  lineStrong: string;
  ink: string;
  inkDim: string;
  inkFaint: string;
  accent: string;
  ok: string;
  risk: string;
  warn: string;
  danger: string;
  tileUrl: string;
  tileAttr: string;
  radius: number;
  glow: boolean;
}

export const THEMES: Record<ThemeName, Theme> = {
  tinta: {
    name: 'tinta',
    bg:         '#1c1a16',
    panel:      '#252219',
    panel2:     '#15130f',
    line:       'rgba(230, 220, 198, 0.08)',
    lineStrong: 'rgba(230, 220, 198, 0.22)',
    ink:        '#e6dfcd',
    inkDim:     'rgba(230, 220, 198, 0.65)',
    inkFaint:   'rgba(230, 220, 198, 0.40)',
    accent:     '#E8D96D',
    ok:         '#6da266',
    risk:       '#d8b13a',
    warn:       '#d96f30',
    danger:     '#c8412d',
    tileUrl:    'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',
    tileAttr:   '© OpenStreetMap, CartoDB',
    radius:     0,
    glow:       false,
  },
  estudio: {
    name: 'estudio',
    bg:         '#e7e1d2',
    panel:      '#f1ecdd',
    panel2:     '#dbd5c4',
    line:       'rgba(26, 31, 37, 0.10)',
    lineStrong: 'rgba(26, 31, 37, 0.22)',
    ink:        '#1a1f25',
    inkDim:     'rgba(26, 31, 37, 0.62)',
    inkFaint:   'rgba(26, 31, 37, 0.40)',
    accent:     '#E8D96D',
    ok:         '#4a7a48',
    risk:       '#c89a18',
    warn:       '#c4571a',
    danger:     '#a83020',
    tileUrl:    'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
    tileAttr:   '© OpenStreetMap, CartoDB',
    radius:     0,
    glow:       false,
  },
};

export function applyTheme(theme: Theme): void {
  const s = document.documentElement.style;
  s.setProperty('--bg',          theme.bg);
  s.setProperty('--panel',       theme.panel);
  s.setProperty('--panel2',      theme.panel2);
  s.setProperty('--line',        theme.line);
  s.setProperty('--line-strong', theme.lineStrong);
  s.setProperty('--ink',         theme.ink);
  s.setProperty('--ink-dim',     theme.inkDim);
  s.setProperty('--ink-faint',   theme.inkFaint);
  s.setProperty('--accent',      theme.accent);
  s.setProperty('--ok',          theme.ok);
  s.setProperty('--risk',        theme.risk);
  s.setProperty('--warn',        theme.warn);
  s.setProperty('--danger',      theme.danger);
  s.setProperty('--radius',      `${theme.radius}px`);
}

export function statusColor(status: string, theme: Theme): string {
  switch (status) {
    case 'confirmed_outage':   return theme.danger;
    case 'likely_outage':      return theme.warn;
    case 'at_risk':            return theme.risk;
    case 'unverified_reports': return '#6b8fc2';
    case 'no_data':            return theme.inkFaint;
    default:                   return theme.ok;
  }
}
