import { useCallback, useMemo } from 'react';
import { ConversationsScreen } from '../../features/conversations/ConversationsScreen';
import { signOut } from '../../lib/session';
import { ModeGuard } from '../../shell/ModeGuard';
import { useShell } from '../../shell/ShellProvider';
import { isSessionExpiredError } from '../../shell/navigation';

/** Guardian "Poruke" and educator "Razgovori" (D4-F): conversations about a child with the group's educators. */
function MessagesRoute() {
  const { gate, mode } = useShell();
  const key = JSON.stringify(gate.kind === 'ready' ? gate.access.kindergartens.map((k) => k.id) : []);
  const kindergartens = useMemo(() => (JSON.parse(key) as string[]).map((id) => ({ id })), [key]);
  const expired = useCallback((e: unknown) => {
    if (!isSessionExpiredError(e)) return false;
    void signOut('expired');
    return true;
  }, []);
  return <ConversationsScreen mode={mode === 'educator' ? 'educator' : 'guardian'} kindergartens={kindergartens} onSessionExpired={expired} />;
}

export default function Messages() {
  return (
    <ModeGuard tab="messages">
      <MessagesRoute />
    </ModeGuard>
  );
}
