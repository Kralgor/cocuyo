// ── types ──────────────────────────────────────────────────────────────────────
export type Lang = 'es' | 'en';

type StringEntry = { es: string; en: string };
type StringMap = Record<string, StringEntry>;

// ── strings ────────────────────────────────────────────────────────────────────
// Primary: Spanish (es) — default language. ES fallback always present.
// Secondary: English (en) — used when device locale is English.
// Placeholder format: {X}, {Y}, {N}, {query} — replaced at call site.
const STRINGS: StringMap = {
  // ── app identity ──────────────────────────────────────────────────────────
  cocuyo:               { es: 'cocuyo',                                                en: 'cocuyo' },
  tagline:              { es: 'la luz cuando no la dan',                               en: 'the light when nobody gives any' },

  // ── trust onboarding (TRST-01, D-07) ─────────────────────────────────────
  trust_open_source_h:  { es: 'Código abierto',                                        en: 'Open source' },
  trust_open_source_b:  { es: 'Verifica el código en GitHub. Sin secretos.',            en: 'Verify the code on GitHub. No secrets.' },
  trust_anonymous_h:    { es: '100% anónimo',                                           en: '100% anonymous' },
  trust_anonymous_b:    { es: 'Sin cuentas, sin registro, sin rastreo.',                en: 'No accounts, no registration, no tracking.' },
  trust_political_h:    { es: 'Sin afiliación política',                                en: 'No political affiliation' },
  trust_political_b:    { es: 'Hecho por venezolanos. Nadie paga por esto.',            en: 'Made by Venezuelans. Nobody funds this.' },
  trust_offline_h:      { es: 'Funciona sin internet',                                  en: 'Works offline' },
  trust_offline_b:      { es: 'Los datos se guardan en tu dispositivo.',                en: 'Data is stored on your device.' },
  github_link:          { es: 'Ver código en GitHub',                                   en: 'View code on GitHub' },
  comenzar:             { es: 'Comenzar',                                               en: 'Get started' },

  // ── zone picker (D-11) ────────────────────────────────────────────────────
  zone_picker_title:    { es: 'Selecciona tu zona',                                     en: 'Select your zone' },
  search_placeholder:   { es: 'Buscar zona…',                                           en: 'Search zones…' },
  no_results:           { es: 'Sin resultados para "{query}"',                          en: 'No results for "{query}"' },

  // ── zone detail / home (D-12, STAT-01/02) ────────────────────────────────
  stale_banner:         { es: 'Última actualización hace {N} min — sin conexión',       en: 'Last updated {N} min ago — offline' },
  last_updated:         { es: 'Actualizado hace {N} min',                               en: 'Updated {N} min ago' },
  duration_label_es:    { es: 'Hace {X} h {Y} min',                                    en: '{X}h {Y}m without power' },
  duration_label_min:   { es: 'Hace {Y} min',                                          en: '{Y} min without power' },

  // ── status hero labels (RESEARCH.md Pattern 7) ───────────────────────────
  status_no_power:      { es: 'SIN LUZ',                                                en: 'NO POWER' },
  status_power_back:    { es: 'CON LUZ',                                                en: 'POWER ON' },
  status_unstable:      { es: 'INESTABLE',                                              en: 'UNSTABLE' },
  status_normal:        { es: 'NORMAL',                                                 en: 'NORMAL' },
  status_no_data:       { es: 'SIN DATOS',                                              en: 'NO DATA' },

  // ── signal cards ─────────────────────────────────────────────────────────
  signal_int:           { es: 'Internet',                                               en: 'Internet' },
  signal_crowd:         { es: 'Reportes',                                               en: 'Reports' },
  signal_sat:           { es: 'Satélite',                                               en: 'Satellite' },

  // ── settings modal (D-02, TRST-02) ───────────────────────────────────────
  settings_title:       { es: 'Ajustes',                                                en: 'Settings' },
  settings_privacy_h:   { es: 'Privacidad y código abierto',                            en: 'Privacy & open source' },
  settings_privacy_b:   { es: 'Cocuyo no recopila datos personales. No hay cuentas ni rastreo. El código es público.', en: 'Cocuyo does not collect personal data. No accounts, no tracking. The code is public.' },
  settings_github:      { es: 'Ver código fuente en GitHub',                            en: 'View source code on GitHub' },
  settings_theme_h:     { es: 'Apariencia',                                             en: 'Appearance' },
  settings_theme_sys:   { es: 'Seguir sistema',                                         en: 'Follow system' },
  settings_theme_light: { es: 'Claro',                                                  en: 'Light' },
  settings_theme_dark:  { es: 'Oscuro',                                                 en: 'Dark' },
  settings_zone_h:      { es: 'Mi zona',                                                en: 'My zone' },
  settings_zone_change: { es: 'Cambiar zona',                                           en: 'Change zone' },

  // ── placeholder tabs (D-01) ───────────────────────────────────────────────
  coming_soon:          { es: 'Próximamente',                                           en: 'Coming soon' },
  coming_soon_body:     { es: 'Esta función llega en la próxima actualización.',        en: 'This feature arrives in the next update.' },

  // ── empty / error states (D-14) ──────────────────────────────────────────
  no_data_first_launch: { es: 'Sin datos aún — conecta a internet para la primera carga', en: 'No data yet — connect to the internet for the first load' },
  no_data_cached:       { es: 'Mostrando datos en caché',                               en: 'Showing cached data' },
  no_data_zone:         { es: 'Sin datos para esta zona',                               en: 'No data for this zone' },

  // ── tab bar ───────────────────────────────────────────────────────────────
  tab_zone:             { es: 'Mi Zona',                                                en: 'My Zone' },
  tab_report:           { es: 'Reportar',                                               en: 'Report' },
  tab_notify:           { es: 'Alertas',                                                en: 'Alerts' },
  tab_food:             { es: 'Comida',                                                 en: 'Food' },
  tab_history:          { es: 'Historial',                                              en: 'History' },

  // ── misc ──────────────────────────────────────────────────────────────────
  open_settings:        { es: 'Abrir ajustes',                                          en: 'Open settings' },
  report_title:         { es: 'Reportar luz',                                     en: 'Report power' },
  gps_resolving:        { es: 'Detectando zona...',                               en: 'Detecting zone...' },
  gps_resolved:         { es: 'Zona detectada: {name}',                           en: 'Zone detected: {name}' },
  gps_manual:           { es: 'Elegir zona manualmente',                          en: 'Choose zone manually' },
  report_out:           { es: 'Se fue la luz',                                    en: 'Power went out' },
  report_back:          { es: 'Volvió la luz',                                    en: 'Power came back' },
  cooldown_notice:      { es: 'Ya reportaste hace poco. Intenta de nuevo en {N} min.', en: 'You reported recently. Try again in {N} min.' },
  queue_pending_header: { es: 'Reportes pendientes',                              en: 'Pending reports' },
  queue_pending_body:   { es: '{N} reporte(s) se enviarán cuando vuelva la conexión.', en: '{N} report(s) will send when connection returns.' },
  confirm_title:        { es: 'Confirmar reporte',                                en: 'Confirm report' },
  zone_label:           { es: 'Zona: {name}',                                     en: 'Zone: {name}' },
  parroquia_label:      { es: 'Parroquia (opcional)',                             en: 'Parroquia (optional)' },
  submit_report:        { es: 'Enviar reporte',                                  en: 'Send report' },
  toast_sent:           { es: 'Reporte enviado. ¡Gracias!',                      en: 'Report sent. Thank you!' },
  toast_sent_count:     { es: 'Reporte enviado: {n} personas reportan ahora mismo', en: 'Report sent: {n} people reporting right now' },
  toast_queued:         { es: 'Guardado - se enviará al volver la conexión',     en: 'Saved - will send when connection returns' },
  toast_synced:         { es: 'Reportes pendientes enviados',                    en: 'Pending reports sent' },
  toast_failed:         { es: 'No se pudo enviar. Inténtalo de nuevo.',          en: 'Could not send. Try again.' },
  crowd_1_active:       { es: '1 persona reporta actividad ahora mismo',         en: '1 person reporting right now' },
  crowd_n_active:       { es: '{n} personas reportan actividad ahora mismo',     en: '{n} people reporting right now' },
  crowd_sub:            { es: 'Reportes de la comunidad en los últimos 30 minutos.', en: 'Community reports in the last 30 minutes.' },
  contacts_header:      { es: 'Números útiles',                                  en: 'Useful numbers' },
  contacts_unverified:  { es: 'por verificar',                                   en: 'unverified' },
  contacts_a11y:        { es: '{name}: {number}. Toca para llamar.',             en: '{name}: {number}. Tap to call.' },
  share_prompt_heading: { es: 'Avisas a tus vecinos?',                           en: 'Tell your neighbors?' },
  share_prompt_body:    { es: 'Comparte el estado de tu zona en WhatsApp',       en: 'Share your zone status on WhatsApp' },
  share_prompt_cta:     { es: 'Compartir',                                       en: 'Share' },
  battery_saving_banner:{ es: 'Batería baja: actualizamos con menos frecuencia.', en: 'Low battery: updates are less frequent.' },
  battery_banner_a11y:  { es: 'Modo de ahorro de batería activo',                en: 'Battery saving mode active' },
  theme_amoled:         { es: 'AMOLED',                                          en: 'AMOLED' },

  // ── food spoilage timers (Phase 4, FOOD-01..04, NOTF-03) ──────────────────
  // ASCII-only copy by plan rule: write apagon, revision, Volvio without accents.
  food_title:           { es: 'Comida sin luz',                                  en: 'Food without power' },
  food_subtitle:        { es: 'Temporizadores locales para tus alimentos durante un apagon.', en: 'Local timers for your food during an outage.' },
  food_zone_label:      { es: 'Zona: {name}',                                    en: 'Zone: {name}' },
  food_no_zone:         { es: 'Elige una zona para que los temporizadores sigan tu apagon.', en: 'Pick a zone so timers follow your outage.' },
  food_empty_tracked:   { es: 'Aun no sigues ningun alimento. Agrega los basicos que tengas en la nevera.', en: 'You are not tracking any food yet. Add the basics you keep in the fridge.' },
  food_presets_h:       { es: 'Alimentos comunes',                               en: 'Common foods' },
  food_custom_h:        { es: 'Agregar otro alimento',                           en: 'Add another food' },
  food_active_h:        { es: 'Temporizadores activos',                          en: 'Active timers' },
  food_tracked_h:       { es: 'Alimentos que sigues',                            en: 'Foods you track' },
  food_outage_prompt:   { es: 'Se detecto un apagon en tu zona. Revisa tus temporizadores de comida.', en: 'An outage was detected in your zone. Review your food timers.' },
  food_outage_review:   { es: 'Revisar',                                         en: 'Review' },
  food_stale_note:      { es: 'Sin datos recientes. Los temporizadores cuentan desde el ultimo apagon conocido.', en: 'No recent data. Timers count from the last known outage start.' },
  food_offline_note:    { es: 'Sin conexion. Seguimos contando desde el ultimo apagon conocido.', en: 'Offline. Still counting from the last known outage start.' },
  food_restored_h:      { es: 'Volvio la luz',                                   en: 'Power is back' },
  food_restored_note:   { es: 'Revisa el estado de la nevera y de cada alimento. No podemos saber si la comida quedo bien.', en: 'Check the fridge and each food. We cannot know whether the food is still good.' },
  food_restored_clear:  { es: 'Listo, revisado',                                 en: 'Done, reviewed' },
  food_level_safe:      { es: 'Aun con margen',                                  en: 'Still some margin' },
  food_level_warning:   { es: 'Revisar pronto',                                  en: 'Check soon' },
  food_level_expired:   { es: 'Paso el limite',                                  en: 'Past the limit' },
  food_caution_early:   { es: 'Avisamos antes del limite para que decidas con tiempo.', en: 'We warn before the limit so you can decide early.' },
  food_elapsed:         { es: 'Lleva {X}',                                       en: 'Elapsed {X}' },
  food_remaining:       { es: 'Margen {X}',                                      en: 'Margin {X}' },
  food_add_preset:      { es: 'Agregar',                                         en: 'Add' },
  food_added:           { es: 'Agregado',                                        en: 'Added' },
  food_add_custom:      { es: 'Guardar alimento',                               en: 'Save food' },
  food_remove:          { es: 'Quitar',                                          en: 'Remove' },
  food_reset:           { es: 'Reiniciar todo',                                  en: 'Reset all' },
  food_enable:          { es: 'Seguir',                                          en: 'Track' },
  food_disable:         { es: 'No seguir',                                       en: 'Stop tracking' },
  food_close:           { es: 'Cerrar',                                          en: 'Close' },
  food_name_label:      { es: 'Nombre del alimento',                            en: 'Food name' },
  food_name_ph:         { es: 'Ej: Sopa, jugo, pescado',                        en: 'E.g. soup, juice, fish' },
  food_threshold_label: { es: 'Limite en horas',                               en: 'Limit in hours' },
  food_threshold_ph:    { es: 'Horas',                                          en: 'Hours' },
  food_alerts_h:        { es: 'Avisos de comida',                              en: 'Food alerts' },
  food_alerts_body:     { es: 'Recordatorios locales para los alimentos que sigues. Tu lista de comida no se envia a Cocuyo.', en: 'Local reminders for the foods you track. Your food list is never sent to Cocuyo.' },
  food_alerts_enable:   { es: 'Activar avisos de comida',                       en: 'Enable food alerts' },
  food_alerts_soon:     { es: 'Los avisos automaticos llegan en una proxima actualizacion.', en: 'Automatic alerts arrive in a coming update.' },
  food_alerts_on:       { es: 'Avisos activos. Te avisaremos antes del limite, solo en este telefono.', en: 'Alerts on. We will remind you before the limit, on this phone only.' },
  food_alerts_off:      { es: 'Avisos desactivados. No se pedira permiso hasta que los actives.', en: 'Alerts off. No permission is requested until you turn them on.' },
  food_alerts_denied:   { es: 'Permiso de notificaciones denegado. Actívalo en los ajustes del telefono.', en: 'Notification permission denied. Enable it in phone settings.' },
};

// ── tt ─────────────────────────────────────────────────────────────────────────
// Look up a string by key and language.
// Falls back to the key itself when not found (never crashes).
// Falls back to Spanish when the English string is missing.
export function tt(key: string, lang: Lang = 'es'): string {
  const entry = STRINGS[key];
  if (!entry) return key;          // unknown key — return as-is
  return entry[lang] ?? entry.es;  // always falls back to Spanish
}

// ── formatDuration ─────────────────────────────────────────────────────────────
// Format elapsed_minutes into a human-readable duration string.
// Examples:
//   formatDuration(154, 'es') → "2 h 34 min"
//   formatDuration(45,  'es') → "45 min"
//   formatDuration(154, 'en') → "2h 34m"
//   formatDuration(null,'es') → "—"
export function formatDuration(min: number | null, lang: Lang): string {
  if (min == null) return '—';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m} min`;
  return lang === 'en' ? `${h}h ${m}m` : `${h} h ${m} min`;
}
