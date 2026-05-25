---
phase: 01-foundation-offline-core
plan: 01b
type: execute
wave: 2
depends_on: ["01-01a"]
files_modified:
  - mobile/lib/api.ts
  - mobile/lib/storage.ts
  - mobile/lib/regions.ts
  - mobile/lib/i18n.ts
  - mobile/lib/theme.ts
  - mobile/lib/query.ts
  - mobile/constants/colors.ts
  - mobile/__tests__/lib/api.test.ts
  - mobile/__tests__/lib/storage.test.ts
  - mobile/__tests__/lib/i18n.test.ts
  - mobile/__tests__/lib/statusColor.test.ts
  - mobile/__tests__/lib/regionFilter.test.ts
autonomous: true
requirements: [STAT-01, STAT-02]

must_haves:
  truths:
    - "fetchStatus() returns typed StatusJson from the CDN, or { data: null, offline: true } on network failure"
    - "All 17 region keys from pipeline/regions.py exist in mobile/lib/regions.ts with identical keys"
    - "Outage duration formats from elapsed_minutes into 'Hace Xh Ym' (ES) / 'Xh Ym' (EN)"
    - "statusColor() maps each pipeline status to the correct theme token"
    - "Jest test suite runs green with jest-expo preset and MMKV mocked"
  artifacts:
    - path: "mobile/lib/api.ts"
      provides: "StatusJson/RegionEntry/OutageInfo interfaces + fetchStatus()"
      contains: "export interface StatusJson"
    - path: "mobile/lib/regions.ts"
      provides: "17 region keys + ZONE_SECTIONS state grouping + filterSections()"
      contains: "ciudad_guayana"
    - path: "mobile/lib/query.ts"
      provides: "QueryClient + MMKV persister"
      contains: "networkMode"
    - path: "mobile/constants/colors.ts"
      provides: "LIGHT_THEME + DARK_THEME palettes"
      contains: "#E8C840"
  key_links:
    - from: "mobile/lib/api.ts"
      to: "expo-constants"
      via: "Constants.expoConfig.extra.statusCdnUrl"
      pattern: "Constants\\.expoConfig"
    - from: "mobile/lib/query.ts"
      to: "react-native-mmkv"
      via: "createSyncStoragePersister with MMKV adapter"
      pattern: "createSyncStoragePersister"
---

<objective>
Build the entire non-UI foundation layer of the `mobile/` app: the core `lib/` modules (api, storage, regions, i18n, theme, query) plus `constants/colors.ts`, with their unit tests. This is Wave 2 — it runs on top of the scaffolded project + test harness from Plan 01-01a. Everything else in the phase imports from these modules.

Purpose: Establish the offline-first data contract, MMKV storage layer, React Query persister, fresh mobile theme, i18n, and region registry. Resolves the Wave 0 test gaps from VALIDATION.md so downstream tasks have a green sampling baseline.
Output: Typed status.json contract, MMKV storage, React Query persister configured offlineFirst, mobile theme + status mapping, i18n with duration formatting, 17-region registry with search, and 5 passing unit-test files.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/01-foundation-offline-core/01-RESEARCH.md
@.planning/phases/01-foundation-offline-core/01-PATTERNS.md
@.planning/phases/01-foundation-offline-core/01-UI-SPEC.md
@.planning/phases/01-foundation-offline-core/01-VALIDATION.md
@.planning/phases/01-foundation-offline-core/01-01a-SUMMARY.md
@app/lib/api.ts
@app/lib/i18n.ts
@pipeline/regions.py

<interfaces>
<!-- The data contract — copy these verbatim into mobile/lib/api.ts. Source: app/lib/api.ts lines 3-65 -->
StatusJson, RegionEntry, OutageInfo (has started_at + elapsed_minutes), RegionSignals
(internet/satellite/crowdsource/weather: number|null), CrowdInfo, RationingPattern,
OutageEstimatedRemaining. fetchStatus() returns { data: StatusJson | null; offline: boolean }.

17 region keys (from pipeline/regions.py, copy ALL): maracaibo, san_cristobal, merida,
valera, barquisimeto, punto_fijo, valencia, maracay, caracas, los_teques, guarenas_guatire,
barinas, maturin, barcelona, cumana, porlamar, ciudad_guayana. Each has display_name, state, lat, lon.

<!-- From Plan 01-01a (already scaffolded) — use directly -->
mobile/ Expo SDK 56 project with all Phase 1 packages installed.
mobile/jest.config.js + jest.setup.js: jest-expo preset with react-native-mmkv + netinfo mocked.
app.json extra.statusCdnUrl populated (read via Constants.expoConfig.extra.statusCdnUrl).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Core lib modules — api, storage, regions, i18n, theme, query, colors</name>
  <files>mobile/lib/api.ts, mobile/lib/storage.ts, mobile/lib/regions.ts, mobile/lib/i18n.ts, mobile/lib/theme.ts, mobile/lib/query.ts, mobile/constants/colors.ts</files>
  <read_first>
    - app/lib/api.ts (StatusJson/RegionEntry/OutageInfo interfaces — copy verbatim, lines 3-65)
    - app/lib/i18n.ts (tt() + formatDuration() pattern)
    - pipeline/regions.py (all 17 region keys + state names — copy exactly)
    - .planning/phases/01-foundation-offline-core/01-PATTERNS.md (Pattern Assignments for each lib file)
    - .planning/phases/01-foundation-offline-core/01-RESEARCH.md (Pattern 1 query.ts, Pattern 5 theme, Pattern 6 sections, Pattern 7 statusColor/statusLabel)
    - .planning/phases/01-foundation-offline-core/01-UI-SPEC.md (Color palette hex values, Copywriting Contract strings, MobileTheme token reference)
  </read_first>
  <behavior>
    - api.test: fetchStatus() returns { data: StatusJson, offline: false } on a mocked 200 response; returns { data: null, offline: true } when fetch throws
    - storage.test: storage.set then getString/getBoolean/getNumber round-trips via mocked MMKV; STORAGE_KEYS has hasSeenOnboarding, selectedZone, themeOverride, cacheTimestamp
    - i18n.test: tt('comenzar','es') returns Spanish, tt('comenzar','en') returns English, unknown key returns the key; formatDuration(154,'es') returns "2 h 34 min", formatDuration(45,'es') returns "45 min", formatDuration(null,'es') returns "—"
    - statusColor.test: statusColor('no_power',theme)===theme.danger, 'unstable'===theme.warn, 'power_back'===theme.ok, 'normal'===theme.ok, 'no_data'===theme.inkFaint; statusLabel('no_power','es')==='SIN LUZ', statusLabel('power_back','en')==='POWER ON'
    - regionFilter.test: filterSections('mara') returns maracaibo and maracay, filterSections('zzz') returns []
  </behavior>
  <action>
    Create api.ts copying the StatusJson/RegionEntry/OutageInfo/RegionSignals/CrowdInfo/RationingPattern/OutageEstimatedRemaining interfaces verbatim from app/lib/api.ts; replace the env-var STATUS_URL with Constants.expoConfig?.extra?.statusCdnUrl from expo-constants (fallback "https://cdn.cocuyo.app/status.json"); fetchStatus() uses `fetch(url, { headers: { 'Cache-Control': 'no-cache' } })` (React Native has no cache option) and returns { data: StatusJson|null; offline: boolean } — never throws. storage.ts exports `storage = new MMKV({ id: 'cocuyo' })` at module level plus a STORAGE_KEYS const object (hasSeenOnboarding, selectedZone, themeOverride, cacheTimestamp='statusCacheTimestamp'); never call getters at module level (RESEARCH.md Pitfall 1); add an ADR-007 comment noting no Supabase in Phase 1. regions.ts translates all 17 keys from pipeline/regions.py into a REGIONS Record<string, RegionMeta> with identical keys/display_name/state/lat/lon, plus ZONE_SECTIONS array grouping zones by state per RESEARCH.md Pattern 6 (Miranda groups los_teques + guarenas_guatire), and an exported filterSections(query) helper that filters sections + items case-insensitively and drops empty sections. i18n.ts ports tt() and formatDuration() from app/lib/i18n.ts and adds the mobile string keys from UI-SPEC.md Copywriting Contract (trust points, comenzar, search_placeholder, no_results, stale_banner, coming_soon, status_* labels, settings strings); use the {X}/{Y}/{N} placeholder format from UI-SPEC. theme.ts defines the MobileTheme interface (bg, panel, ink, inkDim, inkFaint, accent, ok, warn, danger, line, lineStrong) and statusColor()/statusLabel() per RESEARCH.md Pattern 7. constants/colors.ts exports LIGHT_THEME and DARK_THEME using the exact hex values from UI-SPEC.md Color palette tables. query.ts builds the MMKV-backed persister and QueryClient with gcTime 24h, staleTime 9min, networkMode 'offlineFirst', retry 3 (RESEARCH.md Pattern 1 — never networkMode 'online', never gcTime < staleTime). Use `// ── section ──` dividers throughout per CLAUDE.md. No `any` types (strict mode).
  </action>
  <verify>
    <automated>cd mobile && npx jest --testPathPattern="lib/(api|storage|i18n|statusColor|regionFilter)" --passWithNoTests && npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - mobile/lib/api.ts contains "export interface StatusJson" and "export async function fetchStatus"
    - mobile/lib/api.ts contains "Constants.expoConfig" (CDN URL from expo-constants, not process.env)
    - mobile/lib/regions.ts contains all 17 keys including "ciudad_guayana" and "guarenas_guatire"; ZONE_SECTIONS Miranda section data includes both los_teques and guarenas_guatire; exports filterSections
    - mobile/lib/query.ts contains "networkMode" set to 'offlineFirst' and "createSyncStoragePersister"
    - mobile/constants/colors.ts contains "#E8C840" (accent) and exports LIGHT_THEME and DARK_THEME
    - mobile/lib/theme.ts statusColor('no_power', theme) returns theme.danger (proven by statusColor.test.ts)
    - `cd mobile && npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>All core lib modules exist, typecheck clean, and the behaviors above are unit-tested with MMKV mocked.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: lib unit tests — api, storage, i18n, statusColor, regionFilter</name>
  <files>mobile/__tests__/lib/api.test.ts, mobile/__tests__/lib/storage.test.ts, mobile/__tests__/lib/i18n.test.ts, mobile/__tests__/lib/statusColor.test.ts, mobile/__tests__/lib/regionFilter.test.ts</files>
  <read_first>
    - .planning/phases/01-foundation-offline-core/01-VALIDATION.md (Wave 0 Requirements, Per-Task Verification Map)
    - .planning/phases/01-foundation-offline-core/01-RESEARCH.md (Validation Architecture, MMKV mock note)
    - .planning/phases/01-foundation-offline-core/01-PATTERNS.md (Test files section)
    - mobile/lib/api.ts, mobile/lib/storage.ts, mobile/lib/i18n.ts, mobile/lib/theme.ts, mobile/lib/regions.ts (Task 1 targets)
  </read_first>
  <action>
    Author the five lib test files under __tests__/lib/ asserting the behaviors from Task 1's behavior block. api.test.ts mocks global fetch to assert both the 200 path and the throw path. storage.test.ts relies on the MMKV in-memory mock from jest.setup.js (Plan 01-01a) and round-trips set/getString/getBoolean/getNumber plus asserts STORAGE_KEYS has hasSeenOnboarding, selectedZone, themeOverride, cacheTimestamp. i18n.test.ts asserts tt() ES/EN/unknown and formatDuration() for 154/45/null minutes. statusColor.test.ts asserts statusColor()/statusLabel() mappings. regionFilter.test.ts asserts filterSections('mara') returns both maracaibo and maracay and filterSections('zzz') returns []. Note: VALIDATION.md references flat filenames (statusColor.test.ts); place tests under __tests__/lib/ and keep the jest testPathPattern matching "lib/" so the sampling commands resolve. Do NOT add watch-mode flags.
  </action>
  <verify>
    <automated>cd mobile && npx jest</automated>
  </verify>
  <acceptance_criteria>
    - mobile/__tests__/lib/regionFilter.test.ts asserts "mara" search returns both maracaibo and maracay, and "zzz" returns []
    - mobile/__tests__/lib/api.test.ts asserts both fetch-200 and fetch-throw paths
    - mobile/__tests__/lib/i18n.test.ts asserts formatDuration(154,'es') === "2 h 34 min" and formatDuration(null,'es') === "—"
    - `cd mobile && npx jest` exits 0 with all 5 lib test files passing
    - No watch-mode flags present in any test command
  </acceptance_criteria>
  <done>Full Jest suite runs green; MMKV mocked via Plan 01-01a's harness; Wave 0 test gaps from VALIDATION.md are closed (api, storage, i18n, statusColor, regionFilter).</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| CDN → mobile app | status.json fetched over TLS from Cloudflare R2; untrusted-but-public read-only data |
| MMKV device storage → app | zone/theme/onboarding flags + cache timestamp persisted locally |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-01-02 | Tampering | status.json from CDN | accept | Read-only non-critical data; rely on CDN TLS. No integrity check in Phase 1 (per RESEARCH.md Security Domain). |
| T-01-12 | Information Disclosure | MMKV stored keys | accept | Only zone name + theme pref + onboarding flag + cache timestamp stored; no PII, no secrets (privacy constraint). |
| T-01-SC | Tampering | npm package installs | mitigate | No new packages installed in this plan; all from Plan 01-01a's audited set. |
</threat_model>

<verification>
- `cd mobile && npx tsc --noEmit` exits 0 (strict mode, no `any`)
- `cd mobile && npx jest` exits 0 (all 5 lib test files green)
- All 17 region keys present: `grep -c "display_name" mobile/lib/regions.ts` >= 17
- CDN URL from expo-constants: `grep -q "Constants.expoConfig" mobile/lib/api.ts`
</verification>

<success_criteria>
- StatusJson contract matches app/lib/api.ts exactly (STAT-01 data layer)
- Duration formatting works for hours+minutes and minutes-only (STAT-02)
- 17 region keys identical to pipeline/regions.py with searchable filterSections
- React Query + MMKV persister configured offlineFirst (STAT-03 foundation for Plan 02 hooks)
- Jest suite green — Wave 0 baseline established
</success_criteria>

<output>
Create `.planning/phases/01-foundation-offline-core/01-01b-SUMMARY.md` when done
</output>
</content>
