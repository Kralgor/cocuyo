# Technology Stack

**Project:** Cocuyo Mobile (React Native / Expo)
**Researched:** 2026-05-24
**Knowledge cutoff:** August 2025 — external tools unavailable; all versions from training data. Verify before pinning in package.json.

---

## Recommended Stack

### Core Platform

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| React Native | 0.75+ (via Expo) | Mobile runtime | Shared React/TS knowledge with web app; large ecosystem |
| Expo SDK | 52 (latest stable as of Aug 2025) | Build tooling, native modules, OTA | Manages native build complexity; EAS handles stores |
| TypeScript | 5.x | Type safety | Matches web app, strict mode already in use |
| Node | 20 LTS | Build environment | Required by Expo toolchain |

**Confidence: MEDIUM** — Expo SDK 52 released Nov 2024 with RN 0.76. SDK 53 may be out by mid-2026; verify `expo.dev/changelog` before starting.

---

### Navigation

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Expo Router | 4.x | File-based routing | Ships with Expo SDK 52; same mental model as Next.js App Router; deep-link-ready out of the box |

**Why not React Navigation (standalone)?** Expo Router is built on top of React Navigation v7 but adds file-system routing and typed routes. For a new Expo project in 2025+ this is the default. No reason to bypass it.

**Confidence: HIGH** — Expo Router is the official Expo routing solution since SDK 50.

---

### State Management

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Zustand | 4.x | Global app state | Minimal boilerplate, no providers, works well with React Native; outage status, zone selection, timer state |
| React Query (TanStack Query) | 5.x | Remote data fetching + cache | Handles status.json fetch, stale-while-revalidate, background refetch; pairs with offline persistence |

**Why not Redux?** Overkill for this scope. State is: current zone, outage status (from CDN), food timers (local), queued reports (local). Zustand handles all of this in ~100 lines.

**Why not Context + useReducer?** Fine for small apps; breaks down when you need cross-cutting concerns like offline queue + timer state + network status simultaneously.

**Confidence: HIGH** — Zustand + React Query is the dominant pairing for React Native in 2025.

---

### Offline-First

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| MMKV | 2.x (via `react-native-mmkv`) | Persistent key-value store | 30x faster than AsyncStorage; synchronous reads; used by Discord, Shopify; perfect for caching status.json and queued reports |
| TanStack Query + `@tanstack/query-async-storage-persister` | 5.x | Persist query cache across app restarts | Plugs into React Query; status.json cached to disk, served offline |
| NetInfo (`@react-native-community/netinfo`) | 11.x | Network state detection | Triggers offline banner, pauses CDN fetches, flushes report queue on reconnect |

**Offline report queue pattern:**
- Queued reports stored in MMKV as JSON array
- On `NetInfo` `isConnected` transition to `true` → flush queue → POST to Supabase REST API
- On 429/5xx → exponential backoff, keep in queue

**Why not AsyncStorage?** AsyncStorage is async and JS-thread-bound. MMKV is synchronous, C++ native, significantly faster. No reason to use AsyncStorage in a new project.

**Why not WatermelonDB or SQLite?** Overkill. Data model is: one status.json blob (flat JSON) + array of queued report objects + food timer records. A fast KV store handles this. SQLite/WatermelonDB adds schema migrations complexity with no benefit.

**Confidence: HIGH** — MMKV is the consensus choice for RN KV storage since 2022. NetInfo is official community package.

---

### Push Notifications

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `expo-notifications` | SDK-paired | Local + remote push notifications | Official Expo module; handles both FCM (Android) and APNs (iOS) via Expo Push Service or direct FCM |
| Firebase Cloud Messaging (FCM) | v9 (HTTP v1 API) | Upstream push delivery | Required for Android; used as universal transport for iOS too via FCM-to-APNs bridge |
| `@react-native-firebase/messaging` | 20.x | Direct FCM integration (if bypassing Expo Push Service) | Needed if sending notifications directly via FCM without Expo's relay |

**Two approaches — choose one:**

**Option A: Expo Push Service (simpler)**
- Pipeline sends to `https://exp.host/--/api/v2/push/send`
- Expo relays to FCM / APNs
- Pro: no Firebase project setup in app; one unified API
- Con: Expo is intermediary; not fully open-source infra
- **Recommended for v1** — removes Firebase SDK from app, no google-services.json required in repo

**Option B: Direct FCM (more control)**
- App registers with FCM directly, sends token to pipeline
- Pipeline calls FCM HTTP v1 API directly
- Pro: no Expo relay dependency
- Con: requires Firebase project, google-services.json, more setup
- Use when Expo Push Service limits (100 notifications/call, no scheduling) become constraints

**Recommendation: Start with Option A (Expo Push Service).** Venezuela outage notifications are broadcast-style (same message to all users in a zone) — Expo's service handles this fine. Can migrate to direct FCM in a later phase.

**Confidence: HIGH** — expo-notifications is the standard module. The two-approach distinction is well-documented.

---

### Local Notifications (Food Spoilage Timers)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `expo-notifications` | SDK-paired | Schedule local notifications | Same module as push — schedules device-side timers that fire even when app is backgrounded |

Local notifications via `expo-notifications` support:
- `scheduleNotificationAsync` with `TimeIntervalTrigger` — fires after N seconds
- Cancelable: `cancelScheduledNotificationAsync(id)`
- Persistent across app restarts (stored in OS notification center)

Food timer flow:
1. Outage detected → app auto-starts timers for stored food items
2. Each item has a configured spoilage window (e.g., refrigerator items: 4h, freezer: 24h)
3. Notification fires at threshold: "Tu nevera lleva 4 horas sin luz — revisa los alimentos"
4. If power restored before threshold → cancel timer

**Confidence: HIGH** — expo-notifications local scheduling is well-established.

---

### GPS / Location

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `expo-location` | SDK-paired | GPS coordinates for report submission | Official Expo module; handles permissions, background location, reverse geocoding |

Location flow:
1. User opens "report outage" screen
2. Request `foreground` location permission
3. `getCurrentPositionAsync` → lat/lng
4. Reverse-geocode to match against zone polygon (or send raw coords to Supabase — let backend match)
5. If denied or unavailable → show zone picker dropdown (manual fallback)

**Do NOT request background location.** App stores never approve background location without justification. Foreground-only is sufficient — user is actively submitting a report.

**Privacy:** Coordinates used only for zone matching. Do not persist GPS coords to device or server beyond the single API call. Matches privacy constraint in PROJECT.md.

**Confidence: HIGH** — expo-location is the standard; foreground-only permission strategy is well-documented best practice.

---

### UI / Styling

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| NativeWind | 4.x | Tailwind CSS for React Native | Shared mental model with web Tailwind; dark mode via `dark:` variants; AMOLED support via `dark:bg-black` |
| `react-native-reanimated` | 3.x | Smooth animations | Required by many component libraries; scroll animations, notification banners |
| `react-native-gesture-handler` | 2.x | Native gestures | Required by Expo Router and Reanimated |

**AMOLED dark mode:** NativeWind's `dark:bg-black` applies true `#000000` background. Use `useColorScheme()` from `react-native` to detect system theme. Provide an in-app toggle stored in MMKV.

**Why not React Native Paper or NativeBase?** Both are component libraries that add significant bundle size and impose design systems. NativeWind gives styling without locking into pre-built components — better for a custom utility app.

**Why not Tamagui?** Excellent library but complex setup, relies on compiler transforms. NativeWind is simpler and the Tailwind mental model is already in use on the web side.

**Confidence: MEDIUM** — NativeWind v4 was released in 2024 with full RN support. Verify v4 stability with current Expo SDK before adopting.

---

### Maps

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `react-native-maps` | 1.x | Display Venezuelan zone map with outage overlays | Most widely used RN maps library; uses Google Maps on Android, Apple Maps on iOS |

**Note:** The web app uses Leaflet.js — that does not port to React Native. `react-native-maps` is the correct replacement. Zone polygon overlays use `<Polygon>` component with color-coded fill (red = no power, green = power).

**Confidence: HIGH** — react-native-maps is the standard; no realistic alternative in 2025.

---

### WhatsApp Sharing

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `expo-sharing` + `Linking` | SDK-paired | Share text via WhatsApp or system share sheet | `Linking.openURL('whatsapp://send?text=...')` opens WhatsApp directly; fall back to `Share.share()` system sheet if WhatsApp not installed |

**Pattern:**
```typescript
const shareOutageStatus = async (zone: string, hoursOut: number) => {
  const text = `Sin luz hace ${hoursOut}h en ${zone} — vía Cocuyo`;
  const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(text)}`;
  const canOpen = await Linking.canOpenURL(whatsappUrl);
  if (canOpen) {
    await Linking.openURL(whatsappUrl);
  } else {
    await Share.share({ message: text });
  }
};
```

No third-party library needed. `Linking` and `Share` are built into React Native core.

**Confidence: HIGH** — this pattern is stable and well-documented.

---

### Internationalization (ES/EN)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `expo-localization` + `i18next` + `react-i18next` | SDK-paired / 23.x / 14.x | Locale detection + translation | expo-localization reads device locale; i18next handles translation files; same pattern used in RN ecosystem widely |

**Confidence: MEDIUM** — i18next/react-i18next is the dominant choice but verify current RN compatibility.

---

### Build, Deployment, OTA

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| EAS Build | Latest | Cloud compilation for Android APK/AAB + iOS IPA | No local Xcode/Android Studio required; critical for solo dev without Mac for iOS builds |
| EAS Submit | Latest | Automated store submission | Submits AAB to Google Play, IPA to App Store Connect |
| EAS Update | Latest | OTA updates (JS bundle only) | Ship bug fixes without store review; required for rapid iteration in a Venezuela-focused app |

**OTA update strategy:**
- Native code changes (new permissions, new native modules) → full EAS Build + store release
- JS-only changes (UI, logic, translations) → EAS Update, delivers in seconds
- `expo-updates` on the device checks for updates on launch and background

**App store setup cost:**
- Google Play: $25 one-time (matches PROJECT.md)
- Apple Developer: $99/year (matches PROJECT.md)

**Confidence: HIGH** — EAS is Expo's official build/deploy platform, well-documented.

---

### HTTP Client

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `fetch` (built-in) | - | CDN reads (status.json) + Supabase REST API writes | React Native ships with fetch; no axios needed for simple GET/POST |
| `@supabase/supabase-js` | 2.x | Supabase client | Handles REST API calls with anon key; type-safe with generated types; matches existing web app usage |

**Why not axios?** fetch is sufficient. Axios adds bundle size with no benefit for this use case.

**Supabase client config for mobile:**
```typescript
import { createClient } from '@supabase/supabase-js';
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV();
const mmkvAdapter = {
  getItem: (key: string) => storage.getString(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { storage: mmkvAdapter, autoRefreshToken: false, persistSession: false },
});
```

`persistSession: false` because the app has no user accounts — anon key only.

**Confidence: HIGH** — supabase-js v2 is current; MMKV storage adapter pattern is documented.

---

### Battery / Background Monitoring

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `expo-battery` | SDK-paired | Read battery level + charging state | Enables low-battery mode: reduce status.json refresh interval below 20% battery |
| `expo-background-fetch` | SDK-paired | Periodic background status check | Fetches status.json in background; required to detect outage/restore while app is not open |
| `expo-task-manager` | SDK-paired | Registers background tasks | Required companion to expo-background-fetch |

**Background fetch constraints:**
- iOS: OS controls frequency (minimum ~15 min); cannot guarantee exact intervals
- Android: More reliable with Foreground Service, but adds notification requirement
- For Venezuela use case: push notifications are primary; background fetch is secondary/fallback

**Confidence: HIGH** — expo-battery and expo-background-fetch are official modules. Background fetch iOS limitations are well-documented.

---

### Testing

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Jest | 29.x | Unit + integration tests | Default in Expo projects |
| `@testing-library/react-native` | 12.x | Component tests | Standard RN testing approach |
| Detox | 20.x | E2E tests | RN-specific E2E; optional for v1 |

**Confidence: HIGH** — Jest + RNTL is the standard combo.

---

## Full Dependency List

```bash
# Create project
npx create-expo-app@latest cocuyo-mobile --template blank-typescript

# Core navigation
npx expo install expo-router react-native-safe-area-context react-native-screens

# State
npm install zustand @tanstack/react-query

# Offline persistence
npm install react-native-mmkv @tanstack/query-async-storage-persister @tanstack/query-sync-storage-persister
npx expo install @react-native-community/netinfo

# Notifications (local + push)
npx expo install expo-notifications expo-device

# Location
npx expo install expo-location

# Maps
npx expo install react-native-maps

# UI
npm install nativewind
npx expo install react-native-reanimated react-native-gesture-handler

# Supabase
npm install @supabase/supabase-js

# i18n
npm install i18next react-i18next
npx expo install expo-localization

# Battery + background
npx expo install expo-battery expo-background-fetch expo-task-manager expo-updates

# Testing
npm install -D jest @testing-library/react-native @types/jest
```

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Framework | Expo SDK 52 + Expo Router | Bare React Native | Bare requires local Xcode/Android Studio; no OTA; more friction for solo dev first mobile app |
| Navigation | Expo Router | React Navigation (standalone) | Expo Router IS React Navigation; no reason to bypass file-based routing |
| State | Zustand | Redux Toolkit | RTK is overkill; boilerplate exceeds app complexity |
| Storage | MMKV | AsyncStorage | MMKV is 30x faster, synchronous, used in production at Discord/Shopify |
| Storage | MMKV | SQLite / WatermelonDB | Data model is flat KV + JSON arrays; no relational queries needed |
| Styling | NativeWind | React Native Paper | Paper imposes Material Design; NativeWind is utility-first like web Tailwind |
| Styling | NativeWind | Tamagui | Tamagui compile-time transforms add complexity; NativeWind simpler |
| Push | Expo Push Service (v1) | Direct FCM | Expo service simpler for v1; migrate to direct FCM if relay becomes bottleneck |
| Maps | react-native-maps | Leaflet (web) | Leaflet does not run in React Native; react-native-maps is the only mature option |
| HTTP | fetch + supabase-js | axios | fetch is built-in; axios adds bundle size with no benefit |
| Cross-platform | React Native | Flutter | No shared knowledge with existing web codebase; Dart learning curve; React/TS already known |

---

## Version Verification Required

**Before pinning any version in package.json, verify these:**

| Package | Source to Check | Why |
|---------|-----------------|-----|
| `expo` | expo.dev/changelog | SDK 53 may be current by project start |
| `expo-router` | expo.dev/router/docs | Major version tied to SDK version |
| `react-native-mmkv` | github.com/mrousavy/react-native-mmkv | New Architecture (JSI) compatibility per SDK |
| `nativewind` | nativewind.dev | v4 stability with current Expo SDK |
| `@supabase/supabase-js` | supabase.com/docs | v3 may have released |
| `@tanstack/react-query` | tanstack.com/query | v5 is current as of Aug 2025 |

---

## Sources

- Training data (knowledge cutoff August 2025) — **all versions are MEDIUM confidence**
- Official Expo documentation: https://docs.expo.dev
- Expo EAS documentation: https://docs.expo.dev/eas/
- React Native Maps: https://github.com/react-native-maps/react-native-maps
- MMKV: https://github.com/mrousavy/react-native-mmkv
- NativeWind: https://www.nativewind.dev
- TanStack Query: https://tanstack.com/query/latest
- Zustand: https://github.com/pmndrs/zustand

**External verification tools were unavailable during this research session. All version numbers and release states reflect training data as of August 2025. Run `npx expo install --fix` after project creation to align all Expo-managed packages to the installed SDK version.**
