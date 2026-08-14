# Cocuyo Mobile

React Native (Expo SDK 56) app for [Cocuyo](https://github.com/Kralgor/cocuyo) — Venezuela's power outage monitoring system. Reads the same `status.json` from CDN and submits reports to the same Supabase backend as the web app, plus push notifications, food spoilage timers, full offline mode, and WhatsApp sharing.

Anonymous. Open source. No government affiliation.

## Features

- **Live outage status** per zone, with staleness indicator when offline (STAT-01/02/03)
- **Outage history + return-time estimates** — 30-day strip chart, 48h risk forecast, detected patterns (STAT-04)
- **Report submission** — GPS auto-detect with manual zone fallback, offline queue with auto-sync (REPT-01/02/03)
- **Push notifications** — power out, power restored, neighboring-zone warnings (NOTF-01/02/04, code-complete)
- **Food spoilage timers** — pre-built Venezuelan food list + custom items, auto-start on outage, local alerts (FOOD-01..04)
- **WhatsApp sharing** — one-tap pre-formatted Spanish status text (SHAR-01)
- **Battery optimizations** — AMOLED true-black theme, reduced refresh below 20% battery (BATT-01/02)
- **Emergency contacts** per zone (BATT-03)
- **Trust onboarding** + persistent privacy/open-source section (TRST-01/02)

## Stack

- Expo SDK 56 + Expo Router (file-based routing)
- React Query 5 + MMKV sync persister (offline-first cache, stale-while-revalidate)
- expo-notifications (local food timers + Expo Push relay)
- react-native-svg (history/forecast charts)
- jest-expo (~206 tests)

## Development

```bash
npm install
npx expo start          # Expo Go / emulator / dev build
npm test                # jest-expo suite
npx tsc --noEmit
npx expo lint
```

## Configuration

Runtime config lives in `app.json` `extra`:

| Key | Purpose |
|-----|---------|
| `statusCdnUrl` | status.json CDN URL (fallback: `https://cocuyo.kralgor.com/status.json`) |
| `historyCdnUrl` | history JSON base (fallback: `https://cocuyo.kralgor.com/history`) |
| `supabaseUrl` / `supabaseAnonKey` | report submission + push token registration (anon key only — ADR-007, never the service_role key) |

## Builds & store submission

```bash
eas build --platform android --profile production
eas build --platform ios     --profile production   # requires Apple Developer Program
eas submit --platform android --profile production  # after first manual Play Console upload
```

`eas.json` has `submit.production` profiles for both stores. Store submission is pending the Google Play ($25) and Apple Developer ($99/yr) accounts — the human gate checklist is in `.planning/phases/05-polish-store-submission/05-03-PLAN.md`.

## Testing notes

- `babel.config.js` uses `babel-preset-expo` without the jest preset — `jest.mock` calls are **not hoisted**, so mocks (e.g. `expo-constants`) must be declared before the module under test loads, and mock factories need `__esModule: true`.
- React 19's react-test-renderer requires `act()` around `create()`, and renderer instances must be retained in a variable.
