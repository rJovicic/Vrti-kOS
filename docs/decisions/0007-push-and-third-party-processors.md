# ADR-0007: Push notifications, transactional email and error monitoring

- Status: **Push: Accepted (owner, D-40, 2026-11-16) — option A, implemented but NOT activated.** Email and error
  monitoring: still Proposed — **require owner approval** (subprocessors, possible paid services)
- Date: 2026-11-10
- Related: R-07 (push leakage), R-08 (PII in logs), R-03

## Context
Each third-party service that receives personal data is a subprocessor that the kindergarten (controller)
must authorize (GDPR Art. 28(2)) and that we must list and assess.

## Push notifications
| Option | Notes |
|---|---|
| **A. Expo Push Service** | Simplest with Expo; tokens and payloads pass through Expo (US) before APNs/FCM |
| B. Direct APNs + FCM from Edge Functions | One less intermediary; more code (token mgmt, retries) |

APNs (Apple) and FCM (Google) are unavoidable for push on iOS/Android.
**Recommended: A, with content-free payloads** — titles like "Nova obavijest" / "Nova poruka", no child names,
no message text; the app fetches content after authentication. This keeps personal data out of all push
intermediaries, which makes the provider choice low-risk. Revisit B if the DPO objects to device tokens via Expo.

### Decision on push (D-40, owner, 2026-11-16)
Option A (Expo Push Service → APNs/FCM) with these conditions, all implemented:
- **Generic payloads only:** title "VrtićOS" and one text per type, no child/group/sender names, no content; the app
  loads the content after sign-in under RLS (`packages/i18n/src/push.ts`; ST-PUSH-01 in unit and integration tests).
- **Device token = personal data:** `public.push_tokens` holds only token, platform and times; clients never read it;
  registration and removal only for the own account; it moves when another account signs in on the device; removed on
  sign-out (AC-08-3), on "DeviceNotRegistered", and after 60 days unused (`private.prune_push_tokens`, to be scheduled).
- **Delivery architecture:** outbox = `notifications.push_status`; worker = Edge Function `push-dispatch`, callable only
  with the service key (the database refuses others); pure core `packages/domain/src/push-dispatch.ts` with a
  **DeliveryPolicy** seam for Q-T05 (quiet period) — the only policy is `unset` (not confirmed) — and adapters
  `disabled` (default), `mock` (local/tests), `expo` (real).
- **Not active:** no account, no credentials, no real devices, no real sending. The `expo` adapter cannot be created
  unless `PUSH_ACTIVATION_APPROVED=yes` (owner) **and** a confirmed policy exists (Q-T05). The mobile app registers no
  device: its token provider is empty until activation.
- Activation checklist (DPA, transfer, terms, retention at Expo, access token, Q-T05, DPIA, privacy notices):
  [docs/privacy/subprocessor-register.md](../privacy/subprocessor-register.md) §2.

## Transactional email (invitations, magic links)
Candidates: EU-based providers (e.g. Brevo — FR, Mailjet — FR, Scaleway TEM — FR) vs US (Postmark, Resend, SES-EU).
**Recommended: an EU-headquartered provider**; final pick in Phase 3 after DPA review. Supabase's built-in
SMTP is rate-limited and not for production.

## Error monitoring
| Option | Notes |
|---|---|
| **A. Sentry SaaS, EU data region** | Best RN/Next.js support; US company → subprocessor; must configure `sendDefaultPii: false`, `beforeSend` scrubbing, no session replay, no screenshots |
| B. Self-hosted GlitchTip/Sentry in EU | Residency control; ops burden |
| C. None in MVP | Not acceptable for production quality |

**Recommended: A with strict scrubbing**, verified by a test that asserts no child names/emails/IDs leave the device.

## Analytics
**No product analytics in MVP.** If later needed: self-hosted/EU privacy-first tool, aggregated, no child-related events.

## Cost (approximate)
Expo push: free. Email: free tiers likely sufficient for pilot. Sentry Team ~USD 26/month (free dev tier exists).
