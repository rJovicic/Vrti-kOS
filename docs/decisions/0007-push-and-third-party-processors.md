# ADR-0007: Push notifications, transactional email and error monitoring

- Status: Proposed — **requires owner approval** (subprocessors, possible paid services)
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
