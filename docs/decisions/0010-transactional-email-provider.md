# ADR-0010: Transactional email provider

- Status: Proposed — **requires owner approval for staging/production** (processor, possibly paid)
- Date: 2026-11-10
- Related: ADR-0007, ADR-0008, SR-AUTHN-04, SR-OPS-06, SR-VEN-01, R-03

## Context
Invitations and OTP codes are delivered by email; email is the parents' only authentication factor (R-06). Supabase's
built-in mailer is rate-limited and not meant for production.

## Options considered
| Option | Notes |
|---|---|
| Local: **Mailpit** (bundled with Supabase CLI) | Catches all mail locally; zero cost; demo and CI only |
| EU-headquartered SMTP/API: Brevo (FR), Mailjet (FR), Scaleway Transactional Email (FR) | EU entity; DPA available — **verify current terms, data location and sub-processors** |
| US providers with EU region: Postmark, Resend, Amazon SES (eu-central-1) | Strong deliverability; US-parented → transfer assessment |

## Decision (proposed)
- Local/demo/CI: Mailpit (no external delivery).
- Staging/production: an **EU-headquartered** provider, final pick after DPA review and deliverability test, with a
  dedicated sending subdomain, SPF/DKIM/DMARC (SR-OPS-06), templates free of child data (SR-AUTHN-04), and Supabase
  Auth configured via SMTP. Owner approval required.

## Consequences
Provider swap for **Auth e-mails** (sign-in codes) is configuration only (SMTP), so that part can be decided late.

## Implementation note (D1, 2026-11-11) — correction
Not every e-mail goes through Auth SMTP. The invitation notice is sent by the `invite-member` Edge Function through
`supabase/functions/_shared/email.ts`, which today supports **only** Mailpit's HTTP API (`EMAIL_TRANSPORT=mailpit`) and
fails closed for any other value (ADR-0017). Choosing a production provider therefore also needs a small code change
(a second transport in `email.ts`, its secret handled as an Edge Function secret) — not configuration alone. The decision
itself (EU-headquartered provider, owner approval) is unchanged.

## Cost (approximate, verify)
Free tiers typically cover pilot volume (thousands of emails/month).
