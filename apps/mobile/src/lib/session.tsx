import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { sessionEnd, type SessionEnd } from '../shell/navigation';
import { SESSION_KEY, sessionStorage, supabase } from './supabase';

interface SessionState {
  session: Session | null;
  ready: boolean;
  /** Why the last session ended on this device; `expired` is shown on the sign-in screen (AUTH_SESSION_EXPIRED). */
  ended: SessionEnd | null;
}

const SessionContext = createContext<SessionState>({ session: null, ready: false, ended: null });

// Set just before a sign-out the person asked for, so the SIGNED_OUT event is not mistaken for an expiry.
let userInitiatedSignOut = false;

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ session: null, ready: false, ended: null });
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setState((s) => ({ ...s, session: data.session, ready: true })));
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      const end = sessionEnd(event, userInitiatedSignOut);
      if (end) {
        userInitiatedSignOut = false;
        // A session the person did not end themselves leaves nothing behind on the device (FR-01-10).
        if (end === 'expired') void sessionStorage.removeItem(SESSION_KEY);
      }
      setState((s) => ({ session, ready: true, ended: end ?? (session ? null : s.ended) }));
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}

export const useSession = (): SessionState => useContext(SessionContext);

/**
 * Sign-out removes the session from this device even if the network call fails (FR-01-10): the server
 * revokes the refresh token when reachable, the keychain entry is always deleted. `expired` is used when a request
 * proved the token is no longer accepted; the person then sees why they were signed out.
 */
export async function signOut(reason: SessionEnd = 'signedOut'): Promise<void> {
  userInitiatedSignOut = reason === 'signedOut';
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } finally {
    await sessionStorage.removeItem(SESSION_KEY);
  }
}
