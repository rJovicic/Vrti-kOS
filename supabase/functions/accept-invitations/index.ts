// POST /functions/v1/accept-invitations — links the signed-in user to every pending, unexpired invitation
// addressed to their VERIFIED e-mail (FS-01, FR-01-4). Identity comes from Auth for this exact JWT, never
// from user_metadata or the request body (SR-AUTHZ-08). The SQL function is single-use and transactional.
import { serviceClient } from '../_shared/clients.ts';
import { bearer, corsHeaders, error, json, log } from '../_shared/http.ts';

const FN = 'accept-invitations';

Deno.serve(async (req) => {
  const correlationId = req.headers.get('x-correlation-id') ?? crypto.randomUUID();
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== 'POST') return error(req, 405, 'METHOD_NOT_ALLOWED', correlationId);

  const jwt = bearer(req);
  if (!jwt) return error(req, 401, 'AUTH_REQUIRED', correlationId);
  const admin = serviceClient();
  const { data, error: authErr } = await admin.auth.getUser(jwt);
  const user = data?.user;
  if (authErr || !user?.email || !user.email_confirmed_at) return error(req, 401, 'AUTH_REQUIRED', correlationId);

  const { data: rows, error: rpcErr } = await admin
    .schema('api')
    .rpc('accept_invitations', { p_user_id: user.id, p_email: user.email });
  if (rpcErr) {
    log(FN, correlationId, 'error', { reason: rpcErr.code });
    return error(req, rpcErr.code === '42501' ? 403 : 500, rpcErr.code === '42501' ? 'PERMISSION_DENIED' : 'INTERNAL', correlationId);
  }
  const accepted = (rows ?? []) as { organization_id: string; role: string }[];
  log(FN, correlationId, 'success', { accepted: accepted.length });
  return json(req, 200, { accepted: accepted.map((r) => ({ organizationId: r.organization_id, role: r.role })) });
});
