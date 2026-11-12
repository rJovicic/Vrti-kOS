import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { CORRELATION_HEADER, newCorrelationId } from '../lib/correlation';
import { signOut } from '../lib/session';
import { supabase } from '../lib/supabase';
import {
  deriveAccess,
  shellGate,
  type Access,
  type LoadStatus,
  type MembershipRow,
  type MobileMode,
  type PrivacyNotice,
  type ShellGate,
} from './access';
import { isSessionExpiredError, shellMode, type ShellMode } from './navigation';

interface ShellState {
  gate: ShellGate;
  mode: ShellMode;
  setMode: (mode: MobileMode) => void;
  reload: () => void;
  /** Texts of the notices this person still has to read (only while `gate.kind === 'noticeRequired'`). */
  notices: PrivacyNotice[];
  /** Records that the person has read this version (all their roles in that kindergarten), then reloads. */
  acknowledge: (organizationId: string, version: string) => Promise<boolean>;
}

const ShellContext = createContext<ShellState | null>(null);

/**
 * Loads the caller's own active memberships once per signed-in user (the provider is keyed by user id, so nothing
 * survives a change of account). RLS decides what comes back; this only chooses what to show. Every load and every
 * acknowledgement is one user action with one correlation id.
 */
export function ShellProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [access, setAccess] = useState<Access | null>(null);
  const [notices, setNotices] = useState<PrivacyNotice[]>([]);
  const [preferred, setPreferred] = useState<MobileMode | null>(null);

  const fail = useCallback(async (error: unknown) => {
    if (isSessionExpiredError(error)) {
      setStatus('expired');
      await signOut('expired');
      return;
    }
    setStatus('error');
  }, []);

  const reload = useCallback(async () => {
    setStatus('loading');
    const cid = newCorrelationId();
    const { data, error } = await supabase
      .from('memberships')
      .select('role, notice_ack_version, organization:organizations(id, name, privacy_notice_version)')
      .eq('profile_id', userId)
      .eq('status', 'active')
      .setHeader(CORRELATION_HEADER, cid);
    if (error) return fail(error);
    const next = deriveAccess((data ?? []) as MembershipRow[]);
    let texts: PrivacyNotice[] = [];
    if (next.noticePending.length > 0) {
      const { data: rows, error: noticeError } = await supabase
        .from('privacy_notices')
        .select('organization_id, version, title, body, is_demo')
        .in('organization_id', next.noticePending.map((k) => k.id))
        .setHeader(CORRELATION_HEADER, cid);
      if (noticeError) return fail(noticeError);
      texts = next.noticePending
        .map((k) => (rows ?? []).find((r) => r.organization_id === k.id && r.version === k.version))
        .filter((r): r is NonNullable<typeof r> => r !== undefined)
        .map((r) => ({ organizationId: r.organization_id, version: r.version, title: r.title, body: r.body, isDemo: r.is_demo }));
      // A published version whose text cannot be read is an inconsistency: block (fail closed) instead of skipping it.
      if (texts.length !== next.noticePending.length) return fail(new Error('notice text missing'));
    }
    setNotices(texts);
    setAccess(next);
    setStatus('loaded');
  }, [userId, fail]);

  const acknowledge = useCallback(
    async (organizationId: string, version: string) => {
      const { error } = await supabase
        .from('memberships')
        .update({ notice_ack_version: version })
        .eq('organization_id', organizationId)
        .eq('profile_id', userId)
        .setHeader(CORRELATION_HEADER, newCorrelationId());
      if (error) {
        if (isSessionExpiredError(error)) await fail(error);
        return false;
      }
      await reload();
      return true;
    },
    [userId, reload, fail],
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  const value = useMemo<ShellState>(() => {
    const gate = shellGate(status, access);
    return {
      gate,
      mode: gate.kind === 'ready' ? shellMode(gate.access, preferred) : 'none',
      setMode: setPreferred,
      reload: () => void reload(),
      notices: gate.kind === 'noticeRequired' ? notices : [],
      acknowledge,
    };
  }, [status, access, preferred, reload, notices, acknowledge]);

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShell(): ShellState {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error('useShell outside ShellProvider');
  return ctx;
}
