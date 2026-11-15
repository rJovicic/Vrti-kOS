import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AttendanceScreen } from '../../features/attendance/AttendanceScreen';
import { loadHome, type HomeGroup } from '../../lib/home';
import { signOut, useSession } from '../../lib/session';
import { ModeGuard } from '../../shell/ModeGuard';
import { isSessionExpiredError } from '../../shell/navigation';
import { shellStyles } from '../../shell/ShellScreens';
import { Button } from '../../ui/Button';
import { Notice } from '../../ui/Notice';
import { useColors } from '../../ui/theme';

/** Educator: attendance of the groups assigned today (D3-D). Which groups and children come back is decided by RLS. */
function AttendanceRoute() {
  const { t } = useTranslation();
  const c = useColors();
  const { session } = useSession();
  const [groups, setGroups] = useState<HomeGroup[] | null>(null);
  const [failed, setFailed] = useState(false);
  const userId = session?.user.id;

  const expired = useCallback((e: unknown) => {
    if (!isSessionExpiredError(e)) return false;
    void signOut('expired');
    return true;
  }, []);

  const load = useCallback(async () => {
    if (!userId) return;
    setFailed(false);
    try {
      setGroups((await loadHome(userId)).groups);
    } catch (e) {
      if (!expired(e)) setFailed(true);
    }
  }, [userId, expired]);

  useEffect(() => {
    void load();
  }, [load]);

  if (failed) {
    return (
      <View style={shellStyles.screen}>
        <Notice tone="error" title={t('attendance.loadError')} body={t('mobile.loadErrorHelp')} />
        <Button variant="secondary" label={t('common.retry')} onPress={() => void load()} />
      </View>
    );
  }
  if (!groups) return <ActivityIndicator style={shellStyles.screen} color={c.accent} accessibilityLabel={t('common.loading')} />;
  return <AttendanceScreen groups={groups} onSessionExpired={expired} />;
}

export default function Attendance() {
  return (
    <ModeGuard tab="attendance">
      <AttendanceRoute />
    </ModeGuard>
  );
}
