# ADR-001: Static JSON + CDN for all read traffic

## Status: Accepted

## Decision
Frontend reads one file (status.json) from Cloudflare R2 CDN.
No server handles user read requests.

## Rationale
Venezuela has ~28M people, 60-70% internet penetration. Read traffic
at scale would cost hundreds/month with a backend. CDN edge cache
costs $0 regardless of scale. Writes (crowd reports) are 0.1% of
traffic and go directly to Supabase.

## Consequences
- status.json must contain all data the frontend needs
- Pipeline must write complete valid JSON on every run
- Frontend polls every 5 minutes — no real-time push
- Schema changes require coordinated frontend + pipeline deploy

## Rejected Alternatives
- WebSocket server: cost, complexity, failure surface
- Server-side rendering: cost, doesn't work offline