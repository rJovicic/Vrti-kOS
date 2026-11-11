// D1 integration tests against the local stack: OTP sign-in via Mailpit, MFA (AAL2), invite-member and
// accept-invitations Edge Functions, staff assignments through the REST API. Synthetic data only.
import { beforeAll, describe, expect, it } from 'vitest';
import {
  anonClient,
  callFunction,
  claims,
  createKindergarten,
  email,
  enrolMfa,
  latestMail,
  signInWithCode,
  stack,
} from './helpers.ts';

const rest = async (path: string, token: string): Promise<unknown> =>
  (await fetch(`${stack.API_URL}/rest/v1/${path}`, { headers: { apikey: stack.PUBLISHABLE_KEY, authorization: `Bearer ${token}` } })).json();

let alfa: Awaited<ReturnType<typeof createKindergarten>>;
let beta: Awaited<ReturnType<typeof createKindergarten>>;
let managerAal1: string;
let managerAal2: string;
let managerClient: Awaited<ReturnType<typeof signInWithCode>>['client'];
let betaManagerAal2: string;

beforeAll(async () => {
  alfa = await createKindergarten('alfa');
  beta = await createKindergarten('beta');
  const m = await signInWithCode(alfa.managerEmail);
  managerClient = m.client;
  managerAal1 = m.token;
  managerAal2 = await enrolMfa(m.client);
  const b = await signInWithCode(beta.managerEmail);
  betaManagerAal2 = await enrolMfa(b.client);
});

const invite = (org: string, to: string, role = 'educator') => ({ organizationId: org, email: to, role, firstName: 'Ivana', lastName: 'Test' });

describe('e-mail OTP sign-in (SR-AUTHN-01/02)', () => {
  it('a login code works once and cannot be reused', async () => {
    const addr = alfa.educatorEmail;
    const { code } = await signInWithCode(addr);
    const again = await anonClient().auth.verifyOtp({ email: addr, token: code, type: 'email' });
    expect(again.error).not.toBeNull();
  });

  it('the login e-mail contains the code only — no link', async () => {
    const before = Date.now() - 1000;
    await anonClient().auth.signInWithOtp({ email: alfa.educatorEmail, options: { shouldCreateUser: false } });
    const mail = await latestMail(alfa.educatorEmail, 'Kod za prijavu', before);
    expect(mail?.text).toMatch(/\b\d{6}\b/);
    expect(mail?.text).not.toMatch(/https?:\/\//);
  });

  it('a wrong code is rejected', async () => {
    const r = await anonClient().auth.verifyOtp({ email: alfa.educatorEmail, token: '000000', type: 'email' });
    expect(r.error).not.toBeNull();
  });
});

describe('MFA for managers (SR-AUTHN-07)', () => {
  it('session is AAL1 after the e-mail code and AAL2 after TOTP', () => {
    expect(claims(managerAal1).aal).toBe('aal1');
    expect(claims(managerAal2).aal).toBe('aal2');
  });

  it('an AAL1 manager cannot read kindergarten structure', async () => {
    expect(await rest('groups?select=id', managerAal1)).toEqual([]);
  });

  it('an AAL2 manager reads own groups only', async () => {
    const { data } = await managerClient.from('groups').select('id, organization_id');
    expect(data?.length).toBeGreaterThan(0);
    expect(data?.every((g) => g.organization_id === alfa.orgId)).toBe(true);
  });
});

describe('invite-member Edge Function', () => {
  it('rejects requests without a session', async () => {
    expect((await callFunction('invite-member', null, invite(alfa.orgId, email('x')))).status).toBe(401);
  });

  it('rejects an AAL1 manager (MFA enforced by RLS, not by the UI)', async () => {
    const r = await callFunction('invite-member', managerAal1, invite(alfa.orgId, email('aal1')));
    expect(r.status).toBe(403);
  });

  it('rejects unknown fields and invalid input (mass assignment)', async () => {
    const r = await callFunction('invite-member', managerAal2, { ...invite(alfa.orgId, email('bad')), status: 'accepted' });
    expect(r.status).toBe(400);
    expect((await callFunction('invite-member', managerAal2, { ...invite(alfa.orgId, 'not-an-email') })).status).toBe(400);
  });

  it('rejects inviting into another kindergarten (NEG-01)', async () => {
    expect((await callFunction('invite-member', managerAal2, invite(beta.orgId, email('cross')))).status).toBe(403);
  });

  it('rejects an educator (privilege escalation)', async () => {
    const { token } = await signInWithCode(alfa.educatorEmail);
    expect((await callFunction('invite-member', token, invite(alfa.orgId, email('boss'), 'org_admin'))).status).toBe(403);
  });

  it('invites, sends a notice without link/token/child data, and refuses a duplicate', async () => {
    const to = email('nova');
    const before = Date.now() - 1000;
    const r = await callFunction('invite-member', managerAal2, invite(alfa.orgId, to));
    expect(r.status).toBe(201);
    expect(r.json.invitationId).toMatch(/^[0-9a-f-]{36}$/);
    const notice = await latestMail(to, 'pozivnica', before);
    expect(notice?.text).toContain('Upišite ovu e-adresu');
    expect(notice?.text).not.toMatch(/https?:\/\//);
    expect(notice?.text).not.toMatch(/token|verify/i);
    expect((await callFunction('invite-member', managerAal2, invite(alfa.orgId, to))).status).toBe(409);
  });

  it('inviting an address that already has an account looks identical to a new one (no enumeration)', async () => {
    const r = await callFunction('invite-member', managerAal2, invite(alfa.orgId, beta.educatorEmail, 'guardian'));
    expect(r.status).toBe(201);
    expect(Object.keys(r.json).sort()).toEqual(['expiresAt', 'invitationId']);
  });
});

describe('accept-invitations Edge Function', () => {
  it('links the verified user once; the invitation cannot be reused', async () => {
    const to = email('prihvat');
    expect((await callFunction('invite-member', managerAal2, invite(alfa.orgId, to))).status).toBe(201);
    const { client, token } = await signInWithCode(to);
    const first = await callFunction('accept-invitations', token);
    expect(first.status).toBe(200);
    expect(first.json.accepted).toEqual([{ organizationId: alfa.orgId, role: 'educator' }]);
    const second = await callFunction('accept-invitations', token);
    expect(second.json.accepted).toEqual([]);
    const { data: own } = await client.from('memberships').select('organization_id, role, status');
    expect(own).toEqual([{ organization_id: alfa.orgId, role: 'educator', status: 'active' }]);
    const { data: groups } = await client.from('groups').select('id');
    expect(groups).toEqual([]); // no assignment yet → no group (deny by default)
  });

  it('a revoked invitation cannot be accepted', async () => {
    const to = email('opozvana');
    const r = await callFunction('invite-member', managerAal2, invite(alfa.orgId, to, 'guardian'));
    const { data: upd } = await managerClient.from('invitations').update({ status: 'revoked' }).eq('id', r.json.invitationId).select('status');
    expect(upd).toEqual([{ status: 'revoked' }]);
    const { token } = await signInWithCode(to);
    expect((await callFunction('accept-invitations', token)).json.accepted).toEqual([]);
  });

  it('a Beta manager cannot see or revoke Alfa invitations', async () => {
    expect(await rest(`invitations?organization_id=eq.${alfa.orgId}&select=id`, betaManagerAal2)).toEqual([]);
  });

  it('rejects a forged token', async () => {
    const forged = `${managerAal2.split('.').slice(0, 2).join('.')}.invalidsignature`;
    expect((await callFunction('accept-invitations', forged)).status).toBe(401);
  });
});

describe('staff assignments through the API', () => {
  it('manager assigns an educator; the educator then sees exactly that group', async () => {
    const { error } = await managerClient
      .from('staff_assignments')
      .insert({ organization_id: alfa.orgId, membership_id: alfa.educatorMembershipId, group_id: alfa.groupId, valid_during: '[2026-01-01,)' });
    expect(error).toBeNull();
    const { client } = await signInWithCode(alfa.educatorEmail);
    const { data } = await client.from('groups').select('id');
    expect(data).toEqual([{ id: alfa.groupId }]);
  });

  it('a Beta educator never sees Alfa groups', async () => {
    const { client } = await signInWithCode(beta.educatorEmail);
    const { data } = await client.from('groups').select('id').eq('id', alfa.groupId);
    expect(data).toEqual([]);
  });
});
