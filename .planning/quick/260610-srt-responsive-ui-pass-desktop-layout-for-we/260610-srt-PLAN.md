---
phase: quick-260610-srt
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/lib/useMediaQuery.ts
  - app/styles/globals.css
  - app/components/mobile/TabBar.tsx
  - app/components/Map.tsx
  - app/pages/index.tsx
autonomous: true
requirements: [SRT-DESKTOP-LAYOUT]
must_haves:
  truths:
    - "Below 1024px the app looks byte-identical to today (430px centered phone column, all five tabs)"
    - "At >=1024px a two-pane layout shows: left = 430px MobileShell column with tab bar, right = persistent Leaflet map filling the rest"
    - "At >=1024px the Map tab button is hidden from the TabBar (map always visible on the right)"
    - "Tapping a marker on the persistent desktop map switches the left pane to the zone tab for that region"
    - "Settings and RegionPicker overlays cover only the left 430px pane at desktop"
    - "First server-rendered/hydrated paint is the mobile layout (no hydration mismatch)"
    - "cd app && npx tsc --noEmit && npx next build succeeds (static export)"
  artifacts:
    - path: "app/lib/useMediaQuery.ts"
      provides: "SSR-safe matchMedia hook, defaults to false on first render"
      contains: "matchMedia"
    - path: "app/styles/globals.css"
      provides: "1024px two-pane grid layout; removed 768/1200 max-width bumps"
      contains: "1024px"
    - path: "app/pages/index.tsx"
      provides: "Persistent desktop map mount + conditional tab/render wiring"
  key_links:
    - from: "app/pages/index.tsx"
      to: "app/lib/useMediaQuery.ts"
      via: "useMediaQuery('(min-width: 1024px)')"
      pattern: "useMediaQuery"
    - from: "app/pages/index.tsx"
      to: "app/components/Map.tsx"
      via: "single persistent <Map> instance in right pane at desktop"
      pattern: "onMarkerTap=\\{handleMarkerTap\\}"
---

<objective>
Add a desktop (>=1024px) two-pane layout to the web app: existing 430px MobileShell column on the left, persistent Leaflet map on the right. Below 1024px nothing changes visually. Mobile keeps the current map-tab behavior; desktop always shows the map and hides the map tab.

Purpose: The phone-column app stretches awkwardly on wide screens. A fixed left column + persistent map uses the available width without redesigning the editorial identity.
Output: SSR-safe media-query hook, responsive grid in globals.css, conditional rendering in index.tsx, an optional full-height mode on Map, and a hideable map tab.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@./CLAUDE.md
@.planning/STATE.md

<interfaces>
<!-- Contracts the executor needs. No codebase exploration required. -->

Theme tokens (app/lib/theme.ts): t.line is a CSS-var-equivalent color string;
CSS var --line is set on mount by applyTheme. Use `1px solid var(--line)` for
the pane divider (LD-5), `0.5px solid ${t.line}` elsewhere matching existing code.

TabBar (app/components/mobile/TabBar.tsx) current signature:
  export type TabId = 'zone' | 'map' | 'forecast' | 'bajones' | 'history';
  interface Props { theme: Theme; lang: Lang; activeTab: TabId; onTabChange: (tab: TabId) => void; }
  TABS array drives rendering; 'map' is the second entry.

Map (app/components/Map.tsx) current signature:
  interface MapProps { regions?: Record<string, RegionEntry>; theme: Theme; onMarkerTap?: (regionKey: string) => void; }
  MapContainer style is hardcoded: { height: '440px', width: '100%', background: t.bg }.

index.tsx current behavior:
  - const Map = dynamic(() => import('../components/Map'), { ssr: false, loading: ... });
  - Map is rendered ONLY inside renderContent() when activeTab === 'map'.
  - handleMarkerTap(key) sets tempRegionKey + activeTab='zone'.
  - mounted gate: returns a placeholder shell until useEffect sets mounted=true.
  - Outer structure: <div className="app-outer" ...><div className="app-shell" ...>{MobileShell + overlays}</div></div>
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: SSR-safe useMediaQuery hook + adjustable Map height</name>
  <files>app/lib/useMediaQuery.ts, app/components/Map.tsx, app/components/Map.test.tsx (only if a test runner already exists in app/)</files>
  <behavior>
    - useMediaQuery(query): returns false on the first (server/initial) render regardless of viewport — prevents hydration mismatch with the static export.
    - After mount (useEffect), it reflects window.matchMedia(query).matches and updates on the matchMedia 'change' event; listener removed on cleanup.
    - Map gains an optional `fillHeight?: boolean` prop. When true the MapContainer style uses height '100%' (so it fills the desktop right pane). When false/absent it keeps the current '440px' — mobile map tab is byte-identical.
  </behavior>
  <action>
    Create app/lib/useMediaQuery.ts (camelCase util per naming rules) exporting a default or named `useMediaQuery(query: string): boolean` hook. Implementation: useState initialized to false; useEffect that reads window.matchMedia(query), sets state to .matches, subscribes to its 'change' event, and cleans up the listener. Guard against window being undefined for static-export prerender. Do NOT read matchMedia during render — only inside useEffect — so the first paint is always the mobile (false) branch (LD-3 SSR safety).

    In app/components/Map.tsx, add `fillHeight?: boolean` to MapProps and apply it: when fillHeight is true, set MapContainer style height to '100%'; otherwise keep '440px'. Change nothing else in Map — markers, tooltips, tile updater, onMarkerTap all stay identical. Keep width '100%' and background t.bg in both cases.

    Only add Map.test.tsx if app/ already has a configured test runner (check app/package.json scripts). If none exists, set verify to the build gate and note MISSING in done — do NOT add a test toolchain (no new dependencies, LD-7).
  </action>
  <verify>
    <automated>cd app && npx tsc --noEmit</automated>
  </verify>
  <done>useMediaQuery.ts exists and returns false at first render; Map accepts fillHeight and renders height '100%' when true, '440px' otherwise; tsc passes.</done>
</task>

<task type="auto">
  <name>Task 2: Responsive grid CSS + hideable map tab</name>
  <files>app/styles/globals.css, app/components/mobile/TabBar.tsx</files>
  <action>
    globals.css (LD-1, LD-2, LD-5): In the "Responsive shell" block, DELETE both existing bumps — the `@media (min-width: 768px)` (max-width: 720px) and `@media (min-width: 1200px)` (max-width: 900px) rules. Keep `.app-shell { max-width: 430px; height: 100% }` as the below-1024px behavior (centered 430px column — zero visual change below 1024).

    Add a new `@media (min-width: 1024px)` block that turns `.app-outer` into the two-pane container: set `.app-outer` to `display: grid; grid-template-columns: 430px 1fr;` and remove the centering (justify-content has no effect on grid, fine to leave). Override `.app-shell` inside this breakpoint so it is no longer max-width-capped to the centered column: `max-width: none; width: 430px; height: 100%;`. Add a `.desktop-map-pane` class (used in Task 3) styled `height: 100%; border-left: 1px solid var(--line);` and ensure the Leaflet container inside fills it (the pane itself is the grid's second column; height 100% resolves against the grid row which is height:100dvh via .app-outer). Reference: existing .app-outer sets height:100vh/100dvh — keep that.

    TabBar.tsx (LD-2): Add an optional prop `hideTabs?: TabId[]` to Props. When rendering, filter TABS to exclude any id in hideTabs (default empty array). Update the gridTemplateColumns repeat count to use the filtered length, not TABS.length, so the remaining tabs still span full width. Change nothing else (icons, labels, active styling identical).
  </action>
  <verify>
    <automated>cd app && grep -q "min-width: 1024px" styles/globals.css && grep -vq "max-width: 720px" styles/globals.css && grep -vq "max-width: 900px" styles/globals.css && grep -q "hideTabs" components/mobile/TabBar.tsx && npx tsc --noEmit</automated>
  </verify>
  <done>768/1200 bumps removed; 1024px grid block present with 430px 1fr columns and .desktop-map-pane with 1px var(--line) left border; TabBar accepts hideTabs and filters TABS + column count; tsc passes.</done>
</task>

<task type="auto">
  <name>Task 3: Wire persistent desktop map + conditional rendering in index.tsx</name>
  <files>app/pages/index.tsx, app/components/mobile/MobileShell.tsx</files>
  <action>
    index.tsx (LD-2, LD-3, LD-6, and constraints):

    1. Import the hook: `import { useMediaQuery } from '../lib/useMediaQuery';` (match the export style chosen in Task 1). Inside Home, add `const isDesktop = useMediaQuery('(min-width: 1024px)');`. Because the hook returns false until mount, this composes with the existing `mounted` gate — the first paint is the mobile layout (no hydration mismatch).

    2. Reuse the SAME existing `Map` dynamic component (do not create a second dynamic import — that would double-load Leaflet). Mount exactly ONE persistent instance in the desktop right pane. Keep the existing in-shell Map render for mobile's map tab. Critically, the desktop map must NOT remount on tab change: render it as a sibling of `.app-shell` inside `.app-outer`, not inside renderContent(). Pass `fillHeight` and the same `onMarkerTap={handleMarkerTap}` and `regions={status?.regions}` and `theme={t}` props so desktop marker taps drive the left pane zone tab exactly like the mobile map tab does today.

    3. Layout wiring: the outer `<div className="app-outer">` already exists. At desktop the CSS grid (Task 2) places `.app-shell` (left) and a new `<div className="desktop-map-pane">` (right). Render the right pane only when `isDesktop` is true: `{isDesktop && (<div className="desktop-map-pane"><Map regions={status?.regions} theme={t} onMarkerTap={handleMarkerTap} fillHeight /></div>)}`. Place it as a direct child of `.app-outer`, after the `.app-shell` div, so it lands in grid column 2. Below 1024px the grid rules don't apply and the pane isn't rendered — phone column unchanged.

    4. Hide the map tab at desktop: pass the hide list down. MobileShell forwards to TabBar — add a `hideTabs?: TabId[]` prop to MobileShell Props and pass it through to `<TabBar ... hideTabs={hideTabs} />`. In index.tsx pass `hideTabs={isDesktop ? ['map'] : []}` to MobileShell.

    5. Guard against the user being stuck on the now-hidden map tab: in handleTabChange and/or a small useEffect, if isDesktop becomes true while activeTab === 'map', reset activeTab to 'zone'. Keep mobile behavior (map tab works) untouched.

    6. Do NOT touch RegionPicker/Settings placement — they already render inside `.app-shell` (the left pane). Verify they remain children of `.app-shell` so at desktop they overlay only the left pane (LD-6). Make no change if already correct.

    MobileShell.tsx: add `hideTabs?: TabId[]` to Props (import TabId is already imported) and forward it to the existing `<TabBar ... />` call. No other changes.

    Do NOT change the `!mounted` placeholder branch except: it already renders the mobile placeholder — leave it as the mobile-first paint.
  </action>
  <verify>
    <automated>cd app && grep -q "useMediaQuery" pages/index.tsx && grep -q "desktop-map-pane" pages/index.tsx && grep -q "fillHeight" pages/index.tsx && grep -q "hideTabs" components/mobile/MobileShell.tsx && npx tsc --noEmit && npx next build</automated>
  </verify>
  <done>index.tsx mounts one persistent fillHeight Map in .desktop-map-pane only at desktop, reusing the existing dynamic import; map tab hidden at desktop via hideTabs and activeTab guarded off 'map'; overlays remain in .app-shell; tsc + next build (static export) both pass.</done>
</task>

</tasks>

<verification>
- Build gate: `cd app && npx tsc --noEmit && npx next build` exits 0 with static export to app/out/.
- Below 1024px: app-shell is 430px centered, all 5 tabs visible, map appears only on map tab (unchanged).
- At >=1024px: two panes (430px left + map right), map tab hidden, marker tap on right pane opens that region's zone in left pane, map does not flicker/remount when switching left-pane tabs.
- Hydration: first paint is mobile layout (hook returns false pre-mount); no console hydration warning.
- Overlays (Settings, RegionPicker) cover only the left 430px pane at desktop.
</verification>

<success_criteria>
- No new dependencies added (package.json unchanged).
- Only existing theme tokens / fonts / hairline borders used; no new colors or fonts.
- Single persistent Map instance at desktop (Leaflet loaded once).
- tsc strict + next build static export pass.
</success_criteria>

<output>
Create `.planning/quick/260610-srt-responsive-ui-pass-desktop-layout-for-we/260610-srt-SUMMARY.md` when done.
</output>
