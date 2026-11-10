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
Provider swap is configuration only (SMTP), so the decision can be made late without code changes.

## Cost (approximate, verify)
Free tiers typically cover pilot volume (thousands of emails/month).
