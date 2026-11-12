import { Redirect } from 'expo-router';
import type { ReactNode } from 'react';
import { useShell } from './ShellProvider';
import { landingTab, tabAllowed, tabPath, type TabName } from './navigation';

/**
 * Renders a destination only in the mode it belongs to; otherwise redirects to the landing destination of the current
 * mode (deep links, history from before a mode switch). The tab bar does not offer the other mode's destinations
 * either (`href: null` in the layout). Presentation only — what data the person can read is decided by RLS.
 */
export function ModeGuard({ tab, children }: { tab: TabName; children: ReactNode }) {
  const { mode } = useShell();
  if (!tabAllowed(tab, mode)) return <Redirect href={tabPath(landingTab(mode))} />;
  return <>{children}</>;
}
