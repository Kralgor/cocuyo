---
phase: quick-260610-srt
plan: 01
subsystem: web-frontend
tags: [responsive, desktop, leaflet, ssr, layout]
key-files:
  created:
    - app/lib/useMediaQuery.ts
  modified:
    - app/components/Map.tsx
    - app/styles/globals.css
    - app/components/mobile/TabBar.tsx
    - app/components/mobile/MobileShell.tsx
    - app/pages/index.tsx
decisions:
  - "isDesktop conditional render (not CSS visibility) keeps the desktop pane out of the DOM below 1024px — no Leaflet instantiation on mobile"
  - "Single Map dynamic import reused for both mobile tab and desktop pane — Leaflet loaded once"
  - "Removed inline display:flex from .app-outer so CSS grid can take over at 1024px without specificity fight"
  - "No test runner in app/ — tsc + next build used as verify gate per plan instruction (no new deps)"
metrics:
  duration: ~15min
  completed: "2026-06-10"
  tasks_completed: 3
  files_changed: 6
---

# Quick Task 260610-srt: Responsive UI Pass — Desktop Two-Pane Layout

**One-liner:** SSR-safe media-query hook + 1024px CSS grid splits web app into 430px left shell and full-height persistent Leaflet map on the right.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | SSR-safe useMediaQuery hook + Map fillHeight prop | e47ae11 | app/lib/useMediaQuery.ts, app/components/Map.tsx |
| 2 | Responsive 1024px two-pane grid + hideable map tab | 9bd2879 | app/styles/globals.css, app/components/mobile/TabBar.tsx |
| 3 | Wire persistent desktop map + isDesktop conditional rendering | 7bf08f8 | app/pages/index.tsx, app/components/mobile/MobileShell.tsx |

## What Was Built

**useMediaQuery.ts** — SSR-safe matchMedia hook. Initializes to `false` (server/first render), reads `window.matchMedia` post-mount via `useEffect`, subscribes to `change` events, cleans up on unmount. Guards `window` undefined for static-export prerender. First paint always returns the mobile branch — no hydration mismatch.

**Map.tsx** — Added `fillHeight?: boolean` prop. When `true`, MapContainer height becomes `'100%'` (fills the right pane). When `false` / absent, keeps `'440px'` — mobile map tab is byte-identical to before.

**globals.css** — Removed the old 768px (max-width:720px) and 1200px (max-width:900px) bumps that were widening the shell. Added `@media (min-width: 1024px)` block: `.app-outer` becomes a `grid` with `430px 1fr` columns; `.app-shell` gets `max-width: none; width: 430px`; `.desktop-map-pane` gets `height: 100%; border-left: 1px solid var(--line)`. Below 1024px the phone column is untouched.

**TabBar.tsx** — Added `hideTabs?: TabId[]` prop. Filters `TABS` to `visibleTabs` and uses `visibleTabs.length` for `gridTemplateColumns` so remaining tabs span full width. The `'map'` entry is excluded at desktop.

**MobileShell.tsx** — Added `hideTabs?: TabId[]` prop, forwarded to `<TabBar>`. No other changes.

**index.tsx** — Imported `useMediaQuery`; added `const isDesktop = useMediaQuery('(min-width: 1024px)')`. Guard `useEffect` resets `activeTab` from `'map'` to `'zone'` when `isDesktop` becomes true. Removed the inline `display: 'flex'` from `.app-outer` so CSS grid can take over at 1024px. Passes `hideTabs={isDesktop ? ['map'] : []}` to `MobileShell`. Renders `<div className="desktop-map-pane">` with `fillHeight` `Map` as a second child of `.app-outer` only when `isDesktop` — grid column 2. Below 1024px: pane not rendered, no Leaflet instantiation, no DOM overhead. Existing in-shell `Map` in `renderContent()` unchanged for mobile map tab.

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- `cd app && npx tsc --noEmit` — passes (all three tasks verified incrementally)
- `cd app && npx next build` — passes, static export to `app/out/`, route `/` is `○ (Static)`
- All plan must_haves met:
  - Below 1024px: byte-identical to before (430px centered column, all 5 tabs)
  - At >=1024px: two-pane grid (430px left + map right), map tab hidden, marker tap opens zone in left pane
  - First paint is mobile layout (hook returns false pre-mount)
  - Settings/RegionPicker overlays remain inside .app-shell (left pane only)
  - Single Map dynamic import — Leaflet loaded once

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, or trust-boundary changes.

## Self-Check: PASSED

- app/lib/useMediaQuery.ts — FOUND
- app/components/Map.tsx — FOUND (fillHeight added)
- app/styles/globals.css — FOUND (1024px block present, 768/1200 bumps removed)
- app/components/mobile/TabBar.tsx — FOUND (hideTabs added)
- app/components/mobile/MobileShell.tsx — FOUND (hideTabs forwarded)
- app/pages/index.tsx — FOUND (isDesktop, desktop-map-pane, hideTabs wired)
- Commits e47ae11, 9bd2879, 7bf08f8 — all present in git log
