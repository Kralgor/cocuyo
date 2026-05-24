// Static demo data for teaser screens — ported from cocuyo-data.js.
// No runtime randomness: seeded deterministic values for consistent SSR/CSR.

// ── 24h forecast curve (48 half-hour points, risk 0..1) ──────────────────────
export const FORECAST_24H: number[] = (() => {
  const pts: number[] = [];
  const startHour = 14; // anchor: 2pm — typical peak
  for (let i = 0; i < 48; i++) {
    const hour = (startHour + i / 2) % 24;
    let r = 0.10;
    if (hour >= 11 && hour <= 17) r += 0.30 + Math.sin(((hour - 11) / 6) * Math.PI) * 0.20;
    if (hour >= 14 && hour <= 17) r += 0.20;
    if (hour >= 19 && hour <= 22) r += 0.10;
    r += (Math.sin(i * 0.7) + Math.cos(i * 1.3)) * 0.025;
    pts.push(Math.max(0.02, Math.min(0.95, r)));
  }
  return pts;
})();

// ── 30-day darkness strip (days × outage blocks) ─────────────────────────────
export interface DemoOutage { start: number; dur: number; }
export interface DemoDay    { date: Date; outages: DemoOutage[]; }

export const HIST_30D: DemoDay[] = (() => {
  const out: DemoDay[] = [];
  const today = new Date(2026, 4, 16); // 2026-05-16 — fixed anchor
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dow = d.getDay();
    const arr: DemoOutage[] = [];
    if (dow === 2 || dow === 4) arr.push({ start: 14, dur: 2.5 + ((i * 7) % 3) * 0.4 });
    if ((i * 17) % 9 === 0)    arr.push({ start: 8 + ((i * 5) % 6), dur: 1 + ((i * 3) % 3) * 0.7 });
    if (i === 12) arr.push({ start: 22, dur: 6.2 });
    if (i === 3)  arr.push({ start: 14, dur: 2.9 });
    out.push({ date: d, outages: arr });
  }
  return out;
})();

// ── Bajones: last-24h events ─────────────────────────────────────────────────
export interface BajonSeed {
  t_min_ago: number;
  magnitude: number;
  duration_s: number;
  severity: 'mild' | 'medium' | 'severe';
}

export const BAJONES_24H: BajonSeed[] = [
  { t_min_ago: 19,   magnitude: 0.18, duration_s: 3.2, severity: 'mild'   },
  { t_min_ago: 45,   magnitude: 0.32, duration_s: 4.0, severity: 'mild'   },
  { t_min_ago: 88,   magnitude: 0.62, duration_s: 5.5, severity: 'medium' },
  { t_min_ago: 130,  magnitude: 0.41, duration_s: 3.8, severity: 'mild'   },
  { t_min_ago: 184,  magnitude: 1.20, duration_s: 8.0, severity: 'severe' },
  { t_min_ago: 252,  magnitude: 0.55, duration_s: 4.4, severity: 'medium' },
  { t_min_ago: 310,  magnitude: 0.28, duration_s: 2.5, severity: 'mild'   },
  { t_min_ago: 420,  magnitude: 0.95, duration_s: 6.5, severity: 'medium' },
  { t_min_ago: 540,  magnitude: 0.38, duration_s: 3.0, severity: 'mild'   },
  { t_min_ago: 680,  magnitude: 1.45, duration_s: 9.5, severity: 'severe' },
  { t_min_ago: 820,  magnitude: 0.22, duration_s: 2.0, severity: 'mild'   },
  { t_min_ago: 1000, magnitude: 0.50, duration_s: 4.0, severity: 'medium' },
  { t_min_ago: 1180, magnitude: 0.32, duration_s: 3.0, severity: 'mild'   },
  { t_min_ago: 1340, magnitude: 0.80, duration_s: 5.5, severity: 'medium' },
];

// ── Summary stats derived from HIST_30D ──────────────────────────────────────
export const HIST_STATS = (() => {
  let totalH = 0, longest = 0, count = 0;
  for (const d of HIST_30D) {
    for (const o of d.outages) {
      totalH  += o.dur;
      if (o.dur > longest) longest = o.dur;
      count++;
    }
  }
  return { totalH: Math.round(totalH * 10) / 10, longest: Math.round(longest * 10) / 10, count };
})();
