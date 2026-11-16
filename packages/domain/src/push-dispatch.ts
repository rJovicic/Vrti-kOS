// D-40 push delivery core (ADR-0007 option A, Expo Push → APNs/FCM). UI-free and runtime-agnostic: the Edge Function
// push-dispatch supplies the database calls and the adapter. Nothing here knows content: a job carries only ids, the
// notification type and the recipient's device tokens; the payload builder receives only the type and the opaque id.
//
// Three seams keep later decisions cheap:
//   * DeliveryPolicy — decides send / defer per job. Q-T05 (quiet period for staff) is OPEN: the only policy here is
//     `unsetPolicy` (send now) and it is explicitly marked unconfirmed. A confirmed quiet period becomes another policy;
//     the dispatcher, the database and the adapters stay as they are.
//   * PushAdapter — `disabled` (default), `mock` (synthetic, nothing leaves the process), `expo` (real). The real adapter
//     can only be created when the owner has approved activation AND a confirmed policy is in place (assertRealAllowed).
//   * PayloadBuilder — generic text per type (packages/i18n pushPayload, SR-PUSH-01).

export type PushType = 'announcement.published' | 'absence.reported' | 'message.received' | 'daily_entry.published';

export interface PushJob {
  notificationId: string;
  organizationId: string;
  type: PushType;
  attempts: number;
  tokens: string[];
}

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data: { notificationId: string };
}

export type TokenResult = { token: string; ok: true } | { token: string; ok: false; reason: 'device_not_registered' | 'error' };

export interface PushAdapter {
  readonly name: 'disabled' | 'mock' | 'expo';
  readonly real: boolean;
  send(messages: PushMessage[]): Promise<TokenResult[]>;
}

export type PolicyDecision = { action: 'send' } | { action: 'defer'; until: Date };
export interface DeliveryPolicy {
  readonly id: string;
  /** True only for a rule the owner has confirmed (Q-T05). The real adapter refuses to run without one. */
  readonly confirmed: boolean;
  decide(job: PushJob, now: Date): PolicyDecision;
}

/** Q-T05 is open: no quiet period is applied, and this policy is deliberately NOT confirmed. */
export const unsetPolicy: DeliveryPolicy = { id: 'unset', confirmed: false, decide: () => ({ action: 'send' }) };

export type JobOutcome = { id: string; outcome: 'sent' } | { id: string; outcome: 'deferred'; retry_at: string } | { id: string; outcome: 'error' };

export interface DispatchReport {
  results: JobOutcome[];
  invalidTokens: string[];
  /** What was handed to the adapter (for tests and the mock adapter's response). */
  messages: PushMessage[];
}

export type PayloadBuilder = (type: PushType, notificationId: string) => { title: string; body: string; data: { notificationId: string } };

/**
 * One batch: policy per job, one generic message per token, outcome per notification. A notification counts as sent
 * when at least one of its tokens accepted it; tokens the provider reports as no longer registered are returned for
 * deletion (SR-PUSH-03).
 */
export async function dispatchBatch(jobs: PushJob[], deps: { adapter: PushAdapter; policy: DeliveryPolicy; payload: PayloadBuilder; now: Date }): Promise<DispatchReport> {
  const results: JobOutcome[] = [];
  const toSend: { job: PushJob; messages: PushMessage[] }[] = [];
  for (const job of jobs) {
    const decision = deps.policy.decide(job, deps.now);
    if (decision.action === 'defer') {
      results.push({ id: job.notificationId, outcome: 'deferred', retry_at: decision.until.toISOString() });
      continue;
    }
    const p = deps.payload(job.type, job.notificationId);
    toSend.push({ job, messages: job.tokens.map((to) => ({ to, title: p.title, body: p.body, data: p.data })) });
  }
  const messages = toSend.flatMap((x) => x.messages);
  const tokenResults = messages.length ? await deps.adapter.send(messages) : [];
  const byToken = new Map(tokenResults.map((r) => [r.token, r]));
  const invalidTokens = tokenResults.filter((r) => !r.ok && r.reason === 'device_not_registered').map((r) => r.token);
  for (const { job, messages: mine } of toSend) {
    const ok = mine.some((m) => byToken.get(m.to)?.ok === true);
    results.push(ok ? { id: job.notificationId, outcome: 'sent' } : { id: job.notificationId, outcome: 'error' });
  }
  return { results, invalidTokens, messages };
}

// Adapters ------------------------------------------------------------------------------------------------------------

export const disabledAdapter: PushAdapter = {
  name: 'disabled',
  real: false,
  send: () => Promise.reject(new Error('PUSH_DISABLED')),
};

/**
 * Mock adapter for local development and tests: accepts synthetic tokens, sends nothing anywhere. A token whose id
 * starts with `unregistered` is answered like Expo's DeviceNotRegistered, one starting with `failing` with an error.
 */
export function mockAdapter(): PushAdapter {
  return {
    name: 'mock',
    real: false,
    send: async (messages) =>
      messages.map((m) =>
        /\[unregistered/.test(m.to) ? { token: m.to, ok: false, reason: 'device_not_registered' } : /\[failing/.test(m.to) ? { token: m.to, ok: false, reason: 'error' } : { token: m.to, ok: true },
      ),
  };
}

export interface ActivationState {
  /** The owner approved real delivery (account, credentials, activation) — D-40 says: not yet. */
  ownerApprovedActivation: boolean;
  policy: DeliveryPolicy;
}

/** Throws unless real delivery is allowed: owner activation AND a confirmed delivery policy (Q-T05). */
export function assertRealAllowed(state: ActivationState): void {
  if (!state.ownerApprovedActivation) throw new Error('PUSH_REAL_DELIVERY_NOT_APPROVED');
  if (!state.policy.confirmed) throw new Error('PUSH_DELIVERY_POLICY_NOT_CONFIRMED');
}

/**
 * Expo Push adapter (https://exp.host/--/api/v2/push/send). Created only through `assertRealAllowed`. The access token
 * comes from the runtime's secret store at activation; it is never in the repository.
 */
export function expoAdapter(state: ActivationState, accessToken: string, fetcher: typeof fetch = fetch): PushAdapter {
  assertRealAllowed(state);
  if (!accessToken) throw new Error('PUSH_ACCESS_TOKEN_MISSING');
  return {
    name: 'expo',
    real: true,
    async send(messages) {
      const out: TokenResult[] = [];
      for (let i = 0; i < messages.length; i += 100) {
        const chunk = messages.slice(i, i + 100);
        const res = await fetcher('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify(chunk.map((m) => ({ to: m.to, title: m.title, body: m.body, data: m.data, sound: 'default' }))),
        });
        if (!res.ok) {
          out.push(...chunk.map((m) => ({ token: m.to, ok: false as const, reason: 'error' as const })));
          continue;
        }
        const tickets = ((await res.json()) as { data?: { status: string; details?: { error?: string } }[] }).data ?? [];
        chunk.forEach((m, k) => {
          const t = tickets[k];
          if (t?.status === 'ok') out.push({ token: m.to, ok: true });
          else out.push({ token: m.to, ok: false, reason: t?.details?.error === 'DeviceNotRegistered' ? 'device_not_registered' : 'error' });
        });
      }
      return out;
    },
  };
}

/** Adapter from configuration. Unknown values and `expo` without approval fall back to an error, never to sending. */
export function selectAdapter(name: string | undefined, state: ActivationState, accessToken = ''): PushAdapter {
  switch (name ?? 'disabled') {
    case 'disabled':
      return disabledAdapter;
    case 'mock':
      return mockAdapter();
    case 'expo':
      return expoAdapter(state, accessToken);
    default:
      throw new Error('PUSH_ADAPTER_UNKNOWN');
  }
}
