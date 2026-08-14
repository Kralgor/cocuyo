# Phase 3: Push Notifications - Context

**Gathered:** 2026-06-13
**Status:** Ready for planning

<domain>
## Phase Boundary

The pipeline detects per-zone power status transitions (previous vs current)
and fires push notifications via the Expo Push Service when a subscribed zone
goes out, comes back, or a neighboring zone goes out (early warning). Devices
register a push token plus their zone subscription in a new Supabase
`push_tokens` table (anonymous, anon-key write). The mobile app turns the
`notify` tab placeholder into a real screen: a permission/opt-in explainer,
and per-notification-type toggles.

Covers requirements: NOTF-01 (out), NOTF-02 (restored), NOTF-04 (neighbor
early warning), INFR-01 (pipeline fires Expo Push), INFR-02 (`push_tokens`
table), INFR-03 (transition detection). NOTF-03 (food spoilage) is Phase 4.

</domain>

<decisions>
## Implementation Decisions

### Zone Subscription Model
- **D-01:** Saved zone auto-subscribes on permission grant — the single zone
  already persisted in MMKV (Phase 1 D-03). No multi-zone follow list
  (ADVN-02 stays v2-deferred).
- **D-02:** The `notify` tab exposes per-type independent toggles: "Sin luz"
  (NOTF-01), "Volvió la luz" (NOTF-02), and "Aviso de zona vecina" (NOTF-04).
  Each can be turned on/off separately; all default ON after opt-in.
- **D-03:** When the user changes their saved zone, the subscription follows
  it (token row updated to the new zone). One active zone subscription per
  device.

### Notification Opt-In & Permission
- **D-04:** Permission is requested at point of use, NOT during onboarding
  (carries forward the Phase 2 trust pattern). The `notify` tab shows an
  "Activar notificaciones" explainer screen FIRST — states why, what is
  stored (push token + zone, anonymous), and that no identity/location is
  attached — then triggers the OS permission dialog on user action.
- **D-05:** Token registration POSTs to the new `push_tokens` table using the
  SUPABASE_ANON_KEY only (ADR-007). No `device_fingerprint` — deferred to
  Phase 4 (ADR-005). The row is anonymous: token, subscribed zone key,
  platform, per-type toggle prefs, timestamps. No user-identifying data.

### Neighboring-Zone Early Warning (NOTF-04)
- **D-06:** Use a hand-curated, symmetric adjacency map over the 17 canonical
  zones (geography + national grid awareness). Final locked map below.
  Neighbor warnings derive from the saved zone's neighbor list — no separate
  zone selection.
- **D-07:** Locked adjacency map (symmetric — if A lists B, B lists A):
  - **maracaibo** (Zulia): punto_fijo, valera
  - **punto_fijo** (Falcón): maracaibo, barquisimeto
  - **san_cristobal** (Táchira): merida, barinas
  - **merida** (Mérida): san_cristobal, valera, barinas
  - **valera** (Trujillo): merida, barinas, barquisimeto, maracaibo
  - **barinas** (Barinas): san_cristobal, merida, valera, barquisimeto
  - **barquisimeto** (Lara): punto_fijo, valera, barinas, valencia
  - **valencia** (Carabobo): barquisimeto, maracay
  - **maracay** (Aragua): valencia, los_teques, caracas
  - **caracas** (Distrito Capital): los_teques, guarenas_guatire, maracay
  - **los_teques** (Miranda): caracas, maracay, guarenas_guatire
  - **guarenas_guatire** (Miranda): caracas, los_teques, barcelona
  - **barcelona** (Anzoátegui): guarenas_guatire, cumana, maturin
  - **cumana** (Sucre): barcelona, porlamar, maturin
  - **maturin** (Monagas): barcelona, cumana, ciudad_guayana
  - **porlamar** (Nueva Esparta): cumana *(island — single mainland link)*
  - **ciudad_guayana** (Bolívar): maturin *(SE-isolated; Guri source)*
- **D-08:** Adjacency lives where both pipeline and app can agree on it. The
  pipeline owns notification fan-out, so the canonical neighbor map should sit
  pipeline-side (extend `pipeline/regions.py` or a sibling map module) and be
  mirrored into `mobile/lib/regions.ts` for any UI use. Planner/researcher to
  confirm the cleanest single-source approach without breaking the no-shared-
  code boundary (status.json could carry it, or both define it from the same
  reviewed list).

### Anti-Spam / Flapping Control + Copy
- **D-09:** Two-part suppression: (1) only notify on CONFIRMED/stable
  transitions, not every 10-min cycle flap; (2) per-zone, per-event-type
  cooldown window (no repeat notification within N hours — N to be set in
  planning, candidate ~2-3h). Build on existing `outage_lifecycle.py`
  (open/close events) and `restoration_tracker.py` rather than raw
  cycle-to-cycle diffs.
- **D-10:** Suppress notifications while a zone is in `unstable` status
  (bajones) — do not fire out/back on every flap. Only fire when the lifecycle
  confirms a real outage start or restoration.
- **D-11:** Notification copy is Spanish-first, factual, consistent with the
  app's honesty principle (no invented ETAs — only use status.json's outage
  estimate when present). Distinct copy per event type (out / restored /
  neighbor warning).

### Claude's Discretion
- Exact cooldown window length (N hours) and quiet-hours policy — propose in
  planning with rationale.
- Final Spanish copy wording per event type.
- `push_tokens` exact column shape and RLS policy details (must stay anon-key
  write-only, follow ADR-007 two-key model).
- Stale-token cleanup mechanism (Expo push receipt → remove dead tokens).
- Notification grouping/channel config (Android channels, iOS categories).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture & Data Contract
- `docs/ARCHITECTURE.md` — System architecture, data flow; MUST be updated for
  the new `push_tokens` table (project rule: schema changes update this doc).
- `docs/SPEC.md` — Full project spec, exact code patterns, status.json schema.
- `docs/adr/001-static-json-cdn.md` — Static JSON CDN constraint (no server for
  reads; push fan-out is pipeline-side, not a read API).
- `docs/adr/007-supabase-rls-two-key-model.md` — anon key only in client;
  service_role only in pipeline. Token registration is an anon-key write;
  pipeline reads tokens with service_role.
- `docs/adr/005-device-fingerprint-deferred.md` — no `device_fingerprint`
  until Phase 4; `push_tokens` rows stay anonymous.

### Data Schemas
- `docs/schema.sql` — current tables (outage_reports, outage_history,
  active_outages); add `push_tokens` here.
- `pipeline/regions.py` — 17 canonical zone keys + state + coords; home of the
  locked adjacency map (D-07).
- `mobile/lib/regions.ts` — mobile mirror of the 17 zones.

### Pipeline Transition Detection (reuse, don't reinvent)
- `pipeline/main.py` — cycle orchestrator; where notify fan-out hooks in.
- `pipeline/outage_lifecycle.py` — active_outages open/close events (confirmed
  transitions basis for D-09/D-10).
- `pipeline/restoration_tracker.py` — multi-signal power-back detection
  (basis for NOTF-02 confirmed restoration).

### Mobile Integration Points
- `mobile/lib/api.ts` — fetchStatus + submitReport pattern; add token
  registration POST here following the same never-throw `{data, offline}` shape.
- `mobile/lib/storage.ts` — MMKV wrapper for permission state + toggle prefs.
- `mobile/app/(tabs)/notify.tsx` — placeholder → real opt-in + toggles screen.
- `mobile/app.json` — `extra` config pattern (statusCdnUrl, anon key); Expo
  push project config goes here.

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — NOTF-01, NOTF-02, NOTF-04, INFR-01/02/03.
- `.planning/ROADMAP.md` — Phase 3 success criteria.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `pipeline/outage_lifecycle.py` + `restoration_tracker.py` — already detect
  confirmed outage start / power-back; the notify trigger should consume these
  events, not raw cycle diffs.
- `mobile/lib/api.ts` — typed never-throw fetch wrappers; token POST follows
  the Phase 2 `submitReport` anon-key pattern.
- `mobile/lib/regions.ts` / `pipeline/regions.py` — single source of 17 zones;
  adjacency map extends these.
- `mobile/lib/storage.ts` (MMKV) — store permission-granted flag + per-type
  toggle prefs locally.
- `mobile/app/(tabs)/notify.tsx` — 160B placeholder, becomes the real screen.

### Established Patterns
- Pipeline collectors/lifecycle: typed returns, isolated try/except, never
  block the cycle on one failure — notify fan-out must follow this (a push
  failure must not abort the pipeline; exit-code semantics in main.py).
- Supabase two-key model (ADR-007): anon write / service_role read.
- Mobile: StyleSheet + ThemeProvider, Spanish-primary i18n via
  `mobile/lib/i18n.ts`, useSafeAreaInsets.
- Permission requested at point of use, never in onboarding (Phase 2 trust).

### Integration Points
- New Supabase `push_tokens` table — additive; needs RLS for anon insert/upsert
  and service_role read. Update `docs/schema.sql` + `docs/ARCHITECTURE.md`.
- Pipeline reads `push_tokens` (service_role) at notification time, resolves
  subscribers + neighbors, calls Expo Push API (`https://exp.host/--/api/v2/push/send`).
- New env/secret for any Expo push auth (Expo access token if using push
  security) — GitHub Actions environment `cocuyo`.
- New mobile deps: `expo-notifications` (+ `expo-device` typically). Expo
  ecosystem only.

</code_context>

<specifics>
## Specific Ideas

- Expo Push Service as the single relay for Android + iOS (one token/endpoint)
  — locked pre-dev decision (STATE.md). Not raw FCM/APNs integration despite
  PROJECT.md "Push infra" wording — Expo wraps both.
- Notification copy honesty principle: never invent an ETA. Mirror the Phase 2
  share-text tone — factual, Spanish-first.
- Suppression matters for trust AND battery: Venezuelan zones flap constantly
  (bajones); spamming notifications would burn trust and battery during the
  exact moments users are conserving both.

</specifics>

<deferred>
## Deferred Ideas

- Multi-zone follow list (subscribe to several zones) — ADVN-02, v2.
- Quiet-hours / do-not-disturb scheduling — candidate enhancement; decide in
  planning whether in-scope or follow-up.
- Food spoilage notifications (NOTF-03) — Phase 4.

### Reviewed Todos (not folded)
- "Parroquia-level reporting (hyperlocal)"
  (`.planning/todos/pending/2026-06-11-parroquia-level-reporting-hyperlocal.md`)
  — weak match (0.6); it is reporting/scoring scope, not push notifications.
  Stays deferred until user density (per Phase 2 CONTEXT).

</deferred>

---

*Phase: 3-Push Notifications*
*Context gathered: 2026-06-13*
