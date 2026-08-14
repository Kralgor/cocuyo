# Phase 2: Reporting + Sharing + Quick Wins - Context

**Gathered:** 2026-06-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can submit outage reports (online and offline, with optional parroquia
tagging), share status to WhatsApp, access emergency contacts for their zone,
and the app conserves battery (AMOLED true-black + low-battery refresh
reduction). Reports POST to the same Supabase `outage_reports` table as the
web app — no backend changes for submission beyond one additive nullable
column (`parroquia`).

</domain>

<decisions>
## Implementation Decisions

### Report Submission UX
- Two big buttons on Report tab: "Se fue la luz" / "Volvió la luz" — one tap + confirm toast. Matches web ReportButtons; zero friction.
- GPS zone detect: on report-tab open, GPS resolves nearest of 17 zones, prefilled with manual picker override; 10s timeout falls back to saved zone. Location permission requested at first report, NOT during onboarding (trust).
- Offline queue: MMKV-backed queue + NetInfo connectivity listener auto-sync + sync on app open. UI state: "Guardado — se enviará al volver la conexión".
- Parroquia tagging INCLUDED NOW: optional cascading picker (municipio → parroquia) on report confirm. New nullable `parroquia` column on `outage_reports` (additive — web sends null). Schema change requires docs/ARCHITECTURE.md update (project rule). GPS→parroquia polygon auto-detect DEFERRED (needs bundled ADM3 polygons). See `.planning/todos/pending/2026-06-11-parroquia-level-reporting-hyperlocal.md`.
- Client-side dedupe: 1 report per ~30 min stored locally (aligns with pipeline IP rate limiting; prevents accidental spam).

### WhatsApp Sharing
- Format: pre-formatted Spanish text — status + duration + ETA + link. Image card via react-native-view-shot is a STRETCH goal only.
- Entry points: share button on zone hero + auto-prompt after report submit ("Avisa a tus vecinos").
- Link target: https://app.cocuyo.kralgor.com (swap to store link post Phase 5).
- Channel: Linking to `whatsapp://send?text=` with system share-sheet fallback when WhatsApp absent.

### Emergency Contacts
- Bundled static JSON per state: national numbers verified (911, Corpoelec national), per-state entries scaffolded but marked "por verificar" — per-state research is a USER task (STATE.md blocker).
- Placement: "Números útiles" card section at bottom of Zone tab.
- Tap: `tel:` link opens dialer.
- Updates ship via EAS Update (bundled JSON, no CDN fetch).

### Battery + AMOLED
- AMOLED true-black: third theme variant in Settings extending dark theme with #000000 backgrounds (locked by Phase 1 D-06).
- Low battery: expo-battery listener; below 20% → status refresh interval 10min→30min, animations paused.
- Visibility: one-line banner "Modo ahorro activo" when engaged, tappable to override for session.
- New deps allowed: expo-battery, @react-native-community/netinfo, expo-location (+ react-native-view-shot only if stretch attempted). Expo-ecosystem only.

### Claude's Discretion
- Exact toast/confirm visuals, queue retry backoff, share text wording polish, contacts JSON shape.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- mobile/lib/api.ts — fetchStatus + typed StatusJson; submitReport must be ADDED here (web reference: app/lib/api.ts:95 payload {region, status, lat, lon, city_freetext, onset_type:null, symptom:null, device_fingerprint:null per ADR-005}).
- mobile/lib/storage.ts — MMKV wrapper; ADR-007 comment confirms SUPABASE_ANON_KEY enters in Phase 2 for report submission ONLY.
- mobile/lib/regions.ts — 17 canonical zones; mobile/components/ZonePicker.tsx — grouped picker with search.
- mobile/hooks/useStatus.ts + useOffline.ts — refresh loop to extend for battery throttling.
- mobile/lib/theme.ts + hooks/useTheme.ts — theme system to extend with AMOLED variant.
- mobile/app/(tabs)/report.tsx — currently PlaceholderTab; becomes real screen.

### Established Patterns
- StyleSheet.create() + ThemeProvider (D-04), typed tokens, useSafeAreaInsets, Spanish-primary i18n via mobile/lib/i18n.ts.
- Collectors/API: typed returns, never-throw fetch wrappers ({data, offline} shape).

### Integration Points
- Supabase REST: POST ${SUPABASE_URL}/rest/v1/outage_reports with anon key headers (web app/lib/api.ts HEADERS pattern). Env via app.json extra (like statusCdnUrl) — NEVER service_role (ADR-007).
- docs/schema.sql + docs/ARCHITECTURE.md must gain the nullable parroquia column documentation.
- Live status URL already fixed: https://cocuyo.kralgor.com/status.json.

</code_context>

<specifics>
## Specific Ideas

- Share text Spanish-first, factual tone consistent with app's honesty principle (no invented ETAs — use status.json outage estimate only when present).
- Parroquia inspiration: radarnacionalven.blogspot.com (hyperlocal crowdsourcing, 12h report expiry display).
- WhatsApp share doubles as primary growth loop (incentives discussion 2026-06-11).

</specifics>

<deferred>
## Deferred Ideas

- GPS point-in-polygon parroquia auto-detect (needs geoBoundaries ADM3 bundle) — later phase.
- Parroquia-level SCORED status (quorum per parroquia) — deferred until user density; pipeline work.
- Image share cards (react-native-view-shot) — stretch in this phase, full feature later.
- Raffle/incentive mechanics in-app — separate future phase.

</deferred>
