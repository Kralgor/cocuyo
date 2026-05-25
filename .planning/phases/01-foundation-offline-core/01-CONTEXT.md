# Phase 1: Foundation + Offline Core - Context

**Gathered:** 2026-05-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Expo scaffold with offline-cached status display, trust onboarding, and the navigation shell everything else plugs into. Users can open the app, see current outage status for any zone, view it offline with a staleness indicator, and trust the app is not government surveillance.

</domain>

<decisions>
## Implementation Decisions

### App Shell & Navigation
- **D-01:** Full 5-tab bar built in Phase 1. Non-Phase-1 tabs show "Coming in next update" placeholder. Tabs are adapted for mobile (not matching web verbatim — Claude picks appropriate mobile labels and icons).
- **D-02:** Settings accessible via header gear icon (top-right of Zone tab). Opens as modal/sheet. No settings tab.
- **D-03:** Persist last-viewed zone in MMKV. First launch shows zone picker after trust onboarding. Subsequent launches open directly to saved zone.

### Styling Foundation
- **D-04:** StyleSheet.create() + ThemeProvider context. No NativeWind. Theme object with typed color tokens consumed via useTheme() hook.
- **D-05:** Fresh mobile-native palette. Not porting web's tinta/estudio themes. Keep Cocuyo brand feel but optimize colors for mobile (sunlight readability, OLED contrast, battery).
- **D-06:** Phase 1 ships with light + dark mode. ThemeProvider detects device system preference by default. User can override in settings. Phase 2 adds AMOLED true-black variant on top.

### Trust Onboarding
- **D-07:** Single full-screen trust screen on first launch. Content: Cocuyo logo, 4 trust points (open source/verify on GitHub, 100% anonymous/no accounts, no political affiliation/made by Venezuelans, works offline/data stored locally), GitHub link button, "Comenzar" CTA.
- **D-08:** Trust screen shows once only (MMKV flag `hasSeenOnboarding`). Same content permanently accessible in Settings > About/Privacy section (TRST-02).
- **D-09:** Language detection follows device locale. Spanish if locale is ES, English if EN, Spanish fallback for everything else.
- **D-10:** Trust screen and zone selection are separate sequential steps. Trust → dismiss → zone picker appears.

### Zone Picker & Status Display
- **D-11:** Zone picker shows 17 zones grouped by state (Zulia, Bolívar, Miranda, etc.) with state header dividers. Search bar at top for quick filtering. Each zone row shows a colored status dot.
- **D-12:** Zone detail screen uses hero status layout: large color-coded status block (SIN LUZ / CON LUZ / INESTABLE) at top, outage duration ("Hace 2h 34m") below, then signal breakdown cards (Internet, Reportes, Satélite) with bar indicators.
- **D-13:** Offline staleness banner is always visible and non-dismissible when cache is older than 15 minutes. Yellow/orange bar: "Última actualización hace X min — sin conexión".

### Claude's Discretion
- **D-14:** First-launch empty state (before any data fetch): Claude decides the best approach. Recommended direction: show zone picker immediately after trust screen; once zone is selected, display skeleton/shimmer cards while fetching; if fetch fails on first launch (no internet), show "Sin datos aún — conecta a internet para la primera carga" message.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture & Data Contract
- `docs/ARCHITECTURE.md` — System architecture, data flow, component responsibilities
- `docs/SPEC.md` — Full project specification with exact code patterns, API response formats, data schemas
- `docs/adr/001-static-json-cdn.md` — Static JSON CDN architecture (core constraint for mobile: read status.json from CDN only)
- `docs/adr/007-supabase-rls-two-key-model.md` — Only SUPABASE_ANON_KEY in client apps, never service_role

### Data Schemas
- `app/lib/api.ts` — StatusJson and RegionEntry TypeScript interfaces (the data contract mobile must consume)
- `pipeline/regions.py` — 17 canonical region keys, display names, coordinates (mobile must use same keys)
- `docs/schema.sql` — Supabase database schema

### Existing Frontend Patterns
- `app/lib/i18n.ts` — Spanish/English string lookup pattern (reference for mobile i18n approach)
- `app/lib/theme.ts` — Web theme structure (reference, not to copy — mobile uses fresh palette)
- `app/components/mobile/MobileShell.tsx` — Web mobile shell pattern (reference for navigation structure)

### Requirements
- `.planning/REQUIREMENTS.md` — Phase 1 requirements: STAT-01, STAT-02, STAT-03, TRST-01, TRST-02, PLAT-01, PLAT-02, PLAT-03
- `.planning/ROADMAP.md` — Phase 1 success criteria and phase dependencies

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/lib/api.ts`: StatusJson interface (lines 47-58) — mobile must implement the same typed interface for status.json parsing
- `app/lib/i18n.ts`: String lookup pattern — can adapt the same key-based approach for React Native
- `pipeline/regions.py`: REGIONS dict with all 17 zone keys, display names, coordinates — mobile needs identical region key mapping
- `app/lib/demoData.ts`: Demo/mock status data — useful for mobile development and testing without CDN

### Established Patterns
- Data fetching returns `{ data: T | null; offline: boolean }` — same pattern should apply in mobile
- Status values are string literals: `'no_power' | 'power_back' | 'unstable' | 'normal' | 'no_data'` etc.
- Components receive theme/lang as props — mobile should follow similar dependency injection via context
- Section dividers use `// ── section name ─────────` — maintain in mobile TypeScript

### Integration Points
- CDN endpoint for status.json (`NEXT_PUBLIC_STATUS_URL` / configurable URL) — mobile fetches from same CDN
- The mobile app is a new `mobile/` directory alongside existing `app/` (web) and `pipeline/`
- Expo Router file-based routing in `mobile/app/` directory (Expo convention)

</code_context>

<specifics>
## Specific Ideas

- Trust screen mockup approved: single screen with 4 checkmark trust points, GitHub link, and "Comenzar" button
- Zone detail mockup approved: hero status block + signal breakdown with bar indicators
- Zone picker mockup approved: state-grouped list with search and colored status dots
- App should feel like a utility, not a social app — direct, fast, no frills

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 1-Foundation + Offline Core*
*Context gathered: 2026-05-25*
