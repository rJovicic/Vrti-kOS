import { useTranslation } from 'react-i18next';
import { ComingLater } from '../../shell/ShellScreens';

/** People without a mobile role (kindergarten managers) see where their work happens instead of empty tabs. */
export default function Info() {
  const { t } = useTranslation();
  return <ComingLater title={t('common.appName')} body={t('mobile.managersUseWeb')} />;
}
