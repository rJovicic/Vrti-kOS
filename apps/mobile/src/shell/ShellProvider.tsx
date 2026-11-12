import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { signOut } from '../lib/session';
import { supabase } from '../lib/supabase';
import { deriveAccess, shellGate, type Access, type LoadStatus, type MembershipRow, type MobileMode, type ShellGate } from './access';
import { isSessionExpiredError, shellMode, type ShellMode } from './navigation';

interface ShellState {
  gate: ShellGate;
  mode: ShellMode;
  setMode: (mode: MobileMode) => void;
  reload: () => void;
}

const ShellContext = createContext<ShellState | null>(null);

/**
 * Loads the caller's own active memberships once per signed-in user (the provider is keyed by user id, so nothing
 * survives a change of account). RLS decides what comes back; this only chooses what to show.
 */
export function ShellProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [access, setAccess] = useState<Access | null>(null);
  const [preferred, setPreferred] = useState<MobileMode | null>(null);

  const reload = useCallback(async () => {
    setStatus('loading');
    const { data, error } = await supabase
      .from('memberships')
      .select('role, notice_ack_version, organization:organizations(id, name, privacy_notice_version)')
      .eq('profile_id', userId)
      .eq('status', 'active');
    if (error) {
      if (isSessionExpiredError(error)) {
        setStatus('expired');
        await signOut('expired');
        return;
      }
      setStatus('error');
      return;
    }
    setAccess(deriveAccess((data ?? []) as MembershipRow[]));
    setStatus('loaded');
  }, [userId]);

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
    };
  }, [status, access, preferred, reload]);

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShell(): ShellState {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error('useShell outside ShellProvider');
  return ctx;
}
