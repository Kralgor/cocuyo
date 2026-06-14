# Phase 4: Food Spoilage Timers - Context

**Gathered:** 2026-06-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can track food safety during outages from the mobile Food tab. The phase turns the current food placeholder into a local, offline-capable timer experience with a pre-built basic Venezuelan grocery list, custom food items, automatic timer start when the saved zone enters an outage, and spoilage-warning notifications.

Covers requirements: FOOD-01 (pre-built food list), FOOD-02 (custom food items), FOOD-03 (auto-start on outage detection), FOOD-04 (timer tracking), and NOTF-03 (food spoilage warning notification).

</domain>

<decisions>
## Implementation Decisions

### Food Catalog Scope
- **D-01:** Keep the pre-built list focused on basic groceries, not restaurant inventory or niche items. Use everyday Venezuelan staples and common perishables that families are likely to have during outages.
- **D-02:** Suggested starter categories: dairy, meats, eggs, cooked leftovers, grains/prepared staples, vegetables/fruits, and refrigerated medicines only if already represented as a simple item type. Exact item list and thresholds are Claude/planner discretion, but should stay conservative and easy to understand.
- **D-03:** Food names and safety copy are Spanish-first. English can follow the existing i18n pattern, but the primary UX should be direct Spanish for Venezuelan users.

### Timer Start Behavior
- **D-04:** Auto-start timers when the saved zone enters an active outage, using the same saved-zone/status flow already established in mobile. The app should not require users to manually start every timer during an outage.
- **D-05:** Auto-start applies to foods the user has chosen to track, not every catalog item by default. The Food tab should make it easy to add basic groceries before or during an outage.
- **D-06:** Timers must be local and offline-capable. Persist tracked foods and timer state in MMKV so timers remain useful when internet is unavailable.

### Power-Restored Behavior
- **D-07:** When power returns, do not silently declare food safe. Show a factual "check food/fridge condition" state and let the planner decide the exact pause/stop/resume behavior.
- **D-08:** If an outage is unstable or status data is stale, copy should be honest about uncertainty. Do not invent fridge temperature, safety guarantees, or restoration certainty.

### Warning Thresholds + Notifications
- **D-09:** Food spoilage notifications are in scope for Phase 4 as NOTF-03. They should warn before a tracked item approaches its unsafe threshold, not only after expiration.
- **D-10:** Keep notification behavior simple: local-first warnings are acceptable if push scheduling is unnecessary for offline timers. If Phase 3 push infrastructure is useful, integrate without adding accounts or identity.
- **D-11:** Permission requests stay point-of-use, carrying forward the Phase 2/3 trust pattern. Do not ask for notification permission during onboarding just for food timers.

### Custom Food UX
- **D-12:** Custom foods should stay lightweight: name plus spoilage threshold is enough for v1. Category/preset selection is useful if it reduces typing, but do not build a complex inventory system.
- **D-13:** Users should be able to remove or reset tracked foods quickly. This is a utility workflow during stressful outages, not a pantry management app.

### Claude's Discretion
- Exact basic-grocery item list, default thresholds, warning lead time, timer card layout, local notification scheduling details, and whether power restoration pauses or stops timers are delegated to Claude/planner, as long as the implementation stays simple, factual, offline-capable, and limited to basic groceries.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/ROADMAP.md` — Phase 4 goal and success criteria for Food Spoilage Timers.
- `.planning/REQUIREMENTS.md` — FOOD-01, FOOD-02, FOOD-03, FOOD-04, and NOTF-03 requirement definitions.

### Prior Phase Decisions
- `.planning/phases/01-foundation-offline-core/01-CONTEXT.md` — Mobile shell, five-tab structure, MMKV saved zone, offline status display, ThemeProvider, and Spanish fallback decisions.
- `.planning/phases/02-reporting-sharing-quick-wins/02-CONTEXT.md` — Point-of-use permission pattern, MMKV offline queue precedent, Spanish factual copy, AMOLED/battery constraints.
- `.planning/phases/03-push-notifications/03-CONTEXT.md` — Expo notification infrastructure, anonymous push token model, per-type notification preferences, and NOTF-03 explicitly deferred to Phase 4.

### Mobile Implementation Surfaces
- `mobile/app/(tabs)/food.tsx` — Current Food tab placeholder; primary screen to implement.
- `mobile/app/(tabs)/notify.tsx` — Existing notification preference UI pattern to reference for NOTF-03 controls if needed.
- `mobile/hooks/useStatus.ts` — Current status fetching hook; use saved-zone status to detect active outage for timer auto-start.
- `mobile/lib/api.ts` — StatusJson/RegionEntry contracts and existing Supabase/notification API patterns.
- `mobile/lib/storage.ts` — MMKV storage wrapper and key registry; add food timer/tracked food keys here.
- `mobile/lib/regions.ts` — Canonical 17-zone metadata and adjacency map already mirrored into mobile.
- `mobile/lib/i18n.ts` — Spanish/English string lookup pattern.

### System Constraints
- `docs/ARCHITECTURE.md` — Static status.json read model, pipeline/mobile boundaries, and architecture update expectations.
- `docs/SPEC.md` — Project spec and product context, including food safety as a core outage value.
- `docs/adr/001-static-json-cdn.md` — Mobile reads status from static CDN; no new read API for status.
- `docs/adr/007-supabase-rls-two-key-model.md` — Client uses anon key only; no service_role in mobile.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `mobile/app/(tabs)/food.tsx`: currently renders `<PlaceholderTab icon="restaurant-outline" />`; this phase replaces it with the real food timer UI.
- `mobile/lib/storage.ts`: existing MMKV wrapper should store tracked foods, timer starts, dismissals, and notification preference state. No storage reads at module load.
- `mobile/hooks/useStatus.ts`: fetches and caches status.json; use this as the source for saved-zone outage state and staleness handling.
- `mobile/lib/api.ts`: defines `StatusJson`, `RegionEntry`, and outage metadata such as `outage.started_at` and `elapsed_minutes`; useful for deriving timer start time.
- `mobile/app/(tabs)/notify.tsx` and `mobile/hooks/useNotifications.ts`: reference for permission-gated notification UX and Expo notification integration.
- `mobile/lib/i18n.ts`: extend with Food tab strings instead of hardcoding large copy blocks.

### Established Patterns
- Mobile uses React Native + Expo Router, `StyleSheet.create()`, typed theme tokens via `useTheme()`, and Spanish-primary UI copy.
- Local app state uses MMKV. Follow the existing `STORAGE_KEYS` pattern and avoid storage reads at module level.
- Status/network wrappers are typed and defensive; offline/stale states are visible rather than hidden.
- Permissions are requested when users intentionally activate a feature, not during onboarding.
- The app is anonymous. Do not add accounts, identity, or food inventory sync.

### Integration Points
- Food timers consume saved-zone outage status from mobile status data and local tracked food state from MMKV.
- NOTF-03 integrates with Expo notification capabilities added in Phase 3, but should remain useful when offline via local scheduling where possible.
- If schema changes are proposed, they must be justified; default assumption is no backend schema required for local food timers.

</code_context>

<specifics>
## Specific Ideas

- User explicitly chose: "Claude decide" and "food keep it with basic groceries."
- Treat the Food tab as a practical outage utility, not a pantry management app.
- Prefer conservative, understandable safety thresholds over complex scientific modeling.

</specifics>

<deferred>
## Deferred Ideas

- Rich pantry inventory, shopping lists, barcode scanning, restaurant/business inventory, fridge temperature sensors, medication-specific workflows, cloud sync, and household sharing are out of scope unless separately planned.

### Reviewed Todos (not folded)
- "Parroquia-level reporting (hyperlocal)" (`.planning/todos/pending/2026-06-11-parroquia-level-reporting-hyperlocal.md`) — weak match (0.4); reporting/scoring scope, not food timer scope.

</deferred>

*Phase: 4-Food Spoilage Timers*
*Context gathered: 2026-06-14*
