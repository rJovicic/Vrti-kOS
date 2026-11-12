import { useTranslation } from 'react-i18next';
import { ComingLater } from '../../shell/ShellScreens';
import { ModeGuard } from '../../shell/ModeGuard';

/** Placeholder until announcements and conversations exist (D4). States what is missing; shows no sample data. */
function MessagesScreen() {
  const { t } = useTranslation();
  return <ComingLater title={t('nav.messages')} body={t('shell.comingLater.messages')} />;
}

export default function Messages() {
  return (
    <ModeGuard tab="messages">
      <MessagesScreen />
    </ModeGuard>
  );
}
