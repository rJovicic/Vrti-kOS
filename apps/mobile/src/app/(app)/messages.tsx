import { useTranslation } from 'react-i18next';
import { ComingLater } from '../../shell/ShellScreens';

/** Placeholder until announcements and conversations exist (D4). States what is missing; shows no sample data. */
export default function Messages() {
  const { t } = useTranslation();
  return <ComingLater title={t('nav.messages')} body={t('shell.comingLater.messages')} />;
}
