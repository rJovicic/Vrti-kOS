import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { SESSION_KEY, sessionStorage, supabase } from './supabase';

interface SessionState {
  session: Session | null;
  ready: boolean;
}

const SessionContext = createContext<SessionState>({ session: null, ready: false });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ session: null, ready: false });
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setState({ session: data.session, ready: true }));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setState({ session, ready: true }));
    return () => data.subscription.unsubscribe();
  }, []);
  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}

export const useSession = (): SessionState => useContext(SessionContext);

/**
 * Sign-out removes the session from this device even if the network call fails (FR-01-10): the server
 * revokes the refresh token when reachable, the keychain entry is always deleted.
 */
export async function signOut(): Promise<void> {
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } finally {
    await sessionStorage.removeItem(SESSION_KEY);
  }
}
