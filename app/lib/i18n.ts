export type Lang = 'es' | 'en';

type StringEntry = { es: string; en: string };
type StringMap = Record<string, StringEntry>;

const STRINGS: StringMap = {
  cocuyo:           { es: 'cocuyo',                                        en: 'cocuyo' },
  tagline:          { es: 'la luz cuando no la dan',                       en: 'the light when nobody gives any' },
  national_status:  { es: 'Estado nacional',                               en: 'National status' },
  regions:          { es: 'Regiones',                                       en: 'Regions' },
  region:           { es: 'Región',                                         en: 'Region' },
  reports_30m:      { es: 'reportes · 30 min',                             en: 'reports · 30 min' },
  bajones_24h:      { es: 'bajones · 24 h',                                en: 'voltage dips · 24 h' },
  active:           { es: 'activos',                                        en: 'active' },
  at_risk_lbl:      { es: 'en riesgo',                                      en: 'at risk' },
  normal:           { es: 'normal',                                         en: 'normal' },
  confirmed:        { es: 'CONFIRMADO',                                     en: 'CONFIRMED' },
  likely:           { es: 'PROBABLE',                                       en: 'LIKELY' },
  at_risk:          { es: 'EN RIESGO',                                      en: 'AT RISK' },
  scheduled:        { es: 'Racionamiento programado',                       en: 'Scheduled rationing' },
  feeder:           { es: 'Falla de alimentador',                           en: 'Feeder fault' },
  substation:       { es: 'Falla de subestación',                           en: 'Substation fault' },
  transmission:     { es: 'Falla de transmisión',                           en: 'Transmission fault' },
  blackout:         { es: 'Apagón nacional',                                en: 'National blackout' },
  weather_dmg:      { es: 'Daño por tormenta',                              en: 'Storm damage' },
  pending:          { es: 'Clasificando…',                                  en: 'Classifying…' },
  forecast24:       { es: 'Pronóstico · próximas 24 h',                    en: 'Forecast · next 24 h' },
  signal_print:     { es: 'Huella de señal',                               en: 'Signal fingerprint' },
  signal_int:       { es: 'Internet',                                       en: 'Internet' },
  signal_sat:       { es: 'Satélite',                                       en: 'Satellite' },
  signal_crowd:     { es: 'Comunidad',                                      en: 'Crowdsource' },
  signal_wx:        { es: 'Clima',                                          en: 'Weather' },
  cross_service:    { es: 'Servicios cruzados',                             en: 'Cross-service status' },
  power:            { es: 'Luz',                                            en: 'Power' },
  water:            { es: 'Agua',                                           en: 'Water' },
  internet:         { es: 'Internet',                                       en: 'Internet' },
  cell:             { es: 'Celular',                                        en: 'Cell' },
  started:          { es: 'Inició',                                         en: 'Started' },
  elapsed:          { es: 'Transcurrido',                                   en: 'Elapsed' },
  eta:              { es: 'Regreso estimado',                               en: 'Expected back' },
  confidence:       { es: 'Confianza',                                      en: 'Confidence' },
  report_no_pwr:    { es: 'No tengo luz',                                   en: 'I have no power' },
  report_back:      { es: 'Volvió la luz',                                  en: 'Power is back' },
  report_unst:      { es: 'Inestable / bajones',                            en: 'Unstable / dips' },
  bajones_title:    { es: 'Calidad del voltaje',                            en: 'Voltage quality' },
  bajones_sub:      { es: 'Frecuencia de la red en vivo',                   en: 'Live grid frequency' },
  hz_nominal:       { es: 'nominal 60.00 Hz',                              en: 'nominal 60.00 Hz' },
  hz_now:           { es: 'ahora',                                          en: 'now' },
  history:          { es: 'Historial',                                      en: 'History' },
  history_30d:      { es: 'Últimos 30 días',                               en: 'Last 30 days' },
  total_hours:      { es: 'Horas sin luz',                                  en: 'Hours dark' },
  outages:          { es: 'cortes',                                         en: 'outages' },
  avg_duration:     { es: 'Duración media',                                 en: 'Avg duration' },
  longest:          { es: 'Más largo',                                      en: 'Longest' },
  pattern:          { es: 'Patrón detectado',                               en: 'Detected pattern' },
  pattern_text:     { es: 'Esta zona suele perder luz los martes y jueves entre 2:00 y 5:00 p.m.', en: 'This zone tends to lose power Tuesdays and Thursdays between 2:00 and 5:00 p.m.' },
  methodology:      { es: 'Cómo funciona',                                  en: 'Methodology' },
  zone:             { es: 'Zona',                                           en: 'Zone' },
  feeder_circuit:   { es: 'Circuito',                                       en: 'Feeder circuit' },
  pop_served:       { es: 'Personas afectadas',                             en: 'People affected' },
  homes:            { es: 'hogares',                                        en: 'homes' },
  report:           { es: 'Reportar',                                       en: 'Report' },
  details:          { es: 'Detalles',                                       en: 'Details' },
  forecast:         { es: 'Pronóstico',                                     en: 'Forecast' },
  nav_map:          { es: 'Mapa',                                           en: 'Map' },
  nav_zone:         { es: 'Mi zona',                                        en: 'My zone' },
  nav_history:      { es: 'Historial',                                      en: 'History' },
  nav_bajones:      { es: 'Bajones',                                        en: 'Voltage' },
  nav_settings:     { es: 'Ajustes',                                        en: 'Settings' },
  last_updated:     { es: 'Actualizado',                                    en: 'Updated' },
  data_sources:     { es: 'Fuentes de datos',                               en: 'Data sources' },
  caroni_proxy:     { es: 'Embalse Guri (proxy)',                           en: 'Guri reservoir (proxy)' },
  grid_freq:        { es: 'Frecuencia · red',                              en: 'Grid frequency' },
  pulse:            { es: 'Pulso de la red',                                en: 'Grid pulse' },
  states_dark:      { es: 'estados afectados',                              en: 'states affected' },
  signals_agree:    { es: 'señales coinciden',                              en: 'signals agree' },
  load_blocks:      { es: 'bloques de carga',                               en: 'load blocks' },
  why_forecast:     { es: 'Por qué este pronóstico',                        en: 'Why this forecast' },
  // offline / freshness
  offline_banner:   { es: 'Sin conexión — datos en caché',                  en: 'Offline — showing cached data' },
  updating:         { es: 'Actualizando…',                                  en: 'Updating…' },
  // report flow
  select_region:    { es: 'Selecciona tu ciudad',                           en: 'Select your city' },
  select_status:    { es: '¿Qué está pasando?',                             en: "What's happening?" },
  submitting:       { es: 'Enviando…',                                      en: 'Submitting…' },
  submitted:        { es: 'Reporte enviado',                                en: 'Report submitted' },
  undo:             { es: 'Deshacer',                                       en: 'Undo' },
  city_not_listed:  { es: 'Mi ciudad no está',                              en: "My city isn't listed" },
  // power-back banner
  power_back_q:     { es: '¿Volvió la luz?',                               en: 'Power back?' },
  tap_to_confirm:   { es: 'Toca para confirmar',                            en: 'Tap to confirm' },
  // region picker
  pick_region:      { es: 'Tu ciudad',                                      en: 'Your city' },
  pick_prompt:      { es: 'Selecciona tu ciudad para ver el estado del servicio eléctrico', en: 'Select your city to see the power service status' },
  // rationing callout
  rationing_pattern:{ es: 'Patrón de racionamiento conocido',               en: 'Known rationing pattern' },
  // phase info
  phase_1_label:    { es: 'Fase 1: Solo datos de comunidad',                en: 'Phase 1: Crowd data only' },
  signals_locked:   { es: 'Señales desbloqueadas en Fase 2',                en: 'Signals unlocked in Phase 2' },
  // cross-service dashboard
  services:         { es: 'Servicios',                                     en: 'Services' },
  svc_power:        { es: 'Luz',                                           en: 'Power' },
  svc_water:        { es: 'Agua',                                          en: 'Water' },
  svc_cell:         { es: 'Celular',                                       en: 'Cell' },
  svc_normal:       { es: 'Todos los servicios normales',                  en: 'All services normal' },
  svc_est_restore:  { es: 'Restauración estimada',                         en: 'Estimated restoration' },
  // voltage / bajones
  voltage_quality:  { es: 'Calidad del voltaje',                           en: 'Voltage quality' },
  wave_detected:    { es: 'OLA DETECTADA',                                 en: 'WAVE DETECTED' },
  wave_mild:        { es: 'Leve',                                          en: 'Mild' },
  wave_moderate:    { es: 'Moderada',                                      en: 'Moderate' },
  wave_severe:      { es: 'SEVERA',                                        en: 'SEVERE' },
  voltage_stable:   { es: 'Estable',                                       en: 'Stable' },
  unplug_warn:      { es: 'Desconecta electrodomésticos sensibles',        en: 'Unplug sensitive appliances' },
  bajones_15min:    { es: 'reportes inestables · 15 min',                  en: 'unstable reports · 15 min' },
  // medical alerts
  med_alerts:       { es: 'Alertas médicas',                               en: 'Medical alerts' },
  med_device_only:  { es: 'Solo en tu dispositivo',                        en: 'Device-only · never sent' },
  med_insulin:      { es: 'Medicamento refrigerado (insulina)',             en: 'Refrigerated medication (insulin)' },
  med_cpap:         { es: 'Dispositivo eléctrico (CPAP)',                  en: 'Powered device (CPAP)' },
  med_dialysis:     { es: 'Diálisis en casa',                              en: 'Home dialysis' },
  med_oxygen:       { es: 'Concentrador de oxígeno',                       en: 'Oxygen concentrator' },
  med_notif:        { es: 'Notificaciones push',                           en: 'Push notifications' },
  med_notif_active: { es: 'Activas · umbral 60%',                          en: 'Active · threshold 60%' },
  med_phase4:       { es: 'Alertas activas en Fase 4. Configura tu perfil ahora.', en: 'Alerts active in Phase 4. Set up your profile now.' },
  // water status
  water_supply:     { es: 'Suministro de agua',                            en: 'Water supply' },
  water_low_risk:   { es: 'Bajo riesgo',                                   en: 'Low risk' },
  water_med_risk:   { es: 'Riesgo medio',                                  en: 'Medium risk' },
  water_high_risk:  { es: 'RIESGO ALTO',                                   en: 'HIGH RISK' },
  water_critical:   { es: 'CRÍTICO',                                       en: 'CRITICAL' },
  water_tank_lbl:   { es: 'Nivel de tu tanque',                            en: 'Your tank level' },
  water_tank_full:  { es: 'Lleno',                                         en: 'Full' },
  water_tank_half:  { es: 'Medio',                                         en: 'Half' },
  water_tank_low:   { es: 'Bajo',                                          en: 'Low' },
  water_tank_empty: { es: 'Vacío',                                         en: 'Empty' },
  // food safety timer
  food_safety:      { es: 'Seguridad alimentaria',                          en: 'Food safety' },
  food_fridge:      { es: 'Refrigerador',                                   en: 'Refrigerator' },
  food_freezer_full:{ es: 'Congelador lleno',                               en: 'Full freezer' },
  food_freezer_half:{ es: 'Congelador medio',                               en: 'Half freezer' },
  food_safe:        { es: 'SEGURO',                                         en: 'SAFE' },
  food_check:       { es: 'REVISAR',                                        en: 'CHECK' },
  food_discard:     { es: 'NO CONSUMIR',                                    en: 'DO NOT EAT' },
  food_remaining:   { es: 'restantes',                                      en: 'remaining' },
  food_meds:        { es: 'Medicamentos',                                   en: 'Medications' },
  food_temp_warn:   { es: 'Ventanas reducidas por calor',                   en: 'Windows shortened by heat' },
  // misc
  no_data:          { es: 'Sin datos',                                      en: 'No data' },
  unverified:       { es: 'Reportes sin verificar',                         en: 'Unverified reports' },
  coming_soon:      { es: 'Próximamente',                                   en: 'Coming soon' },
};

export function tt(key: string, lang: Lang = 'es'): string {
  const entry = STRINGS[key];
  if (!entry) return key;
  return entry[lang] ?? entry.es;
}

export function formatDuration(min: number | null, lang: Lang): string {
  if (min == null) return '—';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m} min`;
  return lang === 'en' ? `${h}h ${m}m` : `${h} h ${m} min`;
}

export function formatTime(d: Date | null, lang: Lang): string {
  if (!d) return '—';
  const opts: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    hour12: lang === 'en',
  };
  return d.toLocaleTimeString(lang === 'es' ? 'es-VE' : 'en-US', opts);
}
