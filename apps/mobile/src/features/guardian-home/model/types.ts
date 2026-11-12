// View model of Parent Home (docs/design/parent-home-spec.md). Presentation-ready values only: a later data layer
// (D2) maps authorized rows into these shapes; components never fetch or invent data.

export type AttendanceStatusType = 'expected' | 'present' | 'absent' | 'departed' | 'unavailable';

export interface ChildAttendance {
  status: AttendanceStatusType;
  /** Local time in the kindergarten's time zone, 24 h `HH:mm` (present: arrival, departed: departure). */
  time?: string;
  /** Reported absence, inclusive calendar dates `YYYY-MM-DD`. */
  absenceStart?: string;
  absenceEnd?: string;
}

export interface ChildSummary {
  id: string;
  firstName: string;
  lastName: string;
  kindergartenName: string;
  /** Facility of today's group; null while the child is not placed in a group (D-32). */
  locationName: string | null;
  /** Today's group; null while the child is not placed in a group (D-32). */
  groupName: string | null;
  attendance: ChildAttendance;
  /** Guardian holds an active can_report_absence permission for this child (spec §4). */
  canReportAbsence: boolean;
}

export type HomeActivity =
  | { id: string; kind: 'dailyReport'; groupName: string; organizationName: string; publishedTime: string }
  | { id: string; kind: 'announcement'; title: string; organizationName: string; isUnread: boolean };

export type HomeScreenState = 'loading' | 'success' | 'empty' | 'error' | 'partialError' | 'offline';

export interface GuardianHomeData {
  children: ChildSummary[];
  /** Newest first. */
  activities: HomeActivity[];
}

export type Translate = (key: string, vars?: Record<string, string | number>) => string;
