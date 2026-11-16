import { useCallback } from 'react';
import { ConversationsScreen } from '../../features/conversations/ConversationsScreen';
import { signOut } from '../../lib/session';
import { ModeGuard } from '../../shell/ModeGuard';
import { useShell } from '../../shell/ShellProvider';
import { isSessionExpiredError } from '../../shell/navigation';

/** Guardian "Poruke" and educator "Razgovori" (D4-F, D-42): conversations about a child between one guardian and the group's educators. */
function MessagesRoute() {
  const { mode } = useShell();
  const expired = useCallback((e: unknown) => {
    if (!isSessionExpiredError(e)) return false;
    void signOut('expired');
    return true;
  }, []);
  return <ConversationsScreen mode={mode === 'educator' ? 'educator' : 'guardian'} onSessionExpired={expired} />;
}

export default function Messages() {
  return (
    <ModeGuard tab="messages">
      <MessagesRoute />
    </ModeGuard>
  );
}
