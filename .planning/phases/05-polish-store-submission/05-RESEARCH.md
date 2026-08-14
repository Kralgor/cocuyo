# Phase 5: Polish + Store Submission — Research

**Researched:** 2026-06-23
**Domain:** React Native / Expo SDK 56 — history view port, EAS Build production, EAS Submit
**Confidence:** HIGH (data availability), HIGH (store submission flow), HIGH (SVG port)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STAT-04 | User can view outage history for their zone and see estimated return time based on past patterns | PARTIALLY BUILDABLE from existing data — see Data Availability section |
| PLAT-04 | App published on Google Play Store | Human-gated prerequisites documented below; code portion (eas.json submit profile) is buildable |
| PLAT-05 | App published on Apple App Store | Human-gated prerequisites documented below; code portion is buildable |

</phase_requirements>

---

## Summary

Phase 5 has two distinct work streams that require completely different execution strategies.

**Stream A: STAT-04 — History + Return Time.** The history data and per-region JSON files are fully built and deployed by the existing `retrain` pipeline job (weekly Sunday midnight UTC). The web app already consumes them at `https://cocuyo.kralgor.com/history/{region}.json`. The mobile app has a placeholder screen (`history.tsx` returns `<PlaceholderTab />`). The entire web implementation — `RegionHistory` type, `fetchRegionHistory()` hook, `HistoryStrip` SVG chart, `ForecastCurve` SVG chart, `ScreenHistory`, `ScreenForecast` — is directly portable to React Native with one library addition (`react-native-svg` for SVG rendering). The estimated return time already flows through `status.json` via the `outage.estimated_remaining` and `outage.estimated_restoration` fields — these are typed in the mobile `api.ts` but only emitted by the pipeline at Phase 3+ (lifecycle). Critically, the per-region history JSON at `https://cocuyo.kralgor.com/history/{region}.json` provides `stats_30d`, `stats_90d`, `forecast_48h`, and `pattern` fields that cover the full STAT-04 requirement including "estimated return time based on past patterns."

**Stream B: PLAT-04/PLAT-05 — Store Submission.** This splits cleanly between code work (EAS Build production profile, `eas.json` submit section, app metadata polish) and human-gated work that no agent can perform (Google Play Developer account, Apple Developer Program, store listing assets, first-upload to Play Console). The code portion is small. The human gate is the real schedule risk.

**Primary recommendation:** Build the history tab first (STAT-04), then prepare the EAS submit config and store listing checklist (PLAT-04/05). Ship to Google Play first (no annual fee, Android APK already building); Apple follows once the $99/yr program is active.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Outage history display | Mobile app (RN) | CDN (data source) | App fetches per-region JSON; no pipeline change needed |
| Return time estimate (live outage) | status.json CDN field | Mobile app renders | `outage.estimated_remaining` already in status.json type contract |
| Return time estimate (historical pattern) | history JSON CDN | Mobile app renders | `pattern.typical_duration_h` + `forecast_48h` in per-region history JSON |
| History JSON generation | Pipeline retrain job | Cloudflare R2 | `backfill_history.py` runs weekly, uploads to `cocuyo/history/` on R2 |
| Production build (AAB/IPA) | EAS Build (cloud) | — | Managed credentials, no local Xcode/Android Studio needed |
| Store submission | EAS Submit CLI | Human (first upload) | Automated after first manual upload to Play Console |
| Store listing content | Human | — | Screenshots, description, privacy policy cannot be automated |

---

## DATA AVAILABILITY FINDING (Q1 — Critical Blocker Investigation)

**Result: STAT-04 is BUILDABLE from existing data with no pipeline changes required.**

### What exists in status.json today

The pipeline (`pipeline/main.py`) outputs a `regions` dict per region. At Phase 2+ (current deployed phase), this does NOT include an `outage` object. [VERIFIED: codebase grep, `pipeline/main.py` line 246 — `score_region()` return dict has no `outage` key].

However, `outage.estimated_remaining` and `outage.estimated_restoration` ARE typed in both `app/lib/api.ts` and `mobile/lib/api.ts` as optional fields on `RegionEntry`. These fields are emitted by the pipeline only when Phase 3 lifecycle is active and an active outage exists. At the time of Phase 5 execution, Phase 3 push notifications are code-complete (deployed phase TBD) — the `outage` field availability in production depends on which phase `COCUYO_PHASE` env var is set to.

**For STAT-04's "estimated return time based on past patterns":** This does NOT require the live `outage` field. It is served by the per-region history JSON.

### What exists in per-region history JSON

The `retrain` job (weekly Sunday UTC) runs `pipeline/backfill_history.py --days 365` and uploads output to `cocuyo/history/{region}.json` on Cloudflare R2. [VERIFIED: `.github/workflows/collect.yml` lines 104–122]

The `RegionHistory` type (from `app/lib/history.ts`) contains: [VERIFIED: codebase read]

```typescript
interface RegionHistory {
  region: string;
  display_name: string;
  generated_at: string;
  days_included: number;
  days: HistoryDay[];           // per-day outage blocks for 30d strip chart
  stats_30d: HistoryStats;      // total_hours, count, avg_duration_h, longest_h
  stats_90d: HistoryStats;
  pattern: DetectedPattern;     // detected, description, typical_start_hour, typical_duration_h, confidence
  forecast_48h: ForecastPoint[]; // half_hour, hour, risk — drives ForecastCurve
  // enrichment (optional): guri_m, guri_trend, supply_risk, avg_temp_c, cf_confirmed_pct
}
```

This is sufficient to fully implement STAT-04: users can see outage history (`stats_30d`, `days`) and estimated return time (`pattern.typical_duration_h`, `forecast_48h` risk curve).

### CDN URL for history

- Web app: `https://cocuyo.kralgor.com/history/{region}.json` [VERIFIED: `app/lib/history.ts` line 68]
- Mobile app: No `historyCdnUrl` in `app.json extra` yet — must be added [VERIFIED: `mobile/app.json` extra object has `statusCdnUrl` but not `historyCdnUrl`]

### What STAT-04 does NOT need

- Pipeline changes
- New backend endpoints
- New Supabase tables
- Changes to status.json structure

### What STAT-04 needs (code only)

1. `mobile/lib/history.ts` — port of `app/lib/history.ts` with `fetch()` instead of React's `useState` (mobile uses React Query for caching)
2. `mobile/components/HistoryStrip.tsx` — SVG port using `react-native-svg`
3. `mobile/components/ForecastCurve.tsx` — SVG port using `react-native-svg`
4. `mobile/app/(tabs)/history.tsx` — replace `PlaceholderTab` with real screen
5. `app.json extra.historyCdnUrl` — add to config so URL is injected at build time
6. `react-native-svg` — new dependency (required; web uses browser SVG, RN needs this library)

---

## Standard Stack

### Core (no new dependencies for history port)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-native-svg | 15.15.5 | SVG rendering in React Native | Official Expo SDK library; web's ForecastCurve/HistoryStrip use SVG path/rect/line/text elements |
| expo-updates | ~56.0.16 | OTA update delivery | Already installed; drives PLAT-03 |
| eas-cli | 20.3.0 | EAS Build + EAS Submit commands | Official Expo CLI for cloud builds and store submission |

### Already-Installed Libraries Used by Phase 5

| Library | Already In | Usage in Phase 5 |
|---------|-----------|------------------|
| @tanstack/react-query | mobile/package.json | Cache history JSON via useQuery (same pattern as useStatus) |
| react-native-mmkv | mobile/package.json | Cache history JSON to MMKV for offline access |
| expo-constants | mobile/package.json | Read `historyCdnUrl` from app.json extra |

### Package Legitimacy Audit

Phase 5 adds ONE new npm package to the mobile app: `react-native-svg`.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| react-native-svg | npm | ~10 yrs (created 2015-04-29) | High (official Expo SDK) | github.com/software-mansion/react-native-svg | N/A (slopcheck checks PyPI — wrong registry for npm packages; verified via npm view) | Approved |

**Note:** slopcheck reported `[SLOP]` because it checked PyPI (the package doesn't exist on PyPI — it's an npm package). This is the known cross-ecosystem confusion vector. The npm registry check via `npm view react-native-svg` confirms: version 15.15.5, MIT license, official repository at `github.com/software-mansion/react-native-svg`, created 2015. Package is endorsed by Expo official docs at `https://docs.expo.dev/versions/v56.0.0/sdk/svg/`. [VERIFIED: npm registry + Expo v56 official docs]

No postinstall script risk: `npm view react-native-svg scripts.postinstall` returned no output.

**Packages removed due to slopcheck [SLOP] verdict:** none (false positive from PyPI check)
**Packages flagged as suspicious [SUS]:** none

**Install command:**
```bash
npx expo install react-native-svg
```

**Version verification:**
```bash
npm view react-native-svg version   # 15.15.5 confirmed 2026-06-23
```

---

## Architecture Patterns

### System Architecture Diagram

```
CDN (kralgor.com)
  ├── /status.json          ← useStatus (existing, React Query, MMKV-cached)
  └── /history/{region}.json ← useHistory (new, React Query, MMKV-cached)
         │
         ▼
  mobile/lib/history.ts     ← fetchRegionHistory() + useHistory() hook
         │
         ├── HistoryStrip (react-native-svg)    ← 30-day outage strip
         ├── ForecastCurve (react-native-svg)   ← 48h risk curve
         └── HistoryScreen (history.tsx tab)    ← replaces PlaceholderTab
```

### Recommended Project Structure (additions for Phase 5)

```
mobile/
├── lib/
│   └── history.ts              # NEW — fetchRegionHistory, useHistory hook
├── components/
│   ├── HistoryStrip.tsx        # NEW — SVG bar chart (port from app/)
│   └── ForecastCurve.tsx       # NEW — SVG curve chart (port from app/)
└── app/
    └── (tabs)/
        └── history.tsx         # REPLACE placeholder with real screen
```

### Pattern 1: React Query for History Fetch

Use the same `useQuery` pattern as `useStatus` in `hooks/useStatus.ts`. History is per-region, so the query key includes the region key.

```typescript
// Source: app/lib/history.ts + mobile/lib/query.ts pattern
import { useQuery } from '@tanstack/react-query';
import { queryClient } from '@/lib/query';

const HISTORY_CDN_BASE =
  (Constants.expoConfig?.extra?.historyCdnUrl as string | undefined) ??
  'https://cocuyo.kralgor.com/history';

export async function fetchRegionHistory(regionKey: string): Promise<RegionHistory | null> {
  const url = `${HISTORY_CDN_BASE}/${regionKey}.json`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json() as Promise<RegionHistory>;
}

export function useHistory(regionKey: string | null) {
  return useQuery({
    queryKey: ['history', regionKey],
    queryFn: () => regionKey ? fetchRegionHistory(regionKey) : null,
    enabled: !!regionKey,
    staleTime: 1000 * 60 * 60 * 6,  // 6h — history updates weekly, aggressive caching ok
    gcTime:    1000 * 60 * 60 * 24, // 24h — persist across sessions
  });
}
```

### Pattern 2: react-native-svg for Chart Primitives

The web components use browser SVG (`<svg>`, `<path>`, `<rect>`, `<line>`, `<text>`). React Native requires `react-native-svg` wrappers. Import mapping:

```typescript
// Source: docs.expo.dev/versions/v56.0.0/sdk/svg/
// Web:    import React from 'react'  (uses <svg>, <path>, <line>, <rect>, <text>)
// RN:     import Svg, { Path, Line, Rect, Text as SvgText } from 'react-native-svg';

// Key difference: RN svg requires numeric x/y/width/height (not string "100%")
// Use Dimensions.get('window').width for responsive sizing.
// Avoid preserveAspectRatio="none" — use fixed pixel sizes derived from window width.
```

The web `HistoryStrip` and `ForecastCurve` components calculate SVG coordinates from a `width` prop (default 320). In React Native, pass `width = Math.floor(Dimensions.get('window').width - 32)` (16px padding each side).

### Pattern 3: Store Submission eas.json

Add a `submit` section to `eas.json`:

```json
// Source: docs.expo.dev/submit/eas-json/
{
  "submit": {
    "production": {
      "android": {
        "serviceAccountKeyPath": "./credentials/google-service-account.json",
        "track": "internal"
      },
      "ios": {
        "appleId": "leonardoduam@gmail.com",
        "ascAppId": "<APP_STORE_CONNECT_APP_ID>",
        "appleTeamId": "<TEAM_ID>"
      }
    }
  }
}
```

Note: `track: "internal"` for first production submit — graduate to `production` track manually in Play Console after testing. [VERIFIED: docs.expo.dev/submit/android/]

### Anti-Patterns to Avoid

- **Inline SVG percentages in react-native-svg:** `width="100%"` is not supported — pass pixel values.
- **Committing Google Service Account JSON:** Store in EAS secrets or credentials directory (already gitignored via `mobile/credentials/`). Never hardcode the JSON content.
- **Submitting to `production` track first time in Play Console:** Google requires the app to pass through `internal` → `alpha/beta` → `production` track review. Going straight to production fails.
- **SVG `<Text>` name collision:** `react-native-svg` exports `Text` — alias it as `SvgText` to avoid collision with React Native's `Text`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SVG chart rendering in RN | Custom canvas/View math | `react-native-svg` | Path/Rect/Line/Text elements match web SVG exactly; port is ~95% mechanical |
| History JSON fetching + caching | Custom fetch + AsyncStorage | React Query + MMKV (already installed) | Same pattern as useStatus; MMKV persists across cold launches automatically |
| EAS cloud builds | Local Xcode/Gradle | EAS Build | No macOS required; managed credentials; same AAB/IPA produced |
| iOS store upload | Transporter.app (macOS only) | EAS Submit | Works on Windows/Linux; no Transporter required |

---

## STORE SUBMISSION: Code vs Human Separation (PLAT-04/05)

### Code-Buildable Work

These tasks can be executed by an agent:

1. **eas.json submit profile** — add `"submit": { "production": { "android": {...}, "ios": {...} } }`
2. **app.json metadata** — verify `version`, `android.versionCode`, `ios.buildNumber`, `ios.bundleIdentifier`, privacy description strings
3. **EAS production build** — `eas build --platform android --profile production` and `eas build --platform ios --profile production` (runs in EAS cloud)
4. **Android store listing copy** — can draft in code (short description 80 chars, full description 4000 chars in Spanish/English)
5. **Privacy policy document** — required; must exist at a public URL before App Store submission
6. **`ITSAppUsesNonExemptEncryption: false`** — already set in `app.json` `ios.infoPlist`

### Human-Gated Work (No Agent Can Do These)

These block store submission and cannot be automated:

#### Google Play (PLAT-04)

| Gate | Action Required | Cost | Notes |
|------|----------------|------|-------|
| G-P1 | Create Google Play Developer account | $25 one-time | play.google.com/apps/publish |
| G-P2 | Create app in Play Console ("Create app") | — | Sets package name `app.cocuyo.mobile` |
| G-P3 | Generate Google Service Account Key | — | Required for EAS Submit API access [VERIFIED: docs.expo.dev/submit/android/] |
| G-P4 | First manual upload of AAB to Play Console | — | **Hard requirement**: Google Play API does not allow API upload before one manual upload [VERIFIED: docs.expo.dev/submit/android/] |
| G-P5 | Complete store listing: screenshots (min 2, up to 8), feature graphic (1024×500), short/full description | — | Cannot be automated |
| G-P6 | Content rating questionnaire | — | App Store Rating system |
| G-P7 | Data safety form | — | Declare: no user data collected, no location stored, anonymous reports only |
| G-P8 | Privacy policy URL | — | Required field; must be a live public URL |
| G-P9 | Move from internal → production track when ready | — | Manual step in Play Console |

#### Apple App Store (PLAT-05)

| Gate | Action Required | Cost | Notes |
|------|----------------|------|-------|
| A-P1 | Apple Developer Program enrollment | $99/yr | developer.apple.com/programs — **active blocker from STATE.md** |
| A-P2 | Create App ID in App Store Connect | — | Bundle ID: `app.cocuyo.mobile` |
| A-P3 | Create app record in App Store Connect | — | Gets `ascAppId` needed in eas.json |
| A-P4 | App Store listing: screenshots (6.7", 6.1", iPad if universal), description, keywords, subtitle | — | Cannot be automated |
| A-P5 | Privacy policy URL | — | Required; iOS asks "Does this app collect data?" — answer must be No |
| A-P6 | App Review submission + wait (1-3 days typical) | — | Cannot be automated |
| A-P7 | App privacy questionnaire in App Store Connect | — | Declare: no tracking, anonymous reports only |

**Note from STATE.md:** Apple Developer Program is listed as an outstanding human-gated item from Phase 1. iOS EAS builds may be deferred until this is active. Android store submission can proceed independently. [CITED: .planning/STATE.md]

---

## Common Pitfalls

### Pitfall 1: react-native-svg Text element name collision

**What goes wrong:** `import { Text } from 'react-native-svg'` shadows React Native's `Text` component — TypeScript errors or runtime crashes in files that use both.
**Why it happens:** Both exports are named `Text`.
**How to avoid:** `import Svg, { Path, Rect, Line, Text as SvgText } from 'react-native-svg'`
**Warning signs:** TypeScript error "Type 'string' is not assignable to type never" on `style` prop.

### Pitfall 2: History JSON not yet populated (first retrain hasn't run)

**What goes wrong:** `fetchRegionHistory()` returns null for all regions until the first weekly `retrain` job runs and uploads `history/` files to R2.
**Why it happens:** `backfill_history.py` only runs in the weekly `retrain` GitHub Actions job (Sunday midnight UTC). If the job has never run successfully, the bucket has no `history/*.json` files.
**How to avoid:** Dispatch `workflow_dispatch` with `job: retrain` to manually trigger before testing the history screen. Add graceful null-state UI ("Historia disponible próximamente").
**Warning signs:** `fetchRegionHistory()` returns null for all 17 regions.

### Pitfall 3: SVG width as percentage vs pixel

**What goes wrong:** `<Svg width="100%">` in `react-native-svg` may not behave identically to browser SVG — can result in zero-width rendering on some Android versions.
**Why it happens:** The web components use `width="100%"` with `viewBox` + `preserveAspectRatio="none"`. React Native's SVG rendering engine differs from browser.
**How to avoid:** Use `Dimensions.get('window').width - 32` for chart width. Pass as a number prop. The web components accept a `width` prop (default 320) — just compute the actual pixel width in the screen component.

### Pitfall 4: First Play Console upload must be manual

**What goes wrong:** EAS Submit fails with "App not found" or "No app with package name" on the very first submission.
**Why it happens:** Google Play API requires an app to exist in Play Console before API can upload to it. The API cannot create a new app listing. [VERIFIED: docs.expo.dev/submit/android/]
**How to avoid:** Download the `.aab` from EAS dashboard, upload it manually in Play Console under "Internal testing", then EAS Submit can take over.

### Pitfall 5: Apple Developer Program not enrolled

**What goes wrong:** `eas build --platform ios --profile production` fails at signing or `eas submit --platform ios` fails at upload.
**Why it happens:** EAS managed credentials for iOS require Apple Developer Program membership. This is an active blocker from Phase 1 (STATE.md). [CITED: .planning/STATE.md]
**How to avoid:** Plan Android first. iOS store submission is blocked until Apple Developer Program is enrolled ($99/yr). EAS CLI produces clear error messages for this.

### Pitfall 6: history.ts stale time too short

**What goes wrong:** History JSON is refetched every 9 minutes (matching the status polling stale time) — wastes bandwidth and burns through free CDN transfer for data that updates weekly.
**Why it happens:** Copying `staleTime: 9min` from `useStatus` without adjusting for history's update cadence.
**How to avoid:** Set `staleTime: 6h` for history queries. The data updates weekly; a 6h stale window is well within the safe margin.

---

## Code Examples

### HistoryStrip port to react-native-svg

```typescript
// Source: app/components/primitives/HistoryStrip.tsx (web original)
// Port: replace <svg>/<rect>/<line>/<text> with react-native-svg equivalents
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg';
import { Dimensions } from 'react-native';

const CHART_W = Math.floor(Dimensions.get('window').width - 32);
const CHART_H = 96;

// All coordinate calculations are identical to the web version.
// Only change: use Svg wrapper, import primitives from react-native-svg,
// and pass numeric width/height (not "100%").
```

### fetchRegionHistory with React Query caching

```typescript
// Source: pattern from mobile/lib/query.ts + app/lib/history.ts
import Constants from 'expo-constants';
import { useQuery } from '@tanstack/react-query';

const HISTORY_BASE: string =
  (Constants.expoConfig?.extra?.historyCdnUrl as string | undefined) ??
  'https://cocuyo.kralgor.com/history';

export function useHistory(regionKey: string | null) {
  return useQuery({
    queryKey: ['history', regionKey],
    queryFn: async () => {
      if (!regionKey) return null;
      const res = await fetch(`${HISTORY_BASE}/${regionKey}.json`);
      if (!res.ok) return null;
      return res.json() as Promise<RegionHistory>;
    },
    enabled: !!regionKey,
    staleTime: 1000 * 60 * 60 * 6,  // 6h — weekly update cadence
    gcTime:    1000 * 60 * 60 * 24, // 24h — persist offline
    networkMode: 'offlineFirst',
  });
}
```

### EAS production build command

```bash
# Source: docs.expo.dev/build/introduction/ + eas.json current config
cd mobile
eas build --platform android --profile production
eas build --platform ios --profile production  # requires Apple Dev Program

# Submit after first manual Play Console upload:
eas submit --platform android --profile production --latest
eas submit --platform ios --profile production --latest
```

### app.json extra: add historyCdnUrl

```json
// mobile/app.json — add to "extra" object
{
  "expo": {
    "extra": {
      "statusCdnUrl": "https://cocuyo.kralgor.com/status.json",
      "historyCdnUrl": "https://cocuyo.kralgor.com/history",
      "supabaseUrl": "...",
      "supabaseAnonKey": "..."
    }
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Animated charts (Victory Native, etc.) | SVG primitives via react-native-svg | Stable | For simple line/bar charts, SVG is lighter than chart libraries; web components port cleanly |
| eas submit with --latest | `eas build --auto-submit` | Current | Can chain build + submit in one command; not required but convenient for CI |
| Manual keystore management | EAS Managed Credentials (already active in this project) | SDK 44+ | Already in use; no change needed |

**Deprecated/outdated:**
- `expo publish` (Expo Classic Updates): replaced by `eas update`. Project already uses `expo-updates` ~56.0.16 + EAS Update URL in `app.json`. [ASSUMED]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `retrain` job has successfully run at least once and history JSON files exist at `cocuyo.kralgor.com/history/*.json` | Data Availability | History screen shows null state for all regions; need to dispatch retrain manually |
| A2 | `COCUYO_PHASE >= 3` is set in production, making the `outage.estimated_remaining` field present in status.json for active outages | Data Availability | Live-outage return time display won't have data; historical pattern data from history JSON still works |
| A3 | Apple Developer Program ($99/yr) is not yet enrolled | Store Submission | iOS submission proceeds immediately instead of being blocked |

---

## Open Questions

1. **Is the retrain job running successfully in CI?**
   - What we know: The workflow exists and is defined; it runs weekly Sunday midnight UTC
   - What's unclear: Whether it has run successfully since the R2 bucket was configured
   - Recommendation: Dispatch `retrain` workflow manually before planning history tab tests; add graceful null-state to history screen

2. **Which COCUYO_PHASE is set in production?**
   - What we know: Phase 3 push notification code is code-complete; deployment status unclear
   - What's unclear: Whether `outage.estimated_remaining` is emitted in live status.json
   - Recommendation: History pattern data (from per-region JSON) works regardless; the live estimated_restoration from status.json is bonus if Phase 3 is deployed

3. **Apple Developer Program enrollment status**
   - What we know: STATE.md lists this as an outstanding gate from Phase 1
   - What's unclear: Whether Leo has enrolled since the last session
   - Recommendation: Plan Android Play submission as independent track; iOS submission is a separate gated task

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| eas-cli | EAS Build + Submit | Check with `eas --version` | 20.3.0 (latest on npm) | `npm install -g eas-cli@latest` |
| Google Play Developer account | PLAT-04 | Unknown (human-gated) | — | Cannot automate; must be created by Leo |
| Apple Developer Program | PLAT-05 | Unknown (gate from Phase 1) | — | Cannot automate; $99/yr enrollment required |
| App Store Connect app record | PLAT-05 | Requires Apple Dev Program | — | No fallback; blocks iOS submission |
| react-native-svg | STAT-04 history charts | Not yet in mobile/package.json | 15.15.5 | None needed; install via `npx expo install react-native-svg` |

**Missing dependencies with no fallback:**
- Google Play Developer account (human must create; $25 one-time)
- Apple Developer Program enrollment (human must enroll; $99/yr)

**Missing dependencies with fallback:**
- react-native-svg: trivially installable

---

## Validation Architecture

nyquist_validation is enabled (not explicitly false in config.json).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | jest-expo ~56.0.4 |
| Config file | `mobile/jest.config.js` |
| Quick run command | `npm test --prefix mobile -- --passWithNoTests` |
| Full suite command | `npm test --prefix mobile` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STAT-04 | `fetchRegionHistory()` returns null on non-OK response | unit | `npm test --prefix mobile -- --testPathPattern=history` | ❌ Wave 0 |
| STAT-04 | `fetchRegionHistory()` parses RegionHistory shape correctly | unit | same | ❌ Wave 0 |
| STAT-04 | `useHistory()` returns `{ data: null }` for null regionKey | unit | same | ❌ Wave 0 |
| STAT-04 | HistoryStrip renders without crashing with empty `days` | unit | same | ❌ Wave 0 |
| STAT-04 | ForecastCurve renders without crashing with empty `forecast_48h` | unit | same | ❌ Wave 0 |
| PLAT-04 | eas.json has `submit.production.android` with required fields | config-check | `node -e "require('./eas.json').submit.production.android"` | ❌ Wave 0 |
| PLAT-05 | eas.json has `submit.production.ios` with required fields | config-check | same | ❌ Wave 0 |

### Sampling Rate

- Per task commit: `npm test --prefix mobile -- --passWithNoTests`
- Per wave merge: `npm test --prefix mobile`
- Phase gate: Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `mobile/__tests__/lib/history.test.ts` — covers STAT-04 fetch/parse/null cases
- [ ] `mobile/__tests__/components/HistoryStrip.test.tsx` — covers STAT-04 render
- [ ] `mobile/__tests__/components/ForecastCurve.test.tsx` — covers STAT-04 render
- [ ] `react-native-svg` mock in `jest.setup.js` — SVG primitives are native modules, need mock

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | History JSON is parsed but not user-controlled; type assertion is sufficient |
| V6 Cryptography | no | — |

### Known Threat Patterns for Phase 5

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed history JSON from CDN | Tampering | TypeScript type assertion; null-check before render; graceful empty-state |
| Service Account Key in git | Information Disclosure | Store in `credentials/` (already gitignored); never commit JSON content |
| SUPABASE_SERVICE_ROLE_KEY in mobile | Information Disclosure | ADR-007: never; only ANON_KEY in app.json extra |

No new security surface is introduced by Phase 5. The history endpoint is read-only from the same CDN as status.json, accessed only with the anon key (no key at all — it's a public JSON endpoint).

---

## Sources

### Primary (HIGH confidence)
- `app/lib/history.ts` — RegionHistory type, CDN URL, fetch pattern [VERIFIED: codebase read]
- `app/components/primitives/HistoryStrip.tsx` — SVG chart pattern [VERIFIED: codebase read]
- `app/components/primitives/ForecastCurve.tsx` — SVG chart pattern [VERIFIED: codebase read]
- `app/components/mobile/ScreenHistory.tsx` — screen layout pattern [VERIFIED: codebase read]
- `app/components/mobile/ScreenForecast.tsx` — screen layout pattern [VERIFIED: codebase read]
- `pipeline/main.py` — confirmed no `outage` field at Phase 1/2 [VERIFIED: codebase read]
- `.github/workflows/collect.yml` lines 104–122 — history JSON generated weekly [VERIFIED: codebase read]
- `mobile/app/(tabs)/history.tsx` — confirmed PlaceholderTab (not implemented) [VERIFIED: codebase read]
- `mobile/lib/api.ts` — OutageInfo type with estimated_remaining already typed [VERIFIED: codebase read]
- `mobile/app.json` extra — historyCdnUrl not yet present [VERIFIED: codebase read]
- https://docs.expo.dev/versions/v56.0.0/sdk/svg/ — react-native-svg in Expo SDK 56 [CITED]
- https://docs.expo.dev/submit/introduction/ — EAS Submit overview [CITED]
- https://docs.expo.dev/submit/android/ — Android submission prerequisites [CITED]
- https://docs.expo.dev/submit/ios/ — iOS submission prerequisites [CITED]
- https://docs.expo.dev/app-signing/managed-credentials/ — Managed Credentials behavior [CITED]
- npm registry: `react-native-svg` v15.15.5, MIT, software-mansion/react-native-svg [VERIFIED: npm registry]
- npm registry: `eas-cli` v20.3.0 [VERIFIED: npm registry]

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` — Apple Developer Program is a known outstanding gate [CITED: project docs]

---

## Metadata

**Confidence breakdown:**
- Data availability (STAT-04): HIGH — verified by reading all relevant source files
- SVG port approach: HIGH — web originals read; react-native-svg confirmed in Expo v56 docs
- Store submission flow: HIGH — official Expo docs consulted for both Android and iOS
- Apple Dev Program enrollment status: LOW — [ASSUMED] still blocked (per STATE.md)

**Research date:** 2026-06-23
**Valid until:** 2026-09-23 (stable ecosystem; EAS/store policies change slowly)
