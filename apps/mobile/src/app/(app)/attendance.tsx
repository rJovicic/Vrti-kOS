import { useTranslation } from 'react-i18next';
import { ComingLater } from '../../shell/ShellScreens';

/** Placeholder until attendance exists (D3). States what is missing; shows no sample data. */
export default function Attendance() {
  const { t } = useTranslation();
  return <ComingLater title={t('nav.attendance')} body={t('shell.comingLater.attendance')} />;
}
