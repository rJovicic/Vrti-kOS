import { describe, expect, it, vi } from 'vitest';
import {
  assertRealAllowed,
  dispatchBatch,
  expoAdapter,
  mockAdapter,
  selectAdapter,
  unsetPolicy,
  type DeliveryPolicy,
  type PushJob,
} from './push-dispatch.ts';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const tok = (s: string) => `ExponentPushToken[${s}]`;
const job = (n: number, tokens: string[], over: Partial<PushJob> = {}): PushJob => ({ notificationId: id(n), organizationId: id(99), type: 'message.received', attempts: 1, tokens, ...over });
const payload = (type: string, notificationId: string) => ({ title: 'VrtićOS', body: `generic:${type}`, data: { notificationId } });
const now = new Date('2026-11-16T20:00:00Z');

describe('push dispatch (D-40)', () => {
  it('sends one generic message per token; outcome per notification; unregistered tokens are returned for deletion', async () => {
    const report = await dispatchBatch([job(1, [tok('aaaaaaaa'), tok('unregistered1')]), job(2, [tok('failing01')])], {
      adapter: mockAdapter(),
      policy: unsetPolicy,
      payload,
      now,
    });
    expect(report.results).toEqual([
      { id: id(1), outcome: 'sent' },
      { id: id(2), outcome: 'error' },
    ]);
    expect(report.invalidTokens).toEqual([tok('unregistered1')]);
    expect(report.messages).toHaveLength(3);
    expect(Object.keys(report.messages[0]!).sort()).toEqual(['body', 'data', 'title', 'to']);
    expect(report.messages[0]!.data).toEqual({ notificationId: id(1) });
  });

  it('a policy can defer delivery without touching the dispatcher (seam for Q-T05)', async () => {
    const quiet: DeliveryPolicy = { id: 'test-quiet', confirmed: true, decide: () => ({ action: 'defer', until: new Date('2026-11-17T05:30:00Z') }) };
    const send = vi.fn();
    const report = await dispatchBatch([job(3, [tok('aaaaaaaa')])], { adapter: { name: 'mock', real: false, send }, policy: quiet, payload, now });
    expect(report.results).toEqual([{ id: id(3), outcome: 'deferred', retry_at: '2026-11-17T05:30:00.000Z' }]);
    expect(send).not.toHaveBeenCalled();
  });

  it('the policy in force for Q-T05 is "unset" and NOT confirmed', () => {
    expect(unsetPolicy.confirmed).toBe(false);
    expect(unsetPolicy.decide(job(4, []), now)).toEqual({ action: 'send' });
  });

  it('the real Expo adapter cannot be created without owner activation AND a confirmed policy', () => {
    const confirmed: DeliveryPolicy = { ...unsetPolicy, id: 'x', confirmed: true };
    expect(() => assertRealAllowed({ ownerApprovedActivation: false, policy: confirmed })).toThrow('PUSH_REAL_DELIVERY_NOT_APPROVED');
    expect(() => assertRealAllowed({ ownerApprovedActivation: true, policy: unsetPolicy })).toThrow('PUSH_DELIVERY_POLICY_NOT_CONFIRMED');
    expect(() => selectAdapter('expo', { ownerApprovedActivation: false, policy: unsetPolicy }, 'x')).toThrow();
    expect(() => expoAdapter({ ownerApprovedActivation: true, policy: confirmed }, '')).toThrow('PUSH_ACCESS_TOKEN_MISSING');
  });

  it('configuration: default disabled (refuses to send), mock allowed, unknown refused', async () => {
    const state = { ownerApprovedActivation: false, policy: unsetPolicy };
    const disabled = selectAdapter(undefined, state);
    expect(disabled.name).toBe('disabled');
    await expect(disabled.send([])).rejects.toThrow('PUSH_DISABLED');
    expect(selectAdapter('mock', state).real).toBe(false);
    expect(() => selectAdapter('fcm', state)).toThrow('PUSH_ADAPTER_UNKNOWN');
  });

  it('the Expo adapter maps tickets (tested with a fake fetch; never called for real)', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ data: [{ status: 'ok' }, { status: 'error', details: { error: 'DeviceNotRegistered' } }] }), { status: 200 }));
    const adapter = expoAdapter({ ownerApprovedActivation: true, policy: { ...unsetPolicy, id: 'x', confirmed: true } }, 'synthetic-token', fetcher as unknown as typeof fetch);
    const out = await adapter.send([
      { to: tok('aaaaaaaa'), title: 't', body: 'b', data: { notificationId: id(1) } },
      { to: tok('bbbbbbbb'), title: 't', body: 'b', data: { notificationId: id(1) } },
    ]);
    expect(out).toEqual([
      { token: tok('aaaaaaaa'), ok: true },
      { token: tok('bbbbbbbb'), ok: false, reason: 'device_not_registered' },
    ]);
    const body = JSON.parse((fetcher.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(Object.keys(body[0]).sort()).toEqual(['body', 'data', 'sound', 'title', 'to']);
  });
});
