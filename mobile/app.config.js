// ── dynamic config ───────────────────────────────────────────────────────
// Injects the Android FCM google-services.json path from an EAS file-type env
// var (GOOGLE_SERVICES_JSON) so the credential file is never committed
// (CLAUDE.md: never write credentials to any file — env vars only). Falls back
// to a local ./google-services.json for local builds / `eas env:pull`.
// All other config stays in app.json — Expo passes it in as `config`.
export default ({ config }) => {
  config.android = {
    ...(config.android ?? {}),
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
  };
  return config;
};
