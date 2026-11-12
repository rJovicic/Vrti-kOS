// Mobile app shell (D1-10): tabs per mode, the navigation layout per screen width, and how a session ends.
import type { Access, MobileMode } from './access';

/** Destinations of the signed-in app. `home` (Parent Home) is the `index` route at `/`; the others match their file. */
export type TabName = 'home' | 'messages' | 'today' | 'attendance' | 'info' | 'profile';
export type ShellMode = MobileMode | 'none';
export const ALL_TABS: readonly TabName[] = ['today', 'attendance', 'home', 'messages', 'info', 'profile'];

/**
 * Destinations per mode (DESIGN.md Layout: 3–5). `attendance` (D3) and `messages` (D4) are controlled placeholders
 * until their features exist; `info` is the landing page for people without a mobile role (managers).
 */
export const TABS_BY_MODE: Record<ShellMode, readonly TabName[]> = {
  educator: ['today', 'attendance', 'profile'],
  guardian: ['home', 'messages', 'profile'],
  none: ['info', 'profile'],
};

export function shellMode(access: Access, preferred: MobileMode | null): ShellMode {
  if (preferred && access.modes.includes(preferred)) return preferred;
  return access.modes[0] ?? 'none';
}

export const landingTab = (mode: ShellMode): TabName => TABS_BY_MODE[mode][0]!;
/** Route file (in `src/app/(app)/`) and URL of a destination. */
export const routeName = (tab: TabName): string => (tab === 'home' ? 'index' : tab);
export const tabPath = (tab: TabName): `/${string}` => (tab === 'home' ? '/' : `/${tab}`);
export const tabAllowed = (tab: TabName, mode: ShellMode): boolean => TABS_BY_MODE[mode].includes(tab);

/** Phones: bottom tab bar. Width ≥ 600 (tablets): navigation at the side, Material rail on Android (DESIGN.md). */
export function navigationLayout(width: number, os: 'ios' | 'android' | string): { position: 'bottom' | 'left'; variant: 'uikit' | 'material' } {
  if (width >= 600) return { position: 'left', variant: os === 'android' ? 'material' : 'uikit' };
  return { position: 'bottom', variant: os === 'android' ? 'material' : 'uikit' };
}

/**
 * Why a session ended. `SIGNED_OUT` without the person asking means the refresh token was refused or revoked
 * (expired, signed out elsewhere, account blocked): the app says so instead of failing silently.
 */
export type SessionEnd = 'signedOut' | 'expired';
export function sessionEnd(event: string, userInitiated: boolean): SessionEnd | null {
  if (event !== 'SIGNED_OUT') return null;
  return userInitiated ? 'signedOut' : 'expired';
}

/** A request failed because the access token is no longer accepted (PostgREST JWT errors, HTTP 401). */
export function isSessionExpiredError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: unknown; status?: unknown; message?: unknown };
  if (e.status === 401) return true;
  if (typeof e.code === 'string' && /^PGRST30[0-3]$/.test(e.code)) return true;
  return typeof e.message === 'string' && /JWT expired/i.test(e.message);
}
