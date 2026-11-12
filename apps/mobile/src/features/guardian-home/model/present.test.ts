import i18next from 'i18next';
import { describe, expect, it } from 'vitest';
import { resources } from '@vrticos/i18n';
import { previewGuardianHome } from '../preview/fixtures';
import {
  actionAvailability,
  attendanceView,
  cardAction,
  childAccessibilityLabel,
  childColumns,
  formatAbsenceRange,
  greetingKey,
  homeActivities,
  sectionPlan,
} from './present';
import type { ChildSummary, GuardianHomeData, HomeActivity, Translate } from './types';

const i18n = i18next.createInstance();
await i18n.init({ resources, lng: 'hr', fallbackLng: 'hr', interpolation: { escapeValue: false } });
const t: Translate = (key, vars) => i18n.t(key, vars ?? {});

const child = (over: Partial<ChildSummary> & { attendance?: ChildSummary['attendance'] } = {}): ChildSummary => ({
  id: 'c1',
  firstName: 'Šime',
  lastName: 'Đurić',
  kindergartenName: 'Vrtić Alfa',
  locationName: 'Objekt Maslina',
  groupName: 'Galebovi',
  attendance: { status: 'expected' },
  canReportAbsence: true,
  ...over,
});

describe('attendance status (text + icon, never colour alone)', () => {
  it('renders every status in Croatian with an icon', () => {
    expect(attendanceView('expected', undefined, t)).toEqual({ text: 'Očekuje se', tone: 'neutral', icon: 'ring' });
    expect(attendanceView('present', '07:42', t)).toEqual({ text: 'U vrtiću od 07:42', tone: 'present', icon: 'check' });
    expect(attendanceView('absent', undefined, t)).toEqual({ text: 'Javljen izostanak', tone: 'absent', icon: 'calendar' });
    expect(attendanceView('departed', '15:10', t)).toEqual({ text: 'Otišlo u 15:10', tone: 'departed', icon: 'arrow' });
    expect(attendanceView('unavailable', undefined, t)).toEqual({ text: 'Status trenutačno nije dostupan', tone: 'info', icon: 'dash' });
  });
  it('omits an invalid or missing time instead of guessing', () => {
    expect(attendanceView('present', '7:42', t).text).toBe('U vrtiću');
    expect(attendanceView('departed', '25:00', t).text).toBe('Otišlo');
    expect(attendanceView('present', undefined, t).text).toBe('U vrtiću');
  });
});

describe('absence range', () => {
  it('formats single days, same-month and cross-month ranges', () => {
    expect(formatAbsenceRange('2026-11-11', '2026-11-13')).toBe('11.–13. studenoga');
    expect(formatAbsenceRange('2026-11-11')).toBe('11. studenoga');
    expect(formatAbsenceRange('2026-11-30', '2026-12-02')).toBe('30. studenoga – 2. prosinca');
  });
  it('rejects malformed or reversed ranges', () => {
    expect(formatAbsenceRange('11.11.2026')).toBeNull();
    expect(formatAbsenceRange('2026-11-13', '2026-11-11')).toBeNull();
  });
});

describe('card action (spec §4)', () => {
  const today = '2026-11-11';
  it('offers "report" only with the permission', () => {
    expect(cardAction(child({ attendance: { status: 'present', time: '07:42' } }), today)).toBe('report');
    expect(cardAction(child({ canReportAbsence: false }), today)).toBeNull();
  });
  it('offers "review" for an absence covering today or later', () => {
    expect(cardAction(child({ attendance: { status: 'absent', absenceStart: today, absenceEnd: '2026-11-13' } }), today)).toBe('review');
    expect(cardAction(child({ canReportAbsence: false, attendance: { status: 'absent', absenceStart: today } }), today)).toBe('review');
  });
});

describe('action availability (spec §4, §8, §12 P3)', () => {
  it('keeps "Pregledaj izostanak" disabled until its destination exists, independently of "Prijavi izostanak"', () => {
    const d = previewGuardianHome('2026-11-11');
    expect(cardAction(d.children[1]!, '2026-11-11')).toBe('review'); // Petar
    expect(actionAvailability(false, true)).toEqual({ enabled: false, hintKey: 'guardianHome.actionNotAvailable' });
    expect(actionAvailability(true, true)).toEqual({ enabled: true, hintKey: null });
  });
  it('disables every absence action offline, even with a destination', () => {
    expect(actionAvailability(true, false)).toEqual({ enabled: false, hintKey: 'guardianHome.actionNeedsConnection' });
  });
});

describe('greeting', () => {
  it('follows the local hour', () => {
    expect(greetingKey(7)).toBe('guardianHome.greetingMorning');
    expect(greetingKey(14)).toBe('guardianHome.greetingDay');
    expect(greetingKey(21)).toBe('guardianHome.greetingEvening');
    expect(greetingKey(3)).toBe('guardianHome.greetingEvening');
  });
});

describe('today section (spec §5)', () => {
  it('keeps daily reports and at most two newest announcements', () => {
    const items: HomeActivity[] = [
      { id: 'n1', kind: 'announcement', title: 'A', organizationName: 'X', isUnread: true },
      { id: 'r1', kind: 'dailyReport', groupName: 'G', organizationName: 'X', publishedTime: '14:20' },
      { id: 'n2', kind: 'announcement', title: 'B', organizationName: 'X', isUnread: false },
      { id: 'n3', kind: 'announcement', title: 'C', organizationName: 'X', isUnread: false },
    ];
    expect(homeActivities(items).map((a) => a.id)).toEqual(['r1', 'n1', 'n2']);
  });
});

describe('layout columns (spec §7)', () => {
  it('uses one column on phones and with large text, two on tablets', () => {
    for (const w of [320, 360, 390, 430]) expect(childColumns(w, 1, 2)).toBe(1);
    expect(childColumns(768, 1, 2)).toBe(2);
    expect(childColumns(768, 1.3, 2)).toBe(1);
    expect(childColumns(768, 1, 1)).toBe(1);
  });
});

describe('screen states', () => {
  const data: GuardianHomeData = previewGuardianHome('2026-11-11');
  const none: GuardianHomeData = { children: [], activities: [] };

  it('success shows children and today', () => {
    expect(sectionPlan('success', data)).toMatchObject({ children: 'list', today: 'list', fullError: false, showOfflineBanner: false, actionsEnabled: true });
  });
  it('success without content shows the calm "no posts" message', () => {
    expect(sectionPlan('success', { ...data, activities: [] }).today).toBe('noContent');
  });
  it('no children keeps the existing guardian empty state and nothing else', () => {
    expect(sectionPlan('empty', none)).toMatchObject({ children: 'empty', today: 'hidden' });
    expect(sectionPlan('success', none)).toMatchObject({ children: 'empty', today: 'hidden' });
  });
  it('loading shows skeletons only (no invented data)', () => {
    expect(sectionPlan('loading', null)).toMatchObject({ children: 'skeleton', today: 'skeleton' });
  });
  it('error replaces the content with one retryable message', () => {
    expect(sectionPlan('error', null)).toMatchObject({ fullError: true, children: 'hidden', today: 'hidden' });
  });
  it('partial error keeps children and fails only "Danas"', () => {
    expect(sectionPlan('partialError', data)).toMatchObject({ children: 'list', today: 'error', fullError: false });
  });
  it('offline shows the banner, keeps content read-only and disables absence actions', () => {
    expect(sectionPlan('offline', data)).toMatchObject({ showOfflineBanner: true, children: 'list', today: 'list', actionsEnabled: false });
  });
});

describe('state copy (spec §8)', () => {
  it('uses the spec texts shared with the existing guardian screen', () => {
    expect(t('mobile.loadError')).toBe('Početnu nije moguće učitati.');
    expect(t('mobile.loadErrorHelp')).toBe('Provjerite vezu i pokušajte ponovno.');
    expect(t('mobile.noData')).toBe('Trenutačno nema podataka dostupnih za ovaj račun.');
    expect(t('mobile.noDataHelp')).toBe('Ako očekujete drugačiji prikaz, obratite se vrtiću.');
    expect(t('guardianHome.partialError')).toBe('Neki podaci trenutačno nisu dostupni. Pokušajte ponovno.');
    expect(t('guardianHome.offline')).toBe('Nema internetske veze. Prikazujemo posljednje učitane podatke.');
  });
});

describe('accessibility label', () => {
  it('reads the card in visual order (status right after the name, spec §4) with diacritics intact', () => {
    const c = child({ attendance: { status: 'absent', absenceStart: '2026-11-11', absenceEnd: '2026-11-13' } });
    const label = childAccessibilityLabel(c, attendanceView('absent', undefined, t), formatAbsenceRange('2026-11-11', '2026-11-13'), t);
    expect(label).toBe('Šime Đurić. Javljen izostanak. Izostanak 11.–13. studenoga. Vrtić Alfa, Objekt Maslina. Skupina Galebovi');
  });
});

describe('synthetic preview fixtures', () => {
  it('are clearly marked and cover two kindergartens', () => {
    const d = previewGuardianHome('2026-11-11');
    expect(new Set(d.children.map((c) => c.kindergartenName)).size).toBe(2);
    expect([...d.children, ...d.activities].every((x) => x.id.startsWith('preview-fixture-'))).toBe(true);
    expect(JSON.stringify(d)).not.toMatch(/@/); // no e-mail addresses
  });
});
