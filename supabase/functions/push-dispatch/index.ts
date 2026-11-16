// push-dispatch — D-40 delivery worker (ADR-0007 option A). Called by a scheduler with the SERVICE key only; never by a
// client. It claims due notifications (ids, type, the recipient's tokens — never content), applies the delivery policy,
// sends one generic payload per token through the configured adapter and reports the outcome.
//
// Configuration (Edge Function secrets, not the repository):
//   PUSH_ADAPTER                 disabled (default) | mock (local demo and tests: nothing leaves the machine) | expo
//   PUSH_ACTIVATION_APPROVED     must be "yes" for the real adapter — NOT set: the owner has not approved activation
//   EXPO_ACCESS_TOKEN            only at activation
// The delivery policy is `unset` (Q-T05 open). The real adapter refuses to start with an unconfirmed policy, so real
// delivery is impossible in this version regardless of configuration.
import { dispatchBatch, selectAdapter, unsetPolicy, type PushJob, type PushType } from '../../../packages/domain/src/push-dispatch.ts';
import { pushPayload } from '../../../packages/i18n/src/push.ts';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { bearer, correlationIdOf, error, json, log } from '../_shared/http.ts';

const url = Deno.env.get('SUPABASE_URL')!;

/**
 * The worker acts with the CALLER's key: the database decides. api.push_claim / api.push_report are granted to the
 * service role only, so any other key (a user's session, the publishable key) is refused there (42501) — no key
 * comparison in code, and both key formats (legacy JWT, sb_secret_…) work.
 */
function callerClient(key: string, correlationId: string): SupabaseClient {
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { 'x-correlation-id': correlationId } } });
}

Deno.serve(async (req) => {
  const correlationId = correlationIdOf(req);
  if (req.method !== 'POST') return error(req, 'VALIDATION_FAILED', correlationId);
  const key = bearer(req);
  if (!key) {
    log('push-dispatch', correlationId, 'denied');
    return error(req, 'PERMISSION_DENIED', correlationId);
  }
  const state = { ownerApprovedActivation: Deno.env.get('PUSH_ACTIVATION_APPROVED') === 'yes', policy: unsetPolicy };
  let adapter;
  try {
    adapter = selectAdapter(Deno.env.get('PUSH_ADAPTER'), state, Deno.env.get('EXPO_ACCESS_TOKEN') ?? '');
  } catch (e) {
    log('push-dispatch', correlationId, 'adapter_refused', { reason: (e as Error).message });
    return json(req, 409, { error: { code: 'PUSH_NOT_ACTIVE', reason: (e as Error).message, correlationId } });
  }
  if (adapter.name === 'disabled') {
    // Disabled: touches no data and reveals nothing (the database is not called at all).
    log('push-dispatch', correlationId, 'disabled');
    return json(req, 200, { adapter: 'disabled', claimed: 0 });
  }
  const db = callerClient(key, correlationId);

  const { data, error: claimError } = await db.schema('api').rpc('push_claim', { p_limit: 100 });
  if (claimError?.code === '42501' || claimError?.code === 'PGRST301') {
    log('push-dispatch', correlationId, 'denied');
    return error(req, 'PERMISSION_DENIED', correlationId);
  }
  if (claimError) {
    log('push-dispatch', correlationId, 'claim_failed', { code: claimError.code });
    return error(req, 'INTERNAL', correlationId);
  }
  const jobs: PushJob[] = ((data ?? []) as { notification_id: string; organization_id: string; type: PushType; attempts: number; tokens: string[] }[]).map((r) => ({
    notificationId: r.notification_id,
    organizationId: r.organization_id,
    type: r.type,
    attempts: r.attempts,
    tokens: r.tokens,
  }));
  const report = await dispatchBatch(jobs, { adapter, policy: state.policy, payload: pushPayload, now: new Date() });
  const { error: reportError } = await db.schema('api').rpc('push_report', { p_results: report.results, p_invalid_tokens: report.invalidTokens });
  if (reportError) {
    log('push-dispatch', correlationId, 'report_failed', { code: reportError.code });
    return error(req, 'INTERNAL', correlationId);
  }
  const count = (o: string) => report.results.filter((r) => r.outcome === o).length;
  log('push-dispatch', correlationId, 'ok', { adapter: adapter.name, claimed: jobs.length, sent: count('sent'), deferred: count('deferred'), errors: count('error') });
  return json(req, 200, {
    adapter: adapter.name,
    claimed: jobs.length,
    sent: count('sent'),
    deferred: count('deferred'),
    errors: count('error'),
    invalidTokens: report.invalidTokens.length,
    // Mock only: what would have been sent, without the device tokens — lets tests check the payloads (ST-PUSH-01).
    ...(adapter.name === 'mock' ? { payloads: report.messages.map(({ title, body, data: d }) => ({ title, body, data: d })) } : {}),
  });
});
