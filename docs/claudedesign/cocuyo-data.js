// cocuyo-data.js — data, themes, i18n, scenarios
// All exported to window so .jsx files can use them globally.

// ── REGIONS ────────────────────────────────────────────────
// Coordinates roughly accurate; population approximate.
const REGIONS = [
  { id: 'caracas',        name: 'Caracas',          state: 'Distrito Capital', lat: 10.50, lng: -66.92, pop: 2800, priority: 1 },
  { id: 'maracaibo',      name: 'Maracaibo',        state: 'Zulia',            lat: 10.63, lng: -71.63, pop: 1600, priority: 5 },
  { id: 'valencia',       name: 'Valencia',         state: 'Carabobo',         lat: 10.16, lng: -68.01, pop:  900, priority: 3 },
  { id: 'barquisimeto',   name: 'Barquisimeto',     state: 'Lara',             lat: 10.07, lng: -69.32, pop:  800, priority: 4 },
  { id: 'maracay',        name: 'Maracay',          state: 'Aragua',           lat: 10.25, lng: -67.60, pop:  750, priority: 3 },
  { id: 'ciudad_guayana', name: 'Ciudad Guayana',   state: 'Bolívar',          lat:  8.37, lng: -62.63, pop:  700, priority: 2 },
  { id: 'san_cristobal',  name: 'San Cristóbal',    state: 'Táchira',          lat:  7.77, lng: -72.22, pop:  350, priority: 5 },
  { id: 'merida',         name: 'Mérida',           state: 'Mérida',           lat:  8.59, lng: -71.15, pop:  300, priority: 5 },
  { id: 'barinas',        name: 'Barinas',          state: 'Barinas',          lat:  8.62, lng: -70.21, pop:  250, priority: 4 },
  { id: 'maturin',        name: 'Maturín',          state: 'Monagas',          lat:  9.74, lng: -63.18, pop:  350, priority: 3 },
  { id: 'cumana',         name: 'Cumaná',           state: 'Sucre',            lat: 10.45, lng: -64.18, pop:  280, priority: 3 },
  { id: 'punto_fijo',     name: 'Punto Fijo',       state: 'Falcón',           lat: 11.69, lng: -70.21, pop:  200, priority: 4 },
  { id: 'porlamar',       name: 'Porlamar',         state: 'Nueva Esparta',    lat: 10.96, lng: -63.85, pop:  150, priority: 3 },
  { id: 'trujillo',       name: 'Trujillo',         state: 'Trujillo',         lat:  9.36, lng: -70.43, pop:  100, priority: 5 },
];

// ── ZONE (sub-region for mobile detail) ─────────────────────
// We focus the mobile flow on one neighborhood: El Paraíso, Caracas.
const FOCUS_ZONE = {
  id: 'el_paraiso',
  name: 'El Paraíso',
  city: 'Caracas',
  state: 'Distrito Capital',
  feeder: 'Subestación La Mariposa · Circuito 47B',
  pop_served: 84000,
  homes: 21000,
};

// ── SCORE → STATUS ──────────────────────────────────────────
function statusFromScore(s) {
  if (s >= 0.70) return 'confirmed_outage';
  if (s >= 0.45) return 'likely_outage';
  if (s >= 0.25) return 'at_risk';
  return 'normal';
}

// ── SCENARIOS ───────────────────────────────────────────────
// Each scenario returns a map of region.id -> { score, prediction, signals, … }
// "signals" axes: inet, sat, crowd, weather  (each 0..1)

function scenarioNormal() {
  const m = {};
  for (const r of REGIONS) {
    const base = 0.05 + (r.priority - 1) * 0.04;
    m[r.id] = {
      score: base,
      prediction: base + 0.10,
      signals: { inet: 0.05, sat: 0.0, crowd: 0.0, weather: 0.2 + r.priority * 0.06 },
      reports30: Math.floor(Math.random() * 3),
      bajones24: r.priority,
      since: null,
    };
  }
  // Lara hot afternoon
  m.barquisimeto.prediction = 0.42;
  m.barquisimeto.signals.weather = 0.78;
  return m;
}

function scenarioAtRisk() {
  const m = scenarioNormal();
  // Western states heat up — high prediction, low current
  const heat = ['maracaibo','san_cristobal','merida','barinas','trujillo','barquisimeto'];
  for (const id of heat) {
    m[id].prediction = 0.55 + Math.random() * 0.20;
    m[id].signals.weather = 0.80;
    m[id].bajones24 = 8 + Math.floor(Math.random() * 6);
  }
  m.maracaibo.score = 0.28;
  m.maracaibo.signals.inet = 0.32;
  m.maracaibo.signals.crowd = 0.25;
  return m;
}

function scenarioActive() {
  const m = scenarioNormal();
  // Maracaibo + Zulia in active rationing; Táchira likely; Mérida at risk
  m.maracaibo = {
    score: 0.84, prediction: 0.92,
    signals: { inet: 0.88, sat: 0.72, crowd: 0.94, weather: 0.66 },
    reports30: 312, bajones24: 18, since: new Date(Date.now() - 1000 * 60 * 137),
    type: 'rationing', confidence: 0.92, eta_min: 95,
  };
  m.san_cristobal = {
    score: 0.71, prediction: 0.82,
    signals: { inet: 0.72, sat: 0.55, crowd: 0.81, weather: 0.74 },
    reports30: 86, bajones24: 14, since: new Date(Date.now() - 1000 * 60 * 64),
    type: 'rationing', confidence: 0.88, eta_min: 138,
  };
  m.merida = {
    score: 0.56, prediction: 0.74,
    signals: { inet: 0.51, sat: 0.40, crowd: 0.62, weather: 0.70 },
    reports30: 41, bajones24: 11, since: null,
    type: 'pending', confidence: 0.62,
  };
  m.barquisimeto = {
    score: 0.38, prediction: 0.58,
    signals: { inet: 0.22, sat: 0.10, crowd: 0.45, weather: 0.72 },
    reports30: 14, bajones24: 9, since: null,
  };
  m.trujillo.score = 0.31;
  m.trujillo.signals.crowd = 0.40;
  // The focus zone is in Caracas (El Paraíso) and is itself out — separate.
  m.caracas = {
    score: 0.62, prediction: 0.55,
    signals: { inet: 0.45, sat: 0.20, crowd: 0.85, weather: 0.42 },
    reports30: 47, bajones24: 6, since: new Date(Date.now() - 1000 * 60 * 74),
    type: 'feeder_fault', confidence: 0.78, eta_min: null,
    note: 'Zone-specific: El Paraíso only',
  };
  return m;
}

function scenarioNational() {
  const m = {};
  for (const r of REGIONS) {
    const sev = 0.45 + (r.priority - 1) * 0.10 + Math.random() * 0.08;
    m[r.id] = {
      score: sev,
      prediction: sev + 0.05,
      signals: {
        inet: 0.65 + Math.random() * 0.25,
        sat: 0.50 + Math.random() * 0.30,
        crowd: 0.55 + Math.random() * 0.30,
        weather: 0.30,
      },
      reports30: 80 + Math.floor(Math.random() * 200),
      bajones24: 6 + Math.floor(Math.random() * 12),
      since: new Date(Date.now() - 1000 * 60 * (40 + Math.random() * 80)),
      type: 'transmission_fault',
      confidence: 0.84,
    };
  }
  // Caracas spared less than the rest
  m.caracas.score = 0.45;
  m.caracas.signals.crowd = 0.45;
  m.ciudad_guayana.score = 0.30; // near Guri
  return m;
}

const SCENARIOS = {
  normal:   { id: 'normal',   labelEs: 'Operación normal',     labelEn: 'Normal operation',  build: scenarioNormal },
  at_risk:  { id: 'at_risk',  labelEs: 'Riesgo en aumento',    labelEn: 'Rising risk',        build: scenarioAtRisk },
  active:   { id: 'active',   labelEs: 'Cortes activos',       labelEn: 'Active outages',     build: scenarioActive },
  national: { id: 'national', labelEs: 'Apagón nacional',      labelEn: 'National blackout',  build: scenarioNational },
};

// ── THEMES ──────────────────────────────────────────────────
function getTheme(name, accent) {
  const A = accent || '#E8D96D';

  // ESTUDIO — matte editorial. Bone paper, slate ink, earth accents.
  // No glow, no glass, no gradients. Hairlines and confident typography do the work.
  if (name === 'aero' || name === 'estudio') {
    return {
      name: 'estudio',
      bg:        '#e7e1d2',  // cool bone paper
      panel:     '#f1ecdd',  // lighter sheet
      panel2:    '#dbd5c4',  // deeper sheet
      line:      'rgba(26, 31, 37, 0.10)',
      lineStrong:'rgba(26, 31, 37, 0.22)',
      ink:       '#1a1f25',
      inkDim:    'rgba(26, 31, 37, 0.62)',
      inkFaint:  'rgba(26, 31, 37, 0.40)',
      accent:    A,
      ok:        '#4a7a48',   // clear muted green — "normal"
      risk:      '#c89a18',   // mustard yellow — "at risk"
      warn:      '#c4571a',   // orange — "likely"
      danger:    '#a83020',   // red — "confirmed"
      glow:      'none',
      tileUrl:   'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
      tileAttr:  '© OpenStreetMap, CartoDB',
      mapOverlay:'none',
      body:      "'Inter', system-ui, -apple-system, sans-serif",
      display:   "'Instrument Serif', 'Cormorant Garamond', Georgia, serif",
      mono:      "'JetBrains Mono', ui-monospace, 'SF Mono', monospace",
      radius:    0,
      gloss:     false,
    };
  }

  // TINTA — same restraint as estudio, but at night. Carbon-paper dark.
  // Warm charcoal sheets, bone-colored ink, same matte earth accents lifted for dark.
  if (name === 'tinta') {
    return {
      name: 'tinta',
      bg:        '#1c1a16',  // ink-soaked paper
      panel:     '#252219',  // sheet
      panel2:    '#15130f',  // deeper sheet
      line:      'rgba(230, 220, 198, 0.08)',
      lineStrong:'rgba(230, 220, 198, 0.22)',
      ink:       '#e6dfcd',  // warm bone
      inkDim:    'rgba(230, 220, 198, 0.65)',
      inkFaint:  'rgba(230, 220, 198, 0.40)',
      accent:    A,
      ok:        '#6da266',   // lifted green
      risk:      '#d8b13a',   // lifted yellow
      warn:      '#d96f30',   // lifted orange
      danger:    '#c8412d',   // lifted red
      glow:      'none',
      tileUrl:   'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',
      tileAttr:  '© OpenStreetMap, CartoDB',
      mapOverlay:'none',
      body:      "'Inter', system-ui, -apple-system, sans-serif",
      display:   "'Instrument Serif', 'Cormorant Garamond', Georgia, serif",
      mono:      "'JetBrains Mono', ui-monospace, 'SF Mono', monospace",
      radius:    0,
      gloss:     false,
    };
  }

  if (name === 'civic') {
    return {
      name: 'civic',
      bg:        '#f3efe6',
      panel:     '#ffffff',
      panel2:    '#faf6ec',
      line:      'rgba(20,18,12,0.10)',
      lineStrong:'rgba(20,18,12,0.18)',
      ink:       '#16140d',
      inkDim:    'rgba(22,20,13,0.62)',
      inkFaint:  'rgba(22,20,13,0.38)',
      accent:    A,
      ok:        '#3b8a4a',
      risk:      '#c89a18',
      warn:      '#c97a18',
      danger:    '#b21a1a',
      glow:      'none',
      tileUrl:   'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
      tileAttr:  '© OpenStreetMap, CartoDB',
      mapOverlay:'rgba(243,239,230,0.0)',
      body:      "'Inter', system-ui, -apple-system, sans-serif",
      display:   "'Inter', system-ui, sans-serif",
      mono:      "'JetBrains Mono', ui-monospace, 'SF Mono', monospace",
    };
  }
  if (name === 'terminal') {
    return {
      name: 'terminal',
      bg:        '#06070a',
      panel:     '#0a0d10',
      panel2:    '#0e1115',
      line:      'rgba(160,255,140,0.12)',
      lineStrong:'rgba(160,255,140,0.25)',
      ink:       '#b8f0a0',
      inkDim:    'rgba(184,240,160,0.65)',
      inkFaint:  'rgba(184,240,160,0.35)',
      accent:    A,
      ok:        '#7be07b',
      risk:      '#e8c34a',
      warn:      '#e8c34a',
      danger:    '#ff5e5e',
      glow:      '0 0 12px',
      tileUrl:   'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',
      tileAttr:  '© OpenStreetMap, CartoDB',
      mapOverlay:'radial-gradient(ellipse at center, rgba(0,20,5,0.1) 30%, rgba(0,20,5,0.55) 100%)',
      body:      "'JetBrains Mono', ui-monospace, 'SF Mono', monospace",
      display:   "'JetBrains Mono', ui-monospace, monospace",
      mono:      "'JetBrains Mono', ui-monospace, 'SF Mono', monospace",
    };
  }
  // glow (default)
  return {
    name: 'glow',
    bg:        '#08080c',
    panel:     '#10111a',
    panel2:    '#161827',
    line:      'rgba(255,255,255,0.06)',
    lineStrong:'rgba(255,255,255,0.14)',
    ink:       '#ece9dd',
    inkDim:    'rgba(236,233,221,0.62)',
    inkFaint:  'rgba(236,233,221,0.36)',
    accent:    A,
    ok:        '#62dd95',
    risk:      '#e8d96d',
    warn:      '#f4b347',
    danger:    '#ff5252',
    glow:      '0 0 16px',
    tileUrl:   'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',
    tileAttr:  '© OpenStreetMap, CartoDB',
    mapOverlay:'radial-gradient(ellipse at center, rgba(8,8,12,0) 30%, rgba(8,8,12,0.6) 100%)',
    body:      "'Inter', system-ui, -apple-system, sans-serif",
    display:   "'Instrument Serif', 'Cormorant Garamond', Georgia, serif",
    mono:      "'JetBrains Mono', ui-monospace, 'SF Mono', monospace",
  };
}

// Outage status → color (driven by theme accent system, but with semantic mapping)
function statusColor(status, t) {
  if (status === 'confirmed_outage') return t.danger;
  if (status === 'likely_outage')    return t.warn;
  if (status === 'at_risk')          return t.risk || t.accent;
  return t.ok;
}

// ── I18N ────────────────────────────────────────────────────
const STRINGS = {
  cocuyo:        { es: 'cocuyo',                          en: 'cocuyo' },
  tagline:       { es: 'la luz cuando no la dan',         en: 'the light when nobody gives any' },
  national_status:{es: 'Estado nacional',                  en: 'National status' },
  regions:       { es: 'Regiones',                         en: 'Regions' },
  region:        { es: 'Región',                           en: 'Region' },
  reports_30m:   { es: 'reportes · 30 min',                en: 'reports · 30 min' },
  bajones_24h:   { es: 'bajones · 24 h',                   en: 'voltage dips · 24 h' },
  active:        { es: 'activos',                          en: 'active' },
  at_risk_lbl:   { es: 'en riesgo',                        en: 'at risk' },
  normal:        { es: 'normal',                           en: 'normal' },
  confirmed:     { es: 'CONFIRMADO',                       en: 'CONFIRMED' },
  likely:        { es: 'PROBABLE',                         en: 'LIKELY' },
  at_risk:       { es: 'EN RIESGO',                        en: 'AT RISK' },
  scheduled:     { es: 'Racionamiento programado',         en: 'Scheduled rationing' },
  feeder:        { es: 'Falla de alimentador',             en: 'Feeder fault' },
  substation:    { es: 'Falla de subestación',             en: 'Substation fault' },
  transmission:  { es: 'Falla de transmisión',             en: 'Transmission fault' },
  blackout:      { es: 'Apagón nacional',                  en: 'National blackout' },
  weather_dmg:   { es: 'Daño por tormenta',                en: 'Storm damage' },
  pending:       { es: 'Clasificando…',                    en: 'Classifying…' },
  forecast24:    { es: 'Pronóstico · próximas 24 h',       en: 'Forecast · next 24 h' },
  signal_print:  { es: 'Huella de señal',                  en: 'Signal fingerprint' },
  signal_int:    { es: 'Internet',                         en: 'Internet' },
  signal_sat:    { es: 'Satélite',                         en: 'Satellite' },
  signal_crowd:  { es: 'Comunidad',                        en: 'Crowdsource' },
  signal_wx:     { es: 'Clima',                            en: 'Weather' },
  cross_service: { es: 'Servicios cruzados',               en: 'Cross-service status' },
  power:         { es: 'Luz',                              en: 'Power' },
  water:         { es: 'Agua',                             en: 'Water' },
  internet:      { es: 'Internet',                         en: 'Internet' },
  cell:          { es: 'Celular',                          en: 'Cell' },
  started:       { es: 'Inició',                           en: 'Started' },
  elapsed:       { es: 'Transcurrido',                     en: 'Elapsed' },
  eta:           { es: 'Regreso estimado',                 en: 'Expected back' },
  confidence:    { es: 'Confianza',                        en: 'Confidence' },
  report_no_pwr: { es: 'No tengo luz',                     en: "I have no power" },
  report_back:   { es: 'Volvió la luz',                    en: 'Power is back' },
  report_unst:   { es: 'Inestable / bajones',              en: 'Unstable / dips' },
  bajones_title: { es: 'Calidad del voltaje',              en: 'Voltage quality' },
  bajones_sub:   { es: 'Frecuencia de la red en vivo',     en: 'Live grid frequency' },
  hz_nominal:    { es: 'nominal 60.00 Hz',                 en: 'nominal 60.00 Hz' },
  hz_now:        { es: 'ahora',                            en: 'now' },
  history:       { es: 'Historial',                        en: 'History' },
  history_30d:   { es: 'Últimos 30 días',                  en: 'Last 30 days' },
  total_hours:   { es: 'Horas sin luz',                    en: 'Hours dark' },
  outages:       { es: 'cortes',                           en: 'outages' },
  avg_duration:  { es: 'Duración media',                   en: 'Avg duration' },
  longest:       { es: 'Más largo',                        en: 'Longest' },
  pattern:       { es: 'Patrón detectado',                 en: 'Detected pattern' },
  pattern_text:  { es: 'Esta zona suele perder luz los martes y jueves entre 2:00 y 5:00 p.m.', en: 'This zone tends to lose power Tuesdays and Thursdays between 2:00 and 5:00 p.m.' },
  methodology:   { es: 'Cómo funciona',                    en: 'Methodology' },
  zone:          { es: 'Zona',                             en: 'Zone' },
  feeder_circuit:{ es: 'Circuito',                         en: 'Feeder circuit' },
  pop_served:    { es: 'Personas afectadas',               en: 'People affected' },
  homes:         { es: 'hogares',                          en: 'homes' },
  report:        { es: 'Reportar',                         en: 'Report' },
  details:       { es: 'Detalles',                         en: 'Details' },
  forecast:      { es: 'Pronóstico',                       en: 'Forecast' },
  nav_map:       { es: 'Mapa',                             en: 'Map' },
  nav_zone:      { es: 'Mi zona',                          en: 'My zone' },
  nav_history:   { es: 'Historial',                        en: 'History' },
  nav_bajones:   { es: 'Bajones',                          en: 'Voltage' },
  last_updated:  { es: 'Actualizado',                      en: 'Updated' },
  data_sources:  { es: 'Fuentes de datos',                 en: 'Data sources' },
  caroni_proxy:  { es: 'Embalse Guri (proxy)',             en: 'Guri reservoir (proxy)' },
  grid_freq:     { es: 'Frecuencia · red',                 en: 'Grid frequency' },
  pulse:         { es: 'Pulso de la red',                  en: 'Grid pulse' },
  states_dark:   { es: 'estados afectados',                en: 'states affected' },
  signals_agree: { es: 'señales coinciden',                en: 'signals agree' },
  load_blocks:   { es: 'bloques de carga',                 en: 'load blocks' },
  why_forecast:  { es: 'Por qué este pronóstico',          en: 'Why this forecast' },
  drivers:       {
    heat:        { es: 'Calor + humedad',                  en: 'Heat + humidity' },
    schedule:    { es: 'Bloque programado',                en: 'Scheduled block' },
    history:     { es: 'Patrón histórico',                 en: 'Historical pattern' },
    reservoir:   { es: 'Embalse bajo',                     en: 'Low reservoir' },
    adjacent:    { es: 'Estados vecinos',                  en: 'Adjacent states' },
  },
};
function tt(key, lang) {
  const v = STRINGS[key];
  if (!v) return key;
  return v[lang] || v.es;
}

// ── HELPERS ─────────────────────────────────────────────────
function formatTime(d, lang) {
  if (!d) return '—';
  const opts = { hour: '2-digit', minute: '2-digit', hour12: lang === 'en' };
  return d.toLocaleTimeString(lang === 'es' ? 'es-VE' : 'en-US', opts);
}
function formatDuration(min, lang) {
  if (min == null) return '—';
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  if (h === 0) return `${m} min`;
  if (lang === 'en') return `${h}h ${m}m`;
  return `${h} h ${m} min`;
}

// ── HISTORY: deterministic-ish 30-day strip for focus zone ──
// Each day: array of outage [start_hour, dur_hours]
const HIST_30D = (() => {
  // Pattern: Tue/Thu 14:00–17:00, occasional Saturday morning, sporadic
  const out = [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dow = d.getDay(); // 0 Sun .. 6 Sat
    const arr = [];
    // Tue/Thu rationing
    if (dow === 2 || dow === 4) arr.push({ start: 14, dur: 2.5 + ((i * 7) % 3) * 0.4 });
    // Random extra
    if ((i * 17) % 9 === 0) arr.push({ start: 8 + ((i * 5) % 6), dur: 1 + ((i * 3) % 3) * 0.7 });
    if (i === 12) arr.push({ start: 22, dur: 6.2 }); // a long night
    if (i === 3)  arr.push({ start: 14, dur: 2.9 });
    out.push({ date: d, outages: arr });
  }
  return out;
})();

// ── BAJONES: last 24h timeline ──────────────────────────────
// Each item: { t_min_ago, magnitude (-Hz from 60), duration_s, severity }
const BAJONES_24H = (() => {
  const items = [];
  const seeds = [
    { t: 19,  mag: 0.18, dur: 3.2, sev: 'mild' },
    { t: 45,  mag: 0.32, dur: 4.0, sev: 'mild' },
    { t: 88,  mag: 0.62, dur: 5.5, sev: 'medium' },
    { t: 130, mag: 0.41, dur: 3.8, sev: 'mild' },
    { t: 184, mag: 1.20, dur: 8.0, sev: 'severe' },
    { t: 252, mag: 0.55, dur: 4.4, sev: 'medium' },
    { t: 310, mag: 0.28, dur: 2.5, sev: 'mild' },
    { t: 420, mag: 0.95, dur: 6.5, sev: 'medium' },
    { t: 540, mag: 0.38, dur: 3.0, sev: 'mild' },
    { t: 680, mag: 1.45, dur: 9.5, sev: 'severe' },
    { t: 820, mag: 0.22, dur: 2.0, sev: 'mild' },
    { t: 1000,mag: 0.50, dur: 4.0, sev: 'medium' },
    { t: 1180,mag: 0.32, dur: 3.0, sev: 'mild' },
    { t: 1340,mag: 0.80, dur: 5.5, sev: 'medium' },
  ];
  return seeds;
})();

// ── 24H FORECAST CURVE (focus zone) ─────────────────────────
const FORECAST_24H = (() => {
  // 48 half-hour points, risk 0..1
  const pts = [];
  for (let i = 0; i < 48; i++) {
    const hour = (new Date().getHours() + i / 2) % 24;
    let r = 0.10;
    // Heat peak 12–16
    if (hour >= 11 && hour <= 17) r += 0.30 + Math.sin((hour - 11) / 6 * Math.PI) * 0.20;
    // Rationing block 14–17
    if (hour >= 14 && hour <= 17) r += 0.20;
    // Evening demand
    if (hour >= 19 && hour <= 22) r += 0.10;
    // Noise
    r += (Math.sin(i * 0.7) + Math.cos(i * 1.3)) * 0.025;
    pts.push(Math.max(0.02, Math.min(0.95, r)));
  }
  return pts;
})();

window.COCUYO = {
  REGIONS, FOCUS_ZONE, SCENARIOS, statusFromScore, getTheme, statusColor,
  STRINGS, tt, formatTime, formatDuration,
  HIST_30D, BAJONES_24H, FORECAST_24H,
};
