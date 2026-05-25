---
phase: 01-foundation-offline-core
plan: 01a
type: execute
wave: 1
depends_on: []
files_modified:
  - mobile/package.json
  - mobile/app.json
  - mobile/eas.json
  - mobile/tsconfig.json
  - mobile/babel.config.js
  - mobile/jest.config.js
  - mobile/jest.setup.js
autonomous: false
requirements: [PLAT-01, PLAT-02, PLAT-03]
user_setup:
  - service: expo-eas
    why: "EAS project ID required for app.json updates.url (PLAT-03) and dev builds"
    env_vars: []
    dashboard_config:
      - task: "Run `eas init` to create the EAS project and populate extra.eas.projectId"
        location: "expo.dev account (free tier) via eas-cli"

must_haves:
  truths:
    - "Expo SDK 56 project scaffolds in mobile/ with all Phase 1 packages installed via expo install"
    - "app.json carries minSdkVersion 24, iOS deploymentTarget 15.0, EAS Update, and extra.statusCdnUrl"
    - "eas.json has development/preview/production build profiles + an update channel"
    - "Jest test harness runs green (empty/passWithNoTests) with jest-expo preset and MMKV + NetInfo mocked"
    - "`npx tsc --noEmit` exits 0 on the fresh scaffold"
  artifacts:
    - path: "mobile/app.json"
      provides: "Expo config with EAS Update, minSdkVersion=24, iOS deploymentTarget 15.0"
      contains: "deploymentTarget"
    - path: "mobile/eas.json"
      provides: "EAS build + update profiles"
      contains: "development"
    - path: "mobile/jest.config.js"
      provides: "jest-expo test config"
      contains: "jest-expo"
    - path: "mobile/jest.setup.js"
      provides: "MMKV + NetInfo jest mocks"
      contains: "react-native-mmkv"
    - path: "mobile/tsconfig.json"
      provides: "strict mode + @/* path alias"
      contains: "strict"
  key_links:
    - from: "mobile/jest.config.js"
      to: "mobile/jest.setup.js"
      via: "setupFiles entry"
      pattern: "jest.setup"
    - from: "mobile/jest.setup.js"
      to: "react-native-mmkv"
      via: "jest.mock in-memory store"
      pattern: "jest\\.mock"
---

<objective>
Scaffold the `mobile/` Expo SDK 56 project and stand up the build/config + test harness layer only: project config (app.json/eas.json/tsconfig/babel) plus the jest-expo harness (jest.config.js + jest.setup.js with MMKV/NetInfo mocks). This is Wave 1 — the foundation everything else builds on. The core `lib/` modules and their tests are split out into Plan 01-01b (Wave 2).

Purpose: Establish a buildable, type-checking Expo project and a green test harness before any application code exists, so Plan 01-01b can author lib modules against a working sampling baseline.
Output: A scaffolded Expo SDK 56 project in mobile/ with all Phase 1 packages installed, PLAT-01/02/03 config, EAS profiles, and a jest-expo harness that runs green.
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
@.planning/phases/01-foundation-offline-core/01-VALIDATION.md
@app/tsconfig.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Scaffold Expo SDK 56 project + config files + EAS init</name>
  <files>mobile/package.json, mobile/app.json, mobile/eas.json, mobile/tsconfig.json, mobile/babel.config.js</files>
  <read_first>
    - .planning/phases/01-foundation-offline-core/01-RESEARCH.md (Standard Stack install command, Code Examples for app.json + eas.json)
    - .planning/phases/01-foundation-offline-core/01-PATTERNS.md (Config files section: tsconfig, babel)
    - app/tsconfig.json (strict mode reference)
  </read_first>
  <action>
    Scaffold in the `mobile/` directory with `npx create-expo-app@latest mobile --template default@sdk-56`, then install Phase 1 packages with `npx expo install` (NOT npm install) for: expo-router, react-native-mmkv, react-native-nitro-modules, @tanstack/react-query, @tanstack/react-query-persist-client, @tanstack/query-sync-storage-persister, @react-native-community/netinfo, expo-localization, expo-constants, expo-updates, expo-splash-screen, expo-linking, expo-status-bar, react-native-safe-area-context, react-native-screens, expo-system-ui, expo-build-properties. Set package.json "main" to "expo-router/entry". Configure app.json per RESEARCH.md Code Examples: name "Cocuyo", slug "cocuyo", scheme "cocuyo", android.package "app.cocuyo.mobile" with minSdkVersion 24, ios.bundleIdentifier "app.cocuyo.mobile" with deploymentTarget "15.0" via the expo-build-properties plugin (Q1 RESOLVED — 15.0 via expo-build-properties; if expo-doctor flags it in Plan 01-05, fall back to 16.4), runtimeVersion policy "appVersion", updates.url and updates.enabled true, and extra.statusCdnUrl set to "https://cdn.cocuyo.app/status.json" (Q3 RESOLVED — app.json extra.statusCdnUrl read via Constants.expoConfig.extra.statusCdnUrl in Plan 01-01b lib/api.ts). Add eas.json verbatim from RESEARCH.md (development/preview/production profiles + update channel). tsconfig.json extends "expo/tsconfig.base" with strict true and paths "@/*": ["./*"]. babel.config.js uses preset babel-preset-expo. Run `eas init` to populate extra.eas.projectId and the updates.url project ID (Q2 RESOLVED — eas init in this task; requires Leo's expo.dev login — surface as checkpoint if auth fails). Do NOT run dev server or any build in this task (CLAUDE.md: never run dev server during a coding session).
  </action>
  <verify>
    <automated>cd mobile && npx tsc --noEmit && grep -q '"main": "expo-router/entry"' package.json && grep -q 'deploymentTarget' app.json && grep -q 'minSdkVersion' app.json</automated>
  </verify>
  <acceptance_criteria>
    - mobile/package.json contains "main": "expo-router/entry"
    - mobile/package.json lists react-native-mmkv, @tanstack/react-query, expo-router, @react-native-community/netinfo in dependencies
    - mobile/app.json contains "deploymentTarget" set to "15.0" and "minSdkVersion" set to 24
    - mobile/app.json contains extra.statusCdnUrl = "https://cdn.cocuyo.app/status.json"
    - mobile/app.json contains runtimeVersion policy "appVersion" and updates.enabled true
    - mobile/eas.json contains development, preview, and production build profiles
    - mobile/tsconfig.json contains "strict": true and path alias "@/*"
    - `cd mobile && npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>Expo SDK 56 project scaffolded in mobile/ with all Phase 1 packages installed, EAS project initialized, and config files matching PLAT-01/02/03 platform requirements.</done>
</task>

<task type="auto">
  <name>Task 2: Test harness — jest config + MMKV/NetInfo mocks</name>
  <files>mobile/jest.config.js, mobile/jest.setup.js</files>
  <read_first>
    - .planning/phases/01-foundation-offline-core/01-VALIDATION.md (Test Infrastructure, Wave 0 Requirements)
    - .planning/phases/01-foundation-offline-core/01-RESEARCH.md (Validation Architecture, MMKV mock note)
    - .planning/phases/01-foundation-offline-core/01-PATTERNS.md (Test files section — MMKV jest mock pattern)
  </read_first>
  <action>
    Create jest.config.js using preset "jest-expo" with setupFiles pointing to jest.setup.js and a transformIgnorePatterns that allows expo/react-native/@tanstack modules to transform. jest.setup.js mocks react-native-mmkv with an in-memory store implementing set/getString/getBoolean/getNumber/delete per PATTERNS.md Test files section, and mocks @react-native-community/netinfo's useNetInfo to return { isConnected: true } by default. This harness has no lib modules to test yet (those land in Plan 01-01b) — verify it boots and runs green with --passWithNoTests so Plan 01-01b inherits a working sampling baseline. Do NOT add watch-mode flags to any command.
  </action>
  <verify>
    <automated>cd mobile && npx jest --passWithNoTests && grep -q "jest-expo" jest.config.js && grep -q "react-native-mmkv" jest.setup.js</automated>
  </verify>
  <acceptance_criteria>
    - mobile/jest.config.js contains "jest-expo" preset and references jest.setup.js in setupFiles
    - mobile/jest.setup.js contains a jest.mock for "react-native-mmkv" with an in-memory store (set/getString/getBoolean/getNumber/delete)
    - mobile/jest.setup.js mocks @react-native-community/netinfo useNetInfo to { isConnected: true }
    - `cd mobile && npx jest --passWithNoTests` exits 0
    - No watch-mode flags present in any test command
  </acceptance_criteria>
  <done>Jest harness boots green with jest-expo, MMKV and NetInfo mocked; Wave 0 test infrastructure (jest.config.js, jest.setup.js) is in place for Plan 01-01b.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| npm registry → build | package installs cross into the build environment |
| EAS init → app.json | EAS project ID written into config |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-01-01 | Information Disclosure | app.json extra / config | mitigate | Only public values in app.json (statusCdnUrl, EAS project ID). No SUPABASE_SERVICE_ROLE_KEY anywhere in mobile/ (ADR-007). Phase 1 calls no Supabase. |
| T-01-SC | Tampering | npm package installs | mitigate | All packages approved in RESEARCH.md Package Legitimacy Audit (official Expo/TanStack/mrousavy/community, no postinstall scripts). No [ASSUMED]/[SUS] packages present. |
</threat_model>

<verification>
- `cd mobile && npx tsc --noEmit` exits 0 (strict mode)
- `cd mobile && npx jest --passWithNoTests` exits 0 (harness boots)
- grep confirms no service_role key string anywhere in mobile/: `grep -rn "SERVICE_ROLE" mobile/ | grep -v node_modules` returns nothing
- app.json platform config present: `grep -q 'deploymentTarget' mobile/app.json && grep -q 'minSdkVersion' mobile/app.json`
</verification>

<success_criteria>
- Expo SDK 56 project scaffolded in mobile/ with PLAT-01/02/03 config (minSdk 24, iOS 15.0, EAS Update)
- eas.json development/preview/production profiles present (foundation for Plan 01-05 builds)
- jest-expo harness green with MMKV + NetInfo mocked (Wave 0 infra established)
- `npx tsc --noEmit` clean on the fresh scaffold
</success_criteria>

<output>
Create `.planning/phases/01-foundation-offline-core/01-01a-SUMMARY.md` when done
</output>
</content>
</invoke>
