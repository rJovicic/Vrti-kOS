import { useTranslation } from 'react-i18next';
import { ComingLater } from '../../shell/ShellScreens';
import { ModeGuard } from '../../shell/ModeGuard';

/** People without a mobile role (kindergarten managers) see where their work happens instead of empty tabs. */
function InfoScreen() {
  const { t } = useTranslation();
  return <ComingLater title={t('common.appName')} body={t('mobile.managersUseWeb')} />;
}

export default function Info() {
  return (
    <ModeGuard tab="info">
      <InfoScreen />
    </ModeGuard>
  );
}
