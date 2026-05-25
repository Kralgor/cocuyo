# Domain Pitfalls

**Domain:** React Native + Expo mobile app — offline-first, push notifications, Venezuela context
**Researched:** 2026-05-24
**Confidence note:** External tools unavailable this session. Findings based on training data (cutoff Aug 2025) covering well-documented Expo/RN pitfalls. Confidence levels reflect source quality, not verification status.

---

## Critical Pitfalls

Mistakes that cause rewrites or major production failures.

---

### Pitfall 1: Push Token Registration Race Condition

**What goes wrong:** App requests push notification permission and registers token before the user has any context for why. On iOS, the system permission dialog appears immediately on first launch. Users deny it reflexively. Once denied, iOS does not re-prompt — the user must go to Settings manually. You lose notification capability permanently for that install.

**Why it happens:** Developers copy the Expo push notification quickstart, which registers at app startup. The quickstart is for demos, not production UX.

**Consequences:** Silent failure — app looks like it's sending notifications but the token was never obtained. No error thrown. Notification open rates collapse. Venezuelan users who distrust apps reflexively will deny at even higher rates.

**Prevention:**
- Gate permission request behind an explicit opt-in screen — show value first ("get alerted the moment power cuts in your zone")
- On Android, permission is granted by default (pre-Android 13) — still show the opt-in screen for UX consistency
- On Android 13+, POST_NOTIFICATIONS permission required at runtime — handle like iOS
- Store the token in AsyncStorage with a `tokenRegisteredAt` timestamp — detect stale tokens (FCM rotates them)
- Never call `registerForPushNotificationsAsync()` in the root component or `useEffect` at mount

**Detection:** Token is `null` after registration attempt with no error. Check permission status explicitly with `Notifications.getPermissionsAsync()` before attempting registration.

**Phase:** Phase 1 (core setup) — architecture decision, cannot be retrofitted easily.

---

### Pitfall 2: Expo Go vs Production Build Notification Behavior Divergence

**What goes wrong:** Push notifications work in Expo Go during development. They silently fail in production builds or behave differently. Developers ship thinking notifications work, they don't.

**Why it happens:** Expo Go uses Expo's shared FCM sender ID and APNs certificate. Production builds use your own Firebase project credentials. The `google-services.json` and `GoogleService-Info.plist` must be in the project and correctly referenced in `app.json`. EAS Build handles this if configured — but misconfiguration produces no build error, only runtime failure.

**Consequences:** Notification feature appears to work in all testing, fails for all real users. Discovered post-launch. Fix requires a new build (EAS) and store update — adds days to recovery.

**Prevention:**
- Test notifications using a development build (`eas build --profile development`) pointed at a real device, not Expo Go
- Verify `google-services.json` is referenced in `app.json` under `android.googleServicesFile`
- Verify `GoogleService-Info.plist` under `ios.googleServicesFile`
- Use `expo-notifications` test tool to send a test notification to the registered token before shipping
- Add a "test notification" button in dev builds that fires a local notification — confirms the stack works end-to-end

**Detection:** Notifications work in Expo Go but fail on production builds. Check Firebase console — if the token appears in Firebase but notifications don't arrive, the certificate mismatch is on APNs (iOS). If the token doesn't appear, `google-services.json` is wrong.

**Phase:** Phase 1 (infrastructure) — must be verified before any notification feature work.

---

### Pitfall 3: Offline Cache Becomes Stale Without Invalidation Strategy

**What goes wrong:** App caches `status.json` for offline use. The cache is never invalidated correctly — users see stale outage status hours after power has returned. Timer UI shows "sin luz hace 8 horas" when power came back 5 hours ago. Erodes trust.

**Why it happens:** Developers implement "cache on first load, use cache if offline" without thinking through the staleness window. AsyncStorage TTL is not enforced. No cache header parsing from the CDN response.

**Consequences:** Core value proposition destroyed — "real-time outage monitoring" shows hours-old data silently. Venezuelan users sharing wrong status on WhatsApp damages credibility of the app community-wide.

**Prevention:**
- Store `cachedAt` timestamp alongside every cached `status.json`
- Display "last updated X minutes ago" in the UI whenever showing cached data — never hide staleness
- When online: always fetch fresh, update cache, then render — no "use cache first" for the status data
- When offline: show cached data WITH a visible staleness warning if cache is older than 15 minutes
- CDN delivers `Cache-Control` headers — parse `max-age` and honor it rather than inventing your own TTL
- The `status.json` already contains a `generated_at` field — use it as the authoritative freshness indicator

**Detection:** Users report incorrect status that contradicts WhatsApp group information. "Last updated" timestamp in the UI is missing or hidden.

**Phase:** Phase 1 (offline-first core) — must be designed correctly from the start.

---

### Pitfall 4: GPS Permission Kills Report Submission Flow

**What goes wrong:** App requires GPS to submit a report. User has GPS permission denied (common on Venezuelan devices running older Android with aggressive battery management). Report submission fails entirely. User cannot report even though they know their zone.

**Why it happens:** GPS is treated as required input. No fallback to manual zone selection. Permission denied = submit button disabled.

**Consequences:** Report submission rates collapse precisely when they matter most — during outages when users are most motivated to report but may have GPS disabled to save battery.

**Prevention:**
- GPS is optional, not required. Flow: attempt GPS → if denied or unavailable → immediately show zone picker
- Never block form submission waiting for GPS timeout — GPS can take 30+ seconds on cold start indoors
- Store user's last manually selected zone and pre-select it — reduces friction on repeat submissions
- Request GPS permission only when user explicitly taps "detect my location" button, not on form open
- Set a 10-second GPS timeout; fall back to manual picker automatically if exceeded

**Detection:** Analytics (if any) or crash reports showing report submission drop-off at the GPS step. Test by denying location permission and attempting to submit.

**Phase:** Phase 2 (report submission) — must be designed with fallback from day one.

---

### Pitfall 5: FCM Background Notification Handling Not Implemented

**What goes wrong:** Notifications arrive while app is in background or killed state. The notification is delivered by FCM but the app cannot process it correctly — food timers don't start automatically, local state isn't updated. User sees a notification, taps it, app opens to stale state.

**Why it happens:** Foreground notification handlers (`addNotificationReceivedListener`) are tested during development when the app is always in foreground. Background handling (`TaskManager` + `expo-task-manager`) requires separate registration and is frequently skipped.

**Consequences:** Core feature broken: "food spoilage timer auto-starts on detected outage" requires the app to respond to a background notification. If background handling isn't implemented, the timer only starts if the user opens the app manually.

**Prevention:**
- Register a background task with `TaskManager.defineTask` for `BACKGROUND_NOTIFICATION_TASK`
- Background tasks in Expo have strict constraints: no UI updates, must complete quickly (<30 seconds), cannot access certain APIs
- Test background behavior explicitly: send notification while app is killed, verify timer state when app reopens
- Use local notifications (not remote) for food spoilage warnings — these can be scheduled locally without network
- On Android, background work is subject to Doze mode. Venezuelan devices with aggressive battery optimization (Huawei EMUI, Xiaomi MIUI) will kill background tasks aggressively

**Detection:** Timer doesn't start when app is in background. Notification received but `addNotificationResponseReceivedListener` not firing on app open.

**Phase:** Phase 3 (food timers + notifications) — must be addressed as a unit, not afterthought.

---

### Pitfall 6: App Store Submission Fails on Last-Mile Requirements

**What goes wrong:** App is built and ready. App store submission rejected for non-obvious reasons. Common rejections:

**Apple App Store specific:**
- Missing privacy manifest (`PrivacyInfo.xcprivacy`) — required for apps using certain APIs including push notifications and location. Rejection is hard to debug because the requirement is new (2024) and not prominently documented.
- App uses location but `NSLocationWhenInUseUsageDescription` string in `Info.plist` is generic ("we use location") — Apple rejects vague descriptions
- App requests location permission but only uses it once for a form field — reviewer may flag as "unnecessary location usage"
- Missing `NSUserNotificationsUsageDescription` in `Info.plist`

**Google Play specific:**
- App collects "approximate location" — must declare in Data Safety form. Approximate vs Precise must match what you actually request.
- Permissions not justified in store listing metadata
- App targets API level below Google's current minimum — Expo SDK handles this but check that `targetSdkVersion` in `app.json` is current

**Why it happens:** These requirements are documented but scattered. First-time submitters don't know what they don't know.

**Consequences:** Weeks of delay. Apple review takes 1-3 days per cycle. Multiple rejection cycles = 2-4 weeks before launch. Store rejections require new builds for any code change.

**Prevention:**
- Use Expo's `app.json` to set all `infoPlist` strings: `NSLocationWhenInUseUsageDescription`, `NSUserNotificationsUsageDescription` — be specific ("to detect your power outage zone for report submission")
- Add `PrivacyInfo.xcprivacy` via Expo config plugin before first submission attempt
- Run `expo doctor` before any EAS Build — catches common misconfiguration
- Review Apple's App Store Review Guidelines section 5.1 (Privacy) and 4.2 (Minimum Functionality) before writing the app description
- Google Play Data Safety form: pre-fill it based on what the app actually does. This app: approximate location (optional, one-time), no data stored on device beyond local cache

**Detection:** Review rejection email. Apple provides a reason code. Google Play provides a policy violation reason.

**Phase:** Phase 5 (submission) — but the `app.json` strings and privacy manifest must be in place from Phase 1.

---

## Moderate Pitfalls

---

### Pitfall 7: Timer Drift on Background/Killed App

**What goes wrong:** Food spoilage timers are implemented as JavaScript `setInterval` or countdown from a stored start time. When the app is backgrounded or killed, JavaScript stops. When the user reopens the app, the timer "catches up" but may have drifted by minutes. For food safety, a timer that shows 3:57 remaining when actual time remaining is 3:40 is a real problem.

**Prevention:**
- Never store timer as "time remaining" — store `outageSince` (absolute ISO timestamp of when outage started)
- On every render, calculate `timeElapsed = now - outageSince` and derive spoilage risk from elapsed time, not from a countdown
- This is resilient to app kills, device reboots, and timezone changes
- For food items: store `{ itemName, safeHours, outageSince }` — derive display from these

**Phase:** Phase 3 (food timers).

---

### Pitfall 8: Queued Report Sync Sends Duplicates

**What goes wrong:** User submits report offline. App queues it. Connectivity returns. App sends the queued report. Network hiccup — the POST succeeds server-side but the client doesn't receive the 200 response. App retries. Duplicate reports arrive in Supabase.

**Prevention:**
- Generate a UUID client-side for each report before queuing (`report_id`)
- Include `report_id` in the POST body
- Supabase `outage_reports` table should have a UNIQUE constraint on `report_id`
- Retry logic: exponential backoff, max 3 retries, clear queue on success OR on 409 Conflict (duplicate)
- Use `expo-background-fetch` or `expo-task-manager` to sync queue when connectivity returns, not only on app foreground

**Phase:** Phase 2 (report submission) and Phase 4 (offline queue).

---

### Pitfall 9: MMUI/EMUI Battery Killers Silently Break Background Work

**What goes wrong:** Venezuelan users heavily use Huawei, Xiaomi, Samsung devices with aggressive battery management overlays. These OEM layers kill background processes aggressively, ignore Android's standard battery optimization exemption, and prevent notifications from arriving when the screen is off.

**Why it happens:** This is not a bug you can fix in code — it's an OEM restriction. But most developers only test on Pixel devices or emulators where background behavior is standard.

**Prevention:**
- Cannot be fully prevented — must be communicated to users
- Add an onboarding screen: "If you have a Huawei or Xiaomi phone, go to Settings > Battery > App Autostart and enable Cocuyo"
- Link to `dontkillmyapp.com` style instructions for common OEM models
- Design the app so it works without reliable background delivery: polling on foreground is the fallback, not background push
- Test on physical Xiaomi/Samsung device during development, not just emulator

**Detection:** Notifications work on emulator and Pixel, fail on Xiaomi. `adb logcat` shows process being killed.

**Phase:** Phase 3 (notifications) — must be tested on real OEM hardware.

---

### Pitfall 10: WhatsApp Deep Link Breaks on iOS

**What goes wrong:** `Linking.openURL('whatsapp://send?text=...')` works on Android but silently fails on iOS if WhatsApp is not installed. No error thrown on older iOS. On iOS 18+, behavior changed again.

**Prevention:**
- Always check `Linking.canOpenURL('whatsapp://')` before attempting deep link
- Fallback: copy text to clipboard + show "copied, open WhatsApp manually" message
- The share text should use the system share sheet (`Share.share()`) as the primary path — this handles all apps and gracefully degrades to clipboard on iOS
- WhatsApp-specific deep link is a convenience enhancement on top of system share, not the primary path

**Phase:** Phase 2 or 3 (sharing feature).

---

### Pitfall 11: status.json Fetch Fails Silently on Bad Connectivity

**What goes wrong:** Venezuelan internet has partial connectivity — DNS resolves but TCP connections time out after 30+ seconds. React Native's `fetch()` default timeout is indefinitely long (controlled by platform). App appears frozen while waiting for a timeout that never comes.

**Prevention:**
- Wrap all `fetch()` calls with an `AbortController` timeout: 10 seconds max for `status.json`
- Show a loading skeleton — never a blank screen — during fetch
- On timeout, immediately serve cached data with a staleness warning
- Test by throttling to "Offline" in the simulator mid-request — verify fallback behavior
- Cloudflare R2 is already globally distributed with edge nodes — latency from Venezuela should be acceptable when connectivity exists, so 10 seconds is generous

**Phase:** Phase 1 (core data fetching).

---

### Pitfall 12: OTA Updates Break In-Flight on Slow Connections

**What goes wrong:** Expo EAS Update delivers over-the-air JavaScript bundle updates. On slow connections (common in Venezuela), the update download starts but doesn't complete before the user kills the app. On next launch, the app may load a partial bundle.

**Prevention:**
- Expo handles atomic updates — partial downloads don't corrupt the running bundle
- But: set `updates.fallbackToCacheTimeout: 0` in `app.json` — forces immediate use of cached bundle on slow connections rather than waiting for update
- Use `expo-updates` `checkForUpdateAsync()` only when connectivity is confirmed, not on cold launch
- For critical fixes, use EAS Update with `channel: production` — but don't rely on OTA for features that require native code changes (those need a full store build)

**Phase:** Phase 5 (deployment) — but `app.json` config needed from Phase 1.

---

## Minor Pitfalls

---

### Pitfall 13: Dark Mode AMOLED Implementation Breaks on Older Android

**What goes wrong:** `backgroundColor: '#000000'` (true black) renders with AMOLED optimization on modern devices. On older Android (API 26-28), `StatusBar` doesn't respect dark mode configuration correctly, leaving a light status bar over a black background.

**Prevention:**
- Set `StatusBar` style explicitly via `expo-status-bar`: `<StatusBar style="light" backgroundColor="#000000" />`
- Test on Android API 26 emulator specifically
- Android 10+ respects system dark mode via `useColorScheme()` — for older Android, default to dark (Venezuelan context: dark is better for battery)

**Phase:** Phase 1 (UI shell).

---

### Pitfall 14: Leaflet Map Not Available in React Native

**What goes wrong:** Web app uses Leaflet.js. Developer assumes they can reuse Leaflet in React Native. `react-leaflet` requires a DOM — it does not run in React Native.

**Prevention:**
- Use `react-native-maps` (Mapbox or Google Maps) for any interactive map in the mobile app
- The MVP likely doesn't need a map — zone selection can be a text list with search. Defer maps to a later phase.
- If a map is needed: `react-native-maps` with Google Maps on Android, Apple Maps on iOS — both require separate API key setup and billing accounts

**Phase:** Phase 2+ (if map is added to mobile).

---

### Pitfall 15: TypeScript Strict Mode Pain with Expo SDK Types

**What goes wrong:** Expo SDK types have occasional gaps — some APIs return `string | null` but are typed as `string`. Strict mode (`"strict": true` in `tsconfig.json`) will surface these. Developers disable strict mode rather than fixing types.

**Prevention:**
- Keep strict mode — it catches real bugs in notification token handling and GPS result parsing
- Use `as` casts sparingly and only when you've verified the value
- GPS: `Location.getCurrentPositionAsync()` returns coordinates that are always numbers if the promise resolves — safe to treat as non-null after success
- Push token: `token.data` is `string` but only if permission was granted — gate it behind the permission check

**Phase:** Phase 1 (TypeScript setup).

---

## Venezuela-Specific Infrastructure Warnings

---

### V1: Bandwidth Assumption Mismatch

**What goes wrong:** Developers test on WiFi or LTE. Venezuelan users on 2G/ADSL experience the app as unusably slow. `status.json` at 50KB downloads in 2 seconds on LTE, 30+ seconds on 2G.

**Prevention:**
- Keep `status.json` under 20KB — if it grows, the pipeline must compress or paginate
- Images in the app: use SVG for icons, no raster images above 50KB
- First meaningful paint must be from cache — network is a background refresh, not a blocking load
- Test with iOS Network Link Conditioner or Android emulator throttling set to "2G" or "Edge"

**Phase:** Phase 1 (architecture) — cannot be retrofitted.

---

### V2: Device Age — Old Android API Levels Are Mainstream

**What goes wrong:** App targets modern Android features. 30-40% of Venezuelan users run Android 8-10 (API 26-29) on older devices. Modern APIs silently unavailable.

**Prevention:**
- Set `android.minSdkVersion: 24` in `app.json` (Android 7) — covers ~95% of Venezuelan device fleet based on regional Play Store data
- Test on Android API 26 emulator for every feature
- Background notification APIs changed significantly between API 26 and 31 — verify behavior on old API levels
- Expo SDK 50+ requires minimum Android API 23 — check current Expo requirements at build time

**Phase:** Phase 1 (app.json configuration).

---

### V3: Storage Pressure From Other Apps

**What goes wrong:** Devices in Venezuela run at near-full storage (WhatsApp media, etc). `AsyncStorage` writes silently fail when device storage is full. Cached status, queued reports, and food timer state all lost.

**Prevention:**
- Wrap all `AsyncStorage.setItem()` calls in try/catch — storage write failure is not exceptional, it's expected
- When cache write fails: keep data in memory for the current session, show no error to the user
- When queue write fails: log the failure, show user "report will be sent when space is available"
- Use `expo-file-system` `getFreeDiskStorageAsync()` to check available space before writing large cache updates

**Phase:** Phase 1 (storage layer).

---

### V4: Time Zone Confusion During Power Outage Detection

**What goes wrong:** Venezuela is UTC-4 year-round (no DST). `status.json` timestamps are UTC. If the device clock drifts (common on devices without reliable NTP — which requires internet), "time since last outage" calculations are wrong. Devices that have been offline for hours drift by minutes.

**Prevention:**
- Always use server timestamps from `status.json` for outage duration calculations, never device clock
- Display durations as relative ("hace 3 horas") computed from `status.json.generated_at` as the reference point, not `Date.now()`
- When device has been offline: show "last updated X minutes ago" using the `status.json` timestamp, not a live countdown
- For food timers: `outageSince` is the FCM notification receive time OR the `status.json` outage_start time — never device clock at timer-start

**Phase:** Phase 3 (timers) — but timestamp handling decisions affect Phase 1 data model.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Phase 1: App shell + data fetch | Silent fetch timeout on bad connectivity | AbortController with 10s timeout, immediate cache fallback |
| Phase 1: Offline cache | Stale cache shown without warning | Always show `generated_at` timestamp, staleness banner if >15min |
| Phase 1: TypeScript setup | Strict mode disabled to avoid pain | Keep strict mode, type GPS and notification results carefully |
| Phase 2: Report submission | GPS required, blocks submission | GPS optional always, zone picker always available as fallback |
| Phase 2: Report deduplication | Retry sends duplicates | Client-generated UUID per report, UNIQUE constraint in DB |
| Phase 3: Push notifications | Expo Go works, production fails | Test with `eas build --profile development`, not Expo Go |
| Phase 3: Push permission | iOS denies reflexively on first launch | Explicit opt-in screen with value proposition before permission request |
| Phase 3: Food timers | Timer drift on backgrounded app | Store absolute `outageSince` timestamp, derive display at render |
| Phase 3: Background handling | Timers don't auto-start when app killed | Background task via `TaskManager`, tested on killed-state device |
| Phase 3: OEM battery killers | Notifications silenced on Xiaomi/Huawei | User education in onboarding, test on real OEM hardware |
| Phase 4: Queue sync | Duplicate reports on retry | Idempotent POST with `report_id`, 409 treated as success |
| Phase 5: App store | Rejection for missing privacy strings | `NSLocationWhenInUseUsageDescription` specific, PrivacyInfo.xcprivacy |
| Phase 5: OTA updates | Slow download corrupts session | `fallbackToCacheTimeout: 0`, atomic bundle delivery |
| All phases | Assumption of WiFi-equivalent connectivity | Test at "2G" throttle for every feature that touches the network |

---

## Sources

- Confidence: HIGH (well-documented, stable Expo/RN behavior)
  - FCM registration lifecycle, iOS permission one-time dialog behavior
  - Expo Go vs production build notification divergence (official Expo docs pattern)
  - Background task constraints in `expo-task-manager`
  - Apple App Store PrivacyInfo.xcprivacy requirement (introduced 2024, stable since)
  - `react-leaflet` DOM dependency (fundamental architecture constraint)

- Confidence: MEDIUM (community-documented, may have partial workarounds)
  - OEM battery killer behavior (Xiaomi MIUI, Huawei EMUI) — behavior varies by OEM version
  - WhatsApp deep link iOS behavior — varies by WhatsApp version
  - Venezuelan device fleet age distribution — based on regional Latin America Play Store data

- Confidence: LOW (requires phase-specific research to verify current state)
  - Expo SDK 50+ minimum API level requirements — verify against current Expo SDK at project start
  - Google Play Data Safety form requirements — evolves; verify against Play Console at submission time
  - Android 13 `POST_NOTIFICATIONS` runtime permission handling in current Expo SDK
