---
phase: 03-push-notifications
status: human_needed
verified_at: 2026-06-13
source:
  - 03-01-SUMMARY.md
  - 03-02-SUMMARY.md
  - 03-03-SUMMARY.md
  - 03-04-SUMMARY.md
  - 03-05-SUMMARY.md
  - 03-06-SUMMARY.md
---

# Phase 03 Verification: Push Notifications

## Automated Result

Status: `human_needed`

All automated checks passed. A real-device or development-build smoke test is
still required for the OS permission prompt and actual Expo token path.

## Automated Checks

- `python3 -m pytest tests/test_notify.py -q`
- `python3 -m pytest tests/test_outage_lifecycle.py -q`
- `cd mobile && npx jest --watchAll=false`
- `cd mobile && npx tsc --noEmit`

Final combined command exited 0.

## Must-Haves

- NOTF-01 outage push fan-out: verified by `tests/test_notify.py`.
- NOTF-02 restoration push fan-out: verified by `tests/test_notify.py`.
- NOTF-04 neighbor warning fan-out: verified by `tests/test_notify.py` with `ADJACENCY_MAP`.
- INFR-01 Android FCM credential: EAS production credentials show Google Service Account Key V1.
- INFR-02 anonymous token registration: verified by mobile Jest `registerToken` tests.
- INFR-03 cooldown and unstable suppression: verified by `tests/test_notify.py`.

## Human Verification Required

1. Build/run a development build on a physical Android device.
2. Open the Notify tab.
3. Confirm the OS permission prompt appears only after tapping `Activar notificaciones`.
4. Confirm token registration succeeds for the saved zone.
5. Confirm toggles for `Sin luz`, `Volvió la luz`, and `Aviso de zona vecina` update independently.

## Release Note

Push security is intentionally off for Phase 3 execution. Before actual release,
enable Expo push security and configure `EXPO_ACCESS_TOKEN` in the GitHub
`cocuyo` environment secrets.
