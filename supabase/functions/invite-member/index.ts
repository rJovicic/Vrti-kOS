// POST /functions/v1/invite-member — a kindergarten manager (AAL2) invites a person (FS-01, FR-01-1/2).
// Authorization is decided by Postgres: the invitation row is inserted AS THE CALLER, so RLS requires an
// active org_admin/director membership in that kindergarten and an MFA (aal2) session (SR-EF-01, ADR-0014).
// The service client is used only afterwards, for the Auth admin API. The notice contains no link, no token
// and no child data (SR-AUTHN-01, SR-AUTHN-04); sign-in happens with a 6-digit code requested in the app.
import { zInviteMemberInput } from '../../../packages/validation/src/invitation.ts';
import { serviceClient, userClient } from '../_shared/clients.ts';
import { sendMail } from '../_shared/email.ts';
import { bearer, corsHeaders, error, json, log } from '../_shared/http.ts';

const FN = 'invite-member';

Deno.serve(async (req) => {
  const correlationId = req.headers.get('x-correlation-id') ?? crypto.randomUUID();
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== 'POST') return error(req, 405, 'METHOD_NOT_ALLOWED', correlationId);

  const jwt = bearer(req);
  if (!jwt) return error(req, 401, 'AUTH_REQUIRED', correlationId);
  const admin = serviceClient();
  const { data: caller, error: authErr } = await admin.auth.getUser(jwt);
  if (authErr || !caller.user) return error(req, 401, 'AUTH_REQUIRED', correlationId);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return error(req, 400, 'VALIDATION_FAILED', correlationId);
  }
  const parsed = zInviteMemberInput.safeParse(body);
  if (!parsed.success) return error(req, 400, 'VALIDATION_FAILED', correlationId);
  const input = parsed.data;

  const asCaller = userClient(jwt);
  const { data: invitation, error: insertErr } = await asCaller
    .from('invitations')
    .insert({
      organization_id: input.organizationId,
      email: input.email,
      role: input.role,
      first_name: input.firstName,
      last_name: input.lastName,
    })
    .select('id, expires_at, organization:organizations(name)')
    .single();
  if (insertErr || !invitation) {
    const code = insertErr?.code === '23505' ? 'INVITATION_PENDING_EXISTS' : 'PERMISSION_DENIED';
    log(FN, correlationId, 'denied', { reason: insertErr?.code });
    return error(req, code === 'INVITATION_PENDING_EXISTS' ? 409 : 403, code, correlationId);
  }

  // Compensation: an invitation whose account or notice could not be prepared must not stay open.
  const revoke = async () => {
    await admin.from('invitations').update({ status: 'revoked', revoked_at: new Date().toISOString() }).eq('id', invitation.id);
  };

  const created = await admin.auth.admin.createUser({ email: input.email, email_confirm: true });
  if (created.error && created.error.code !== 'email_exists') {
    await revoke();
    log(FN, correlationId, 'error', { stage: 'create_user', reason: created.error.code });
    return error(req, 502, 'INTERNAL', correlationId);
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
    log(FN, correlationId, 'error', { stage: 'send_mail', reason: (e as Error).message });
    return error(req, 502, 'INTERNAL', correlationId);
  }

  log(FN, correlationId, 'success', { invitationId: invitation.id });
  return json(req, 201, { invitationId: invitation.id, expiresAt: invitation.expires_at });
});
