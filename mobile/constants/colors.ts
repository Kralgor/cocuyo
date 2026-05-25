// ── MobileTheme interface ──────────────────────────────────────────────────────
// Token reference for both light and dark themes.
// Source: 01-UI-SPEC.md Theme Token Reference + RESEARCH.md Pattern 5
// Both themes must declare ALL tokens — no optional fields.
export interface MobileTheme {
  bg:          string;   // dominant surface (60%) — screen background, tab bar
  panel:       string;   // secondary surface (30%) — cards, modal, picker rows
  ink:         string;   // primary text
  inkDim:      string;   // secondary text
  inkFaint:    string;   // tertiary text / placeholders / no_data status
  accent:      string;   // Cocuyo firefly yellow — 10% usage (CTA, active tab)
  ok:          string;   // status: power on / normal
  warn:        string;   // status: unstable / staleness banner background
  danger:      string;   // status: no power
  line:        string;   // dividers — section separators, card borders
  lineStrong:  string;   // strong dividers — modal header, signal bar track
}

// ── light theme ────────────────────────────────────────────────────────────────
// Warm off-white — sunlight-readable during the day.
// Source: 01-UI-SPEC.md Light Theme Palette
export const LIGHT_THEME: MobileTheme = {
  bg:          '#F5F0E8',               // warm off-white — sunlight readable
  panel:       '#FDFAF3',              // slightly brighter off-white for surfaces
  ink:         '#1A1A1A',              // near-black — 12:1 contrast on bg (AAA)
  inkDim:      'rgba(26,26,26,0.60)', // secondary text
  inkFaint:    'rgba(26,26,26,0.38)', // tertiary / placeholders
  accent:      '#E8C840',              // Cocuyo firefly yellow — brand constant
  ok:          '#3A7A38',              // deep green — power on (5.2:1 contrast on white)
  warn:        '#C05A10',              // orange-amber — unstable / staleness
  danger:      '#B03020',              // dark red — no power (5.8:1 contrast on white)
  line:        'rgba(26,26,26,0.08)', // subtle dividers
  lineStrong:  'rgba(26,26,26,0.20)', // strong dividers, signal bar track
};

// ── dark theme ─────────────────────────────────────────────────────────────────
// Near-black — AMOLED battery-friendly during outages.
// Source: 01-UI-SPEC.md Dark Theme Palette
export const DARK_THEME: MobileTheme = {
  bg:          '#0F0F0F',                   // near-black — AMOLED battery-friendly
  panel:       '#1A1A1A',                  // dark surface for cards / modal
  ink:         '#F0EBE0',                  // warm white — 14:1 contrast on bg (AAA)
  inkDim:      'rgba(240,235,224,0.60)',  // secondary text
  inkFaint:    'rgba(240,235,224,0.35)',  // tertiary / placeholders
  accent:      '#E8C840',                  // Cocuyo firefly yellow — same across themes
  ok:          '#5AAA58',                  // lighter green for dark background contrast
  warn:        '#E07530',                  // orange-amber (brighter for dark bg)
  danger:      '#D04030',                  // red (brighter for dark bg)
  line:        'rgba(240,235,224,0.08)',  // subtle dividers
  lineStrong:  'rgba(240,235,224,0.20)',  // strong dividers, signal bar track
};
