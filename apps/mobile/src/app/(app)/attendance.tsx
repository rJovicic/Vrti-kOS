import { useTranslation } from 'react-i18next';
import { ComingLater } from '../../shell/ShellScreens';
import { ModeGuard } from '../../shell/ModeGuard';

/** Placeholder until attendance exists (D3). States what is missing; shows no sample data. */
function AttendanceScreen() {
  const { t } = useTranslation();
  return <ComingLater title={t('nav.attendance')} body={t('shell.comingLater.attendance')} />;
}

export default function Attendance() {
  return (
    <ModeGuard tab="attendance">
      <AttendanceScreen />
    </ModeGuard>
  );
}
