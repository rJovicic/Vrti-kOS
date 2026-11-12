# ADR-0008: Authentication methods and account onboarding

- Status: Proposed — except the **password policy** (amendment below), **accepted by the owner on 2026-11-11** and
  implemented locally
- Date: 2026-11-10 (amended 2026-11-11)
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
- Parents: email OTP (6-digit code, works across devices better than magic links in mobile apps).
  *(The earlier "optional password later" is superseded by the amendment below.)*
- Staff with org-wide access (director, org_admin): **mandatory TOTP MFA**. Educators: MFA strongly
  recommended; decision depends on device model (Q-T03).
- Platform admins: mandatory MFA (hardware key preferred).
- Sessions: secure storage (Keychain/Keystore via `expo-secure-store`), refresh token rotation, device list
  with remote sign-out, rate limiting and lockout on OTP attempts.
- Evaluate eID (NIAS) as a later option for guardian identity proofing (Q-P05).

## Amendment 2026-11-11 — passwords are disabled for every user (owner decision, R-49)
**Accepted policy:**
- Passwords are **forbidden for all users**: guardians, educators, kindergarten managers (`org_admin`, `director`) and
  platform admins.
- Sign-in is the **6-digit e-mail code** only (`shouldCreateUser: false`, invitation-only accounts, ADR-0017).
- Managers and platform admins additionally need **TOTP** for AAL2; the database enforces AAL2 for their data
  (`private.is_org_manager()`, `private.is_platform_admin()`, ADR-0014).
- There is **no password set, change or recovery** in the product: no screen offers it and the backend refuses it.

**Why:** verification on 2026-11-11 (R-49) showed that an ordinary e-mail-code session could set a password through
`PUT /auth/v1/user` without re-authentication and then sign in with it, bypassing the e-mail code. GoTrue v2.197.0 has
no setting or hook that stops a password from being set (`secure_password_change` applies only to sessions older than
24 h); the `password_verification_attempt` hook covers sign-in only and is Teams/Enterprise-only on hosted Supabase.

**Implemented locally** (migration `20261111170000_disable_passwords.sql`, `supabase/config.toml`):
1. trigger `vrticos_reject_password_write` on `auth.users` — every password change is refused; new accounts are stored
   without a password hash (GoTrue's admin API otherwise stores a random one);
2. Auth hook `auth_hooks.custom_access_token` — no access token for a password-based session, at sign-in or refresh;
3. defence in depth in `config.toml`: `secure_password_change = true`, `minimum_password_length = 12`, required
   character classes (on their own these would not block R-49).
Verified locally: pgTAP 124/124, integration 27/27 (twice), admin e2e 8/8. Not yet verified in GitHub CI or on hosted
Supabase; R-49 stays open until CI evidence exists. Details: `docs/architecture/local-development.md` §3b.

**Consequences of the amendment:** the admin API cannot set passwords either, and `inviteUserByEmail` would fail
(not used, ADR-0017). Losing access to the mailbox remains a support case handled by the kindergarten.

## Consequences
+ No password database risk for any user; strong admin protection.
− Email deliverability becomes critical (ADR-0007 email provider).
− Lost email access = support process with identity verification by the kindergarten.
