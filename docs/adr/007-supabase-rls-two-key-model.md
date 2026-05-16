# ADR-007: Supabase RLS two-key model with server-side ip_hash

## Status: Accepted

## Decision
Supabase access uses two keys with strict role separation:

**anon key (frontend):** INSERT only on outage_reports. No SELECT,
UPDATE, or DELETE. INSERT restricted to user-facing columns:
region, state, sub_zone, lat, lon, status, onset_type, symptom,
device_fingerprint.

**service_role key (pipeline):** Full SELECT on outage_reports and
outage_history. Used only in server-side pipeline scripts. Never
present in frontend code or client-side bundles.

**ip_hash:** Computed by a Supabase database function triggered on
INSERT. The function extracts the client IP from request headers
(via `inet_client_addr()` or Supabase's request headers) and hashes
it. The client never sends ip_hash — the column is not writable by
the anon role.

**Server-side only columns:** ip_hash, confirmed_by_passive, id,
created_at. All set by the database, not by the client.

## Rationale
The spec's original design has the frontend POSTing directly to
Supabase REST API with the anon key. This is standard Supabase
architecture, but without RLS policies:

- Anyone with the anon key (visible in frontend JS) can SELECT all
  rows including ip_hash and device_fingerprint
- Anyone can UPDATE or DELETE existing reports
- Anyone can INSERT arbitrary data bypassing frontend validation
  entirely — validation.py runs server-side in the pipeline, not
  at insert time
- If ip_hash is client-provided, attackers control their own
  rate-limiting identity

The validation pipeline (validation.py) catches garbage reports
eventually, but the damage is already in the database. RLS prevents
the most egregious attacks at the database boundary.

## Consequences
- T-001 (Supabase schema) must include RLS policies and DB function
- Frontend submitReport() drops ip_hash from the POST body entirely
- Pipeline scripts use SUPABASE_SERVICE_ROLE_KEY env var for reads
- .env.example documents both keys with clear labels
- ip_hash accuracy depends on Supabase's ability to surface client
  IP in DB functions — verify this works behind Cloudflare proxy
- CLAUDE.md Never Do list prohibits service_role key in frontend

## Rejected Alternatives
- No RLS (original spec design): data exfiltration and manipulation
  trivially possible by anyone who reads the frontend JS
- Cloudflare Worker as write proxy: adds infrastructure, delays
  Phase 1, achieves same result as RLS + DB function
- Client-computed ip_hash: attacker controls their own identity,
  defeats rate limiting entirely
