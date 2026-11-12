// POST /functions/v1/invite-member — a kindergarten manager (AAL2) invites a person (FS-01, FR-01-1/2).
// Authorization is decided by Postgres: the invitation row is inserted AS THE CALLER, so RLS requires an
// active org_admin/director membership in that kindergarten and an MFA (aal2) session (SR-EF-01, ADR-0014).
// The service client is used only afterwards, for the Auth admin API. The notice contains no link, no token
// and no child data (SR-AUTHN-01, SR-AUTHN-04); sign-in happens with a 6-digit code requested in the app.
import { type ErrorCode, fromInvitationInsertError } from '../../../packages/validation/src/errors.ts';
import { zInviteMemberInput } from '../../../packages/validation/src/invitation.ts';
import { serviceClient, userClient } from '../_shared/clients.ts';
import { sendMail } from '../_shared/email.ts';
import { bearer, correlationIdOf, corsHeaders, error, json, log } from '../_shared/http.ts';

const FN = 'invite-member';

Deno.serve(async (req) => {
  const correlationId = correlationIdOf(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== 'POST') return error(req, 'METHOD_NOT_ALLOWED', correlationId);

  const jwt = bearer(req);
  if (!jwt) return error(req, 'AUTH_REQUIRED', correlationId);
  const { data: caller, error: authErr } = await serviceClient({ correlationId }).auth.getUser(jwt);
  if (authErr || !caller.user) return error(req, 'AUTH_REQUIRED', correlationId);
  // From here on every service-key write is attributed to the caller in the audit log (R-51).
  const admin = serviceClient({ correlationId, actorId: caller.user.id });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return error(req, 'VALIDATION_FAILED', correlationId);
  }
  const parsed = zInviteMemberInput.safeParse(body);
  if (!parsed.success) return error(req, 'VALIDATION_FAILED', correlationId);
  const input = parsed.data;

  // Denied or failed privileged attempts are audited (SR-AUD-01, ST-AUD-02); a failure to audit never changes the answer.
  const audit = async (outcome: 'denied' | 'error', reason: ErrorCode) => {
    const { error: auditErr } = await admin.schema('api').rpc('record_audit_event', {
      p_organization_id: input.organizationId,
      p_actor_id: caller.user.id,
      p_action: 'invitation.create',
      p_target_table: 'invitations',
      p_outcome: outcome,
      p_reason: reason,
    });
    if (auditErr) log(FN, correlationId, 'error', { stage: 'audit', reason: auditErr.code });
  };

  const asCaller = userClient(jwt, correlationId);
  // No .single(): when the limit is reached the guard skips the row and the transaction must still commit, so the
  // refusal stays in the audit log (R-50). A single-object request would make PostgREST roll it back.
  const { data: rows, error: insertErr } = await asCaller
    .from('invitations')
    .insert({
      organization_id: input.organizationId,
      email: input.email,
      role: input.role,
      first_name: input.firstName,
      last_name: input.lastName,
    })
    .select('id, expires_at, organization:organizations(name)');
  const invitation = rows?.[0];
  if (insertErr || !invitation) {
    const code = fromInvitationInsertError(insertErr);
    log(FN, correlationId, 'denied', { reason: code });
    // The limit refusal is audited by the database in its own transaction (R-50); a duplicate is not a security event.
    if (code === 'PERMISSION_DENIED' || code === 'MEMBERSHIP_SUSPENDED') await audit('denied', code);
    return error(req, code, correlationId);
  }

  // Compensation: an invitation whose account or notice could not be prepared must not stay open.
  const revoke = async () => {
    await admin.from('invitations').update({ status: 'revoked', revoked_at: new Date().toISOString() }).eq('id', invitation.id);
  };

  const created = await admin.auth.admin.createUser({ email: input.email, email_confirm: true });
  if (created.error && created.error.code !== 'email_exists') {
    await revoke();
    log(FN, correlationId, 'error', { stage: 'create_user', reason: created.error.code });
    await audit('error', 'INTERNAL');
    return error(req, 'INTERNAL', correlationId);
  }

  const orgName = (invitation.organization as { name?: string } | null)?.name ?? 'Vaš vrtić';
  const roleLabel: Record<string, string> = {
    org_admin: 'administrator vrtića',
    director: 'ravnatelj/ravnateljica',
    educator: 'odgojitelj/odgojiteljica',
    guardian: 'roditelj/skrbnik',
  };
  try {
    await sendMail({
      to: input.email,
      subject: `${orgName}: pozivnica u VrtićOS`,
      text: [
        `Dobar dan, ${input.firstName},`,
        '',
        `${orgName} poziva vas u VrtićOS (uloga: ${roleLabel[input.role]}).`,
        '',
        'Kako se prijaviti:',
        '1. Otvorite aplikaciju VrtićOS.',
        '2. Upišite ovu e-adresu i zatražite kod za prijavu.',
        '3. Upišite kod koji ćete dobiti zasebnom porukom.',
        '',
        `Pozivnica vrijedi do ${new Date(invitation.expires_at).toLocaleDateString('hr-HR', { timeZone: 'Europe/Zagreb' })}.`,
        'Ako ne očekujete ovu pozivnicu, zanemarite poruku ili se obratite vrtiću.',
      ].join('\n'),
    });
  } catch (e) {
    await revoke();
    log(FN, correlationId, 'error', { stage: 'send_mail', reason: (e as Error).name });
    await audit('error', 'INTERNAL');
    return error(req, 'INTERNAL', correlationId);
  }

  log(FN, correlationId, 'success', { invitationId: invitation.id });
  return json(req, 201, { invitationId: invitation.id, expiresAt: invitation.expires_at });
});
