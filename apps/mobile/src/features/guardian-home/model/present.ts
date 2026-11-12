// Pure presentation rules for Parent Home. No React Native imports, so they are unit-tested with Vitest.
import type { AttendanceStatusType, ChildSummary, GuardianHomeData, HomeActivity, HomeScreenState, Translate } from './types';

export type StatusTone = 'neutral' | 'present' | 'absent' | 'departed' | 'info';
export type StatusIcon = 'ring' | 'check' | 'calendar' | 'arrow' | 'dash';

export interface StatusView {
  text: string;
  tone: StatusTone;
  icon: StatusIcon;
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Status always has text and an icon — never colour alone (spec §4). Invalid times are omitted, not guessed. */
export function attendanceView(status: AttendanceStatusType, time: string | undefined, t: Translate): StatusView {
  const validTime = time !== undefined && TIME.test(time) ? time : undefined;
  switch (status) {
    case 'present':
      return { text: validTime ? t('guardianHome.presentSince', { time: validTime }) : t('attendance.present'), tone: 'present', icon: 'check' };
    case 'departed':
      return { text: validTime ? t('attendance.departedAt', { time: validTime }) : t('attendance.departed'), tone: 'departed', icon: 'arrow' };
    case 'absent':
      return { text: t('attendance.absent'), tone: 'absent', icon: 'calendar' };
    case 'expected':
      return { text: t('attendance.expected'), tone: 'neutral', icon: 'ring' };
    default:
      return { text: t('guardianHome.statusUnavailable'), tone: 'info', icon: 'dash' };
  }
}

const dayMonth = (iso: string): string =>
  new Intl.DateTimeFormat('hr-HR', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));

/** "11.–13. studenoga", "30. studenoga – 2. prosinca", "11. studenoga" (plain dates, no time-zone shift). */
export function formatAbsenceRange(start: string, end?: string): string | null {
  if (!DAY.test(start) || (end !== undefined && !DAY.test(end))) return null;
  if (!end || end === start) return dayMonth(start);
  if (end < start) return null;
  if (start.slice(0, 7) === end.slice(0, 7)) return `${Number(start.slice(8, 10))}.–${dayMonth(end)}`;
  return `${dayMonth(start)} – ${dayMonth(end)}`;
}

export type CardAction = 'report' | 'review' | null;

/**
 * Spec §4: an absence covering today (or later) → "Pregledaj izostanak"; otherwise "Prijavi izostanak" only with
 * can_report_absence; without the permission nothing is shown and the reason is not explained.
 */
export function cardAction(child: ChildSummary, today: string): CardAction {
  const a = child.attendance;
  if (a.status === 'absent' && (a.absenceEnd ?? a.absenceStart ?? today) >= today) return 'review';
  return child.canReportAbsence ? 'report' : null;
}

export interface ActionAvailability {
  enabled: boolean;
  /** Explanation shown and announced when the action is disabled. */
  hintKey: string | null;
}

/**
 * An absence action is enabled only when its own destination exists (spec §12 P3: no active action towards a
 * missing screen) and the device is online (spec §8: absences are never queued offline).
 */
export function actionAvailability(destinationExists: boolean, online: boolean): ActionAvailability {
  if (!online) return { enabled: false, hintKey: 'guardianHome.actionNeedsConnection' };
  if (!destinationExists) return { enabled: false, hintKey: 'guardianHome.actionNotAvailable' };
  return { enabled: true, hintKey: null };
}

/** Greeting by local hour (copy only, no behaviour depends on it). */
export function greetingKey(hour: number): string {
  if (hour >= 5 && hour < 10) return 'guardianHome.greetingMorning';
  if (hour >= 10 && hour < 18) return 'guardianHome.greetingDay';
  return 'guardianHome.greetingEvening';
}

/** Spec §5: published daily reports, then at most two newest announcements. */
export function homeActivities(activities: HomeActivity[]): HomeActivity[] {
  const reports = activities.filter((a) => a.kind === 'dailyReport');
  const announcements = activities.filter((a) => a.kind === 'announcement').slice(0, 2);
  return [...reports, ...announcements];
}

/** Spec §7: two columns only on medium widths, with ≥ 2 children and normal text size. */
export function childColumns(width: number, fontScale: number, childCount: number): 1 | 2 {
  return width >= 600 && fontScale < 1.3 && childCount >= 2 ? 2 : 1;
}

export interface SectionPlan {
  showOfflineBanner: boolean;
  children: 'skeleton' | 'list' | 'empty' | 'hidden';
  today: 'skeleton' | 'list' | 'noContent' | 'error' | 'hidden';
  fullError: boolean;
  /** Absence actions can't be sent without a connection (spec §8). */
  actionsEnabled: boolean;
}

/** Which blocks each screen state shows. Empty keeps the existing guardian empty state (spec §8). */
export function sectionPlan(state: HomeScreenState, data: GuardianHomeData | null): SectionPlan {
  const hasChildren = (data?.children.length ?? 0) > 0;
  const hasToday = homeActivities(data?.activities ?? []).length > 0;
  const base: SectionPlan = { showOfflineBanner: false, children: 'hidden', today: 'hidden', fullError: false, actionsEnabled: true };
  switch (state) {
    case 'loading':
      return { ...base, children: 'skeleton', today: 'skeleton' };
    case 'error':
      return { ...base, fullError: true };
    case 'empty':
      return { ...base, children: 'empty' };
    case 'partialError':
      return { ...base, children: hasChildren ? 'list' : 'empty', today: 'error' };
    case 'offline':
      return { ...base, showOfflineBanner: true, children: hasChildren ? 'list' : 'empty', today: hasChildren ? (hasToday ? 'list' : 'noContent') : 'hidden', actionsEnabled: false };
    default:
      if (!hasChildren) return { ...base, children: 'empty' };
      return { ...base, children: 'list', today: hasToday ? 'list' : 'noContent' };
  }
}

/** One spoken summary for the card's information block (VoiceOver/TalkBack). */
export function childAccessibilityLabel(child: ChildSummary, status: StatusView, absence: string | null, t: Translate): string {
  return [
    `${child.firstName} ${child.lastName}`,
    status.text,
    absence ? t('guardianHome.absenceRange', { range: absence }) : null,
    `${child.kindergartenName}, ${child.locationName}`,
    t('guardianHome.groupLabel', { group: child.groupName }),
  ]
    .filter(Boolean)
    .join('. ');
}
