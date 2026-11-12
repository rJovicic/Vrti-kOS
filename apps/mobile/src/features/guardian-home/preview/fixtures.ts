// SYNTHETIC preview data for the development-only Parent Home preview. Fictional people and kindergartens.
// Imported only behind `__DEV__` (app/dev/parent-home.tsx) so it is excluded from production bundles; never
// written to Supabase and never mixed with the real data layer.
import type { GuardianHomeData } from '../model/types';

const addDays = (iso: string, days: number): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** Relative to the preview day so the absence always covers "today". */
export function previewGuardianHome(today: string): GuardianHomeData {
  return {
    children: [
      {
        id: 'preview-fixture-child-1',
        firstName: 'Lana',
        lastName: 'Babić',
        kindergartenName: 'Vrtić Alfa',
        locationName: 'Objekt Maslina',
        groupName: 'Galebovi',
        attendance: { status: 'present', time: '07:42' },
        canReportAbsence: true,
      },
      {
        id: 'preview-fixture-child-2',
        firstName: 'Petar',
        lastName: 'Babić',
        kindergartenName: 'Vrtić Beta',
        locationName: 'Objekt Centar',
        groupName: 'Borovi',
        attendance: { status: 'absent', absenceStart: today, absenceEnd: addDays(today, 2) },
        canReportAbsence: true,
      },
    ],
    activities: [
      { id: 'preview-fixture-report-1', kind: 'dailyReport', groupName: 'Galebovi', organizationName: 'Vrtić Alfa', publishedTime: '14:20' },
      { id: 'preview-fixture-notice-1', kind: 'announcement', title: 'Roditeljski sastanak u četvrtak', organizationName: 'Vrtić Alfa', isUnread: true },
    ],
  };
}
