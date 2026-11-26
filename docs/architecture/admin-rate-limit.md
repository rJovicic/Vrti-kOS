# Admin sign-in rate limit (PP-S2)

Status: implemented 2026-11-26 (owner decision: PP-S2 option (b), [pre-pilot-decisions.md §2.3](../security/pre-pilot-decisions.md)).
Code: `apps/admin/src/lib/rate-limit.ts`, `apps/admin/src/lib/sign-in-guard.ts`; used by
`app/sign-in/actions.ts` (send code, verify code) and `app/mfa/actions.ts` (TOTP check).

## Problem
The admin app keeps the Supabase session in httpOnly cookies (SR-WEB-03), so every sign-in step calls Supabase Auth
**from the admin server**. Auth rate-limits per IP and therefore saw one client — the Railway server — for every
manager: one person could exhaust Auth's limit (30 per 5 minutes) and block sign-in for all kindergartens.
Supabase's remedy (`Sb-Forwarded-For`) needs a secret API key on the admin server, which the architecture forbids
(SR-SUP-04); the owner chose an admin-side limit instead.

## Design
Each step is counted in the admin server **before** Auth is called. Four fixed-window rules per step; a request is
allowed only if every rule allows it, and only allowed requests are counted.

| Step | Client address | E-mail address* | Address + e-mail | All traffic |
|---|---|---|---|---|
| send code | 10 / 15 min | 5 / 15 min | 3 / 15 min | 20 / 5 min |
| verify code | 20 / 15 min | 10 / 15 min | 8 / 15 min | 25 / 5 min |
| TOTP check | 20 / 15 min | 10 / 15 min (*account id) | 8 / 15 min | 25 / 5 min |

- **Global limits are below Auth's per-IP limits** (30 / 5 min for sign-in and for verification), so Auth's shared
  bucket is never reached through the admin server.
- **Client address:** `X-Real-IP`, only when running on Railway (`RAILWAY_ENVIRONMENT_ID` and `RAILWAY_SERVICE_ID`
  present), because Railway's edge sets it to the connecting client. `X-Forwarded-For` is never read. Off Railway
  (local, CI) the address is `unknown`: everyone shares one bucket — stricter, never spoofable. Malformed values →
  `unknown`. IPv6 is grouped by /64; IPv4-mapped IPv6 counts as IPv4.
- **Enumeration:** the guard never consults Auth or the database, so known and unknown addresses are counted
  identically. In addition, Auth's own refusal of a second code within a minute (it happens only for existing
  addresses, R-42) is no longer shown: both continue to the code step.
- **Response:** generic "Previše pokušaja. Pokušajte ponovno za N min." (`?e=RATE_LIMITED&retry=N`); the page carries
  `Retry-After: N·60`. Server Actions cannot return an HTTP 429 to the form, so the wait travels with the redirect.
- **Privacy:** addresses and e-mails are stored only as HMAC-SHA-256 values with a random per-process key; refusals
  are logged as `{event, step, rule, retryAfterSec}` — no address, e-mail or code.
- **Fail closed:** if counting throws, the step is refused for 60 s. If more than 100 000 counters are live after
  sweeping expired ones, new subjects are refused until windows expire (memory bound).
- **Atomicity:** check and increment run synchronously in one call, so concurrent requests in the process cannot
  exceed a limit (unit test with 200 concurrent requests).

## Limitations (documented, not hidden)
- **Not a distributed rate limiter.** Counters live in one Node.js process: they **reset on every restart or deploy**
  and are **not shared between instances**. The staging admin service runs exactly one Railway replica
  (`multiRegionConfig: 1`, checked 2026-11-26); running more replicas requires a shared store first (owner decision —
  no Redis or other paid service without approval).
- A distributed attack (many addresses) can still use up the global allowance and delay sign-in for everyone for up
  to 5 minutes — but no longer exhaust Auth itself. Only per-client limits at Auth (`Sb-Forwarded-For`) would remove
  this (R-63 stays open).
- Targeted lock-out of one manager's e-mail address (5 code requests per 15 min from anywhere) is possible; it lasts at
  most 15 minutes and only blocks requesting new codes.
- Other server-side Auth calls (session refresh in the proxy, 150 / 5 min per IP at Auth) are not counted here; at
  pilot scale they stay far below the limit.
- The trust in `X-Real-IP` relies on Railway's edge overwriting it. Checked on staging (below); re-check after any
  change of hosting, custom domain or CDN in front of Railway (a CDN would make `X-Real-IP` its own address).

## Staging verification (2026-11-26, deployment `4749331` + temporary diagnostic `5337145`, removed afterwards)
- A temporary log line recorded only the **shape** of the headers (address family, or "probe" for the documentation
  range 198.51.100.0/24 used by the test), never an address. For requests sent with forged `X-Real-IP` and
  `X-Forwarded-For` values from 198.51.100.0/24 the app received `X-Real-IP` = a real IPv4 address, equal to the first
  of two `X-Forwarded-For` entries; the forged values never arrived. → Railway's edge overwrites both headers.
- Six code requests for one non-existent synthetic address: requests 1–5 continued to the code step, the 6th was
  refused by the e-mail rule with "15 min"; the page carried `Retry-After: 900`.
- Four requests from the test machine for one address were all allowed, also **without** forged headers: the test
  machine's outgoing address changes per connection (sandbox egress), so each request was a different client — not a
  bypass. The per-address rules could therefore not be exercised from a single machine on staging; they are covered
  by unit tests.

## Tests
`apps/admin/src/lib/sign-in-guard.test.ts` (18): limits per rule, refused requests not counted, 200 concurrent
requests, window expiry and retry time, capacity, missing subject, forged `X-Forwarded-For`/`X-Real-IP`, IPv6
grouping, store failure (fail closed), no personal data in logs or counters, identical treatment of known and unknown
addresses. Admin e2e: real server, same sequence for an existing and a non-existing address, forged headers
ignored, message and `Retry-After`.
