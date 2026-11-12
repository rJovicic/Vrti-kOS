// D1-10: mobile app shell — auth/role guards, navigation per mode and screen width, session end handling.
// Pure logic plus a structural check of the expo-router route files (no renderer is installed for React Native).
import { describe, expect, it } from 'vitest';
import { deriveAccess, shellGate, type MembershipRow } from './access';
import {
  ALL_TABS,
  TABS_BY_MODE,
  isSessionExpiredError,
  landingTab,
  routeName,
  tabPath,
  navigationLayout,
  sessionEnd,
  shellMode,
  tabAllowed,
  type ShellMode,
} from './navigation';

const alfa = { id: 'a', name: 'Vrtić Alfa (demo)', privacy_notice_version: null };
const beta = { id: 'b', name: 'Vrtić Beta (demo)', privacy_notice_version: null };
const row = (role: MembershipRow['role'], organization: MembershipRow['organization'] = alfa, ack: string | null = null): MembershipRow => ({
  role,
  organization,
  notice_ack_version: ack,
});

describe('access: roles decide modes, not the UI', () => {
  it('guardian only → guardian mode', () => {
    expect(deriveAccess([row('guardian')]).modes).toEqual(['guardian']);
  });
  it('educator and guardian (also in two kindergartens) → both modes, educator first; kindergartens listed once', () => {
    const a = deriveAccess([row('guardian', beta), row('educator'), row('guardian')]);
    expect(a.modes).toEqual(['educator', 'guardian']);
    expect(a.kindergartens.map((k) => k.id)).toEqual(['a', 'b']);
  });
  it('managers only → no mobile mode, managerOnly', () => {
    const a = deriveAccess([row('org_admin'), row('director', beta)]);
    expect(a.modes).toEqual([]);
    expect(a.managerOnly).toBe(true);
  });
  it('rows without a visible kindergarten are ignored (RLS hid the organisation)', () => {
    expect(deriveAccess([row('guardian', null)])).toEqual({ modes: [], managerOnly: false, kindergartens: [], noticePending: [] });
  });
});

describe('gate: what the signed-in app may show', () => {
  it('loading, error, expired and unknown states never show tabs (fail closed)', () => {
    expect(shellGate('loading', null).kind).toBe('loading');
    expect(shellGate('error', null).kind).toBe('error');
    expect(shellGate('loaded', null).kind).toBe('error');
    expect(shellGate('expired', deriveAccess([row('guardian')])).kind).toBe('sessionExpired');
  });
  it('no active membership → blocked with an explanation', () => {
    expect(shellGate('loaded', deriveAccess([])).kind).toBe('noMembership');
  });
  it('a published, unacknowledged privacy notice blocks the app (FR-01-5); an acknowledged one does not', () => {
    const published = { ...alfa, privacy_notice_version: '2026-09' };
    expect(shellGate('loaded', deriveAccess([row('guardian', published, null)]))).toEqual({
      kind: 'noticeRequired',
      kindergartens: [{ id: 'a', name: 'Vrtić Alfa (demo)', version: '2026-09' }],
    });
    expect(shellGate('loaded', deriveAccess([row('guardian', published, '2026-08')])).kind).toBe('noticeRequired');
    expect(shellGate('loaded', deriveAccess([row('guardian', published, '2026-09')])).kind).toBe('ready');
  });
  it('several roles in one kindergarten ask for its notice once; any unacknowledged role keeps the gate closed', () => {
    const published = { ...alfa, privacy_notice_version: '2026-09' };
    const a = deriveAccess([row('educator', published, '2026-09'), row('guardian', published, null)]);
    expect(a.noticePending).toEqual([{ id: 'a', name: 'Vrtić Alfa (demo)', version: '2026-09' }]);
  });
  it('a kindergarten without a published notice never blocks', () => {
    expect(deriveAccess([row('guardian', alfa, null)]).noticePending).toEqual([]);
  });
  it('a member with access and no pending notice → ready', () => {
    expect(shellGate('loaded', deriveAccess([row('educator')])).kind).toBe('ready');
  });
});

describe('navigation: tabs per mode', () => {
  const both = deriveAccess([row('educator'), row('guardian')]);
  it('default mode is the first allowed one; a preferred mode is used only if allowed', () => {
    expect(shellMode(both, null)).toBe('educator');
    expect(shellMode(both, 'guardian')).toBe('guardian');
    expect(shellMode(deriveAccess([row('guardian')]), 'educator')).toBe('guardian');
    expect(shellMode(deriveAccess([row('director')]), 'educator')).toBe('none');
  });
  it('a guardian never gets educator destinations and vice versa', () => {
    expect(tabAllowed('today', 'guardian')).toBe(false);
    expect(tabAllowed('attendance', 'guardian')).toBe(false);
    expect(tabAllowed('home', 'educator')).toBe(false);
    expect(tabAllowed('messages', 'educator')).toBe(false);
    expect(tabAllowed('home', 'none')).toBe(false);
    expect(tabAllowed('today', 'none')).toBe(false);
  });
  it('every mode has 2–5 destinations, ends with Profile and lands on its first tab', () => {
    for (const mode of Object.keys(TABS_BY_MODE) as ShellMode[]) {
      const tabs = TABS_BY_MODE[mode];
      expect(tabs.length).toBeGreaterThanOrEqual(2);
      expect(tabs.length).toBeLessThanOrEqual(5);
      expect(tabs.at(-1)).toBe('profile');
      expect(landingTab(mode)).toBe(tabs[0]);
    }
    expect(landingTab('educator')).toBe('today');
    expect(landingTab('guardian')).toBe('home');
    expect(tabPath('home')).toBe('/');
    expect(tabPath('today')).toBe('/today');
  });
  it('phones get a bottom bar; tablets (≥ 600) a side bar, Material rail on Android', () => {
    expect(navigationLayout(390, 'ios')).toEqual({ position: 'bottom', variant: 'uikit' });
    expect(navigationLayout(412, 'android')).toEqual({ position: 'bottom', variant: 'material' });
    expect(navigationLayout(800, 'android')).toEqual({ position: 'left', variant: 'material' });
    expect(navigationLayout(1024, 'ios')).toEqual({ position: 'left', variant: 'uikit' });
  });
});

describe('session end', () => {
  it('SIGNED_OUT without the person asking is an expiry; other events are not an end', () => {
    expect(sessionEnd('SIGNED_OUT', false)).toBe('expired');
    expect(sessionEnd('SIGNED_OUT', true)).toBe('signedOut');
    expect(sessionEnd('TOKEN_REFRESHED', false)).toBeNull();
    expect(sessionEnd('SIGNED_IN', false)).toBeNull();
  });
  it('recognises a refused access token', () => {
    expect(isSessionExpiredError({ code: 'PGRST303', message: 'JWT expired' })).toBe(true);
    expect(isSessionExpiredError({ status: 401 })).toBe(true);
    expect(isSessionExpiredError({ code: '42501', message: 'permission denied' })).toBe(false);
    expect(isSessionExpiredError(null)).toBe(false);
  });
});

// Route sources as raw text, collected by Vitest/Vite at transform time (the mobile project has no Node typings).
declare global {
  interface ImportMeta {
    glob<T>(pattern: string, options: { query: '?raw'; import: 'default'; eager: true }): Record<string, T>;
  }
}
const sources = import.meta.glob<string>('../app/**/*.tsx', { query: '?raw', import: 'default', eager: true });
const groupFiles = Object.keys(sources).filter((k) => k.startsWith('../app/(app)/'));
const source = (path: string): string => {
  const text = sources[path];
  if (text === undefined) throw new Error(`missing route file ${path}`);
  return text;
};

describe('route files match the shell definition', () => {
  const files = groupFiles.map((k) => k.slice('../app/(app)/'.length).replace(/\.tsx$/, ''));
  const layout = source('../app/(app)/_layout.tsx');
  const rootLayout = source('../app/_layout.tsx');

  it('every destination has exactly one route file, and there are no unlisted screens', () => {
    expect(files.sort()).toEqual(['_layout', ...ALL_TABS.map(routeName)].sort());
  });
  it('every destination is offered by the tab bar only in its own mode', () => {
    expect(layout).toMatch(/tabAllowed\(name, mode\) \? \{\} : \{ href: null \}/);
    for (const tab of ALL_TABS) expect(layout, tab).toContain(`<Tabs.Screen name="${routeName(tab)}" options={tab('${tab}'`);
  });
  it('every role-specific screen guards itself with its own destination name', () => {
    for (const tab of ALL_TABS.filter((x) => x !== 'profile')) {
      expect(source(`../app/(app)/${routeName(tab)}.tsx`), tab).toContain(`<ModeGuard tab="${tab}">`);
    }
  });
  it('the signed-in group and the sign-in screen are guarded by session state in the root navigator', () => {
    expect(rootLayout).toMatch(/<Stack\.Protected guard=\{signedIn\}>\s*<Stack\.Screen name="\(app\)" \/>/);
    expect(rootLayout).toMatch(/<Stack\.Protected guard=\{!signedIn\}>\s*<Stack\.Screen name="sign-in" \/>/);
  });
  it('placeholders do not import sample data or fixtures', () => {
    for (const f of ['attendance', 'messages', 'index', 'info']) {
      expect(source(`../app/(app)/${f}.tsx`)).not.toMatch(/fixtures|preview|synthetic/i);
    }
  });
});
