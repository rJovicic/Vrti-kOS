# ADR-0008: Authentication methods and account onboarding

- Status: Proposed
- Date: 2026-11-10
- Related: R-06 (account takeover), R-09 (session theft), Q-T03, Q-P05

## Context
Users: parents of varied digital literacy, educators possibly on shared devices, directors with broad access.
Accounts are created for people **linked to real children**, so onboarding must prove the link.

## Options considered
1. Email + password (+ optional TOTP MFA).
2. **Passwordless email OTP / magic link** — no password reuse; depends on email account security.
3. SMS OTP — familiar, but costly, SIM-swap risk, extra subprocessor (Twilio etc.).
4. Social login (Apple/Google) — convenient; Apple requires "Sign in with Apple" if other social logins are offered.
5. Croatian eID (NIAS / e-Građani) — strongest identity, but integration effort and eligibility unclear for a private processor.

## Decision (recommended)
- **Invitation-only onboarding**: the kindergarten creates a guardian/staff record → invitation to a verified
  email → user sets up the account. No self-registration that links to children.
- Parents: email OTP (6-digit code, works across devices better than magic links in mobile apps) with
  optional password later.
- Staff with org-wide access (director, org_admin): **mandatory TOTP MFA**. Educators: MFA strongly
  recommended; decision depends on device model (Q-T03).
- Platform admins: mandatory MFA (hardware key preferred).
- Sessions: secure storage (Keychain/Keystore via `expo-secure-store`), refresh token rotation, device list
  with remote sign-out, rate limiting and lockout on OTP attempts.
- Evaluate eID (NIAS) as a later option for guardian identity proofing (Q-P05).

## Consequences
+ No password database risk for parents; strong admin protection.
− Email deliverability becomes critical (ADR-0007 email provider).
− Lost email access = support process with identity verification by the kindergarten.
