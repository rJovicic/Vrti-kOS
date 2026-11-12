// R-48 regression tests through the product path (invite-member, accept-invitations, REST as the manager):
// "a suspended person stays suspended after signing in". Migration 20261112075500_suspension_blocks_invitations.sql.
// Local stack, synthetic accounts only.
import { beforeAll, describe, expect, it } from 'vitest';
import { callFunction, createKindergarten, email, enrolMfa, service, signInWithCode } from './helpers.ts';

let alfa: Awaited<ReturnType<typeof createKindergarten>>;
let beta: Awaited<ReturnType<typeof createKindergarten>>;
let manager: Awaited<ReturnType<typeof signInWithCode>>['client'];
let managerAal2: string;
let betaManagerAal2: string;
let person: string;
let membershipId: string;

const invite = (org: string, to: string, role = 'educator') => ({ organizationId: org, email: to, role, firstName: 'Suzana', lastName: 'Test' });
const invitationStatus = async (id: string) =>
  (await manager.from('invitations').select('status').eq('id', id).single()).data?.status as string | undefined;
const ownMemberships = async () => {
  const { client, token } = await signInWithCode(person);
  const accepted = await callFunction('accept-invitations', token);
  const { data } = await client.from('memberships').select('id, organization_id, role, status');
  const { data: groups } = await client.from('groups').select('id');
  return { accepted, memberships: data ?? [], groups: groups ?? [] };
};

beforeAll(async () => {
  alfa = await createKindergarten('susp-a');
  beta = await createKindergarten('susp-b');
  const m = await signInWithCode(alfa.managerEmail);
  manager = m.client;
  managerAal2 = await enrolMfa(m.client);
  const b = await signInWithCode(beta.managerEmail);
  betaManagerAal2 = await enrolMfa(b.client);

  // A new educator joins Alfa through the normal invitation flow.
  person = email('suspendirana');
  expect((await callFunction('invite-member', managerAal2, invite(alfa.orgId, person))).status).toBe(201);
  const joined = await ownMemberships();
  expect(joined.accepted.json.accepted).toEqual([{ organizationId: alfa.orgId, role: 'educator' }]);
  membershipId = joined.memberships[0]!.id as string;
});

describe('R-48: a suspended person stays suspended after signing in', () => {
  let staleInvitation: string;

  it('suspension revokes the pending invitation for that role', async () => {
    const resent = await callFunction('invite-member', managerAal2, invite(alfa.orgId, person));
    expect(resent.status).toBe(201);
    staleInvitation = resent.json.invitationId as string;
    const { data, error } = await manager.from('memberships').update({ status: 'suspended' }).eq('id', membershipId).select('status');
    expect(error).toBeNull();
    expect(data).toEqual([{ status: 'suspended' }]);
    expect(await invitationStatus(staleInvitation)).toBe('revoked');
  });

  it('signing in and accepting does not re-activate the membership', async () => {
    const after = await ownMemberships();
    expect(after.accepted.status).toBe(200);
    expect(after.accepted.json.accepted).toEqual([]);
    expect(after.memberships).toEqual([{ id: membershipId, organization_id: alfa.orgId, role: 'educator', status: 'suspended' }]);
    expect(after.groups).toEqual([]);
  });

  it('a pending invitation that slipped through is consumed, not honoured, and acceptance stays idempotent', async () => {
    // Simulates an invitation created before the fix (the service role bypasses the invitation guard).
    const { data: legacy } = await service
      .from('invitations')
      .insert({ organization_id: alfa.orgId, email: person, role: 'educator', first_name: 'Suzana', last_name: 'Test', created_by: (await manager.auth.getUser()).data.user!.id })
      .select('id')
      .single()
      .throwOnError();
    for (let i = 0; i < 2; i++) {
      const after = await ownMemberships();
      expect(after.accepted.json.accepted).toEqual([]);
      expect(after.memberships.map((m) => m.status)).toEqual(['suspended']);
    }
    const { data: inv } = await service.from('invitations').select('status').eq('id', legacy!.id).single().throwOnError();
    expect(inv!.status).toBe('revoked');
    const { data: audit } = await service.from('audit_events').select('outcome, details').eq('action', 'invitation.accept_refused').eq('target_id', legacy!.id);
    expect(audit).toEqual([{ outcome: 'denied', details: { reason: 'membership_suspended', role: 'educator' } }]);
  });

  it('a new invitation cannot lift the suspension (409 MEMBERSHIP_SUSPENDED)', async () => {
    const r = await callFunction('invite-member', managerAal2, invite(alfa.orgId, person.toUpperCase()));
    expect(r.status).toBe(409);
    expect(r.json.error.code).toBe('MEMBERSHIP_SUSPENDED');
  });

  it('another kindergarten learns nothing about the suspension', async () => {
    const r = await callFunction('invite-member', betaManagerAal2, invite(alfa.orgId, person));
    expect(r.status).toBe(403);
    expect(r.json.error.code).toBe('PERMISSION_DENIED');
    // ...and can still invite the same person into its own kindergarten
    expect((await callFunction('invite-member', betaManagerAal2, invite(beta.orgId, person))).status).toBe(201);
    const after = await ownMemberships();
    expect(after.accepted.json.accepted).toEqual([{ organizationId: beta.orgId, role: 'educator' }]);
    const byOrg = Object.fromEntries(after.memberships.map((m) => [m.organization_id, m.status]));
    expect(byOrg).toEqual({ [alfa.orgId]: 'suspended', [beta.orgId]: 'active' });
  });

  it('re-activation by the manager is the way back', async () => {
    const { data } = await manager.from('memberships').update({ status: 'active' }).eq('id', membershipId).select('status');
    expect(data).toEqual([{ status: 'active' }]);
    const after = await ownMemberships();
    expect(after.memberships.find((m) => m.organization_id === alfa.orgId)?.status).toBe('active');
  });
});
