# 05-01 Summary — History Fetch Layer

**Date:** 2026-08-14
**Plan:** 05-01-PLAN.md — react-native-svg install + historyCdnUrl + mobile/lib/history.ts + Wave 0 tests
**Status:** ✅ Complete

## What was done

1. **react-native-svg installed** via `npx expo install react-native-svg` → 15.15.4 (SDK 56 resolved version; plan expected ~15.15.5, expo resolved 15.15.4).
2. **`historyCdnUrl` added to `mobile/app.json` extra** — `"https://cocuyo.kralgor.com/history"` (no trailing slash).
3. **SVG mock appended to `mobile/jest.setup.js`** — Svg/Rect/Line/Path/Text mocks returning React elements.
4. **`mobile/lib/history.ts` created** — all six types ported verbatim from `app/lib/history.ts` + `fetchRegionHistory` + `useHistory` (queryKey `['history', regionKey]`, staleTime 6h, gcTime 24h, networkMode offlineFirst). `useHistory` normalizes `data ?? null` so disabled queries return `data: null` (React Query v5 returns `undefined` for disabled queries).
5. **`mobile/__tests__/lib/history.test.ts` created** — 7 tests: fetch null on non-OK, null on throw, typed parse, URL pattern, useHistory(null) no network, data exposure, query options.

## Tests

- `history.test.ts`: 7/7 pass
- `api.test.ts`: 5/5 pass (see bonus fix)
- `tsc --noEmit`: clean

## Deviations from plan

- **`useHistory` data normalization**: plan contract says "useHistory(null) returns { data: null }". Raw React Query v5 disabled queries expose `data: undefined`; wrapped with `data: query.data ?? null`.
- **Test render approach**: plan suggested renderHook from a testing-library package; none is installed. Used the repo's existing react-test-renderer + Probe pattern (amoled.test.ts) with a `waitFor` settle helper for React Query's async resolution.

## Bonus fix (latent bug found during execution)

- **`mobile/__tests__/lib/api.test.ts`**: its `expo-constants` jest.mock was dead — babel.config.js uses `babel-preset-expo` without the jest preset, so `jest.mock` is NOT hoisted and runs after `lib/api.ts` already loaded (fallback CDN URL used silently). Also the mock factory lacked `__esModule: true`, which babel's `_interopRequireDefault` needs to avoid double-wrapping. Fixed both, added a URL assertion test. Same class of bug as found in history.test.ts.

## Files

| File | Change |
|------|--------|
| `mobile/package.json` | + react-native-svg 15.15.4 |
| `mobile/app.json` | + extra.historyCdnUrl |
| `mobile/jest.setup.js` | + react-native-svg mock |
| `mobile/lib/history.ts` | NEW — types + fetch + hook |
| `mobile/__tests__/lib/history.test.ts` | NEW — 7 tests |
| `mobile/__tests__/lib/api.test.ts` | Fixed dead mock + URL assertion |
