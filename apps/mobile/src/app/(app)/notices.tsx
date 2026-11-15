import { useCallback, useMemo } from 'react';
import { NoticesScreen } from '../../features/notices/NoticesScreen';
import { signOut } from '../../lib/session';
import { ModeGuard } from '../../shell/ModeGuard';
import { useShell } from '../../shell/ShellProvider';
import { isSessionExpiredError } from '../../shell/navigation';

/** Notification centre and the kindergarten's announcements (D4-D), for guardians and educators. */
function NoticesRoute() {
  const { gate, mode } = useShell();
  const key = JSON.stringify(gate.kind === 'ready' ? gate.access.kindergartens.map((k) => [k.id, k.name]) : []);
  // Stable while the kindergartens do not change, so the screen does not reload on every render.
  const kindergartens = useMemo(() => (JSON.parse(key) as [string, string][]).map(([id, name]) => ({ id, name })), [key]);
  const expired = useCallback((e: unknown) => {
    if (!isSessionExpiredError(e)) return false;
    void signOut('expired');
    return true;
  }, []);
  return <NoticesScreen kindergartens={kindergartens} showAbsences={mode === 'educator'} onSessionExpired={expired} />;
}

export default function Notices() {
  return (
    <ModeGuard tab="notices">
      <NoticesRoute />
    </ModeGuard>
  );
}
