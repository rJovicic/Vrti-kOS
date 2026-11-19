import { router } from 'expo-router';
import { useLiveRefresh } from '../../lib/live';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AbsenceReportView } from '../../features/guardian-home/AbsenceReportView';
import { DailyEntryView } from '../../features/daily-entry/DailyEntryView';
import { ChildDetailView } from '../../features/guardian-home/ChildDetailView';
import { GuardianHomeScreen } from '../../features/guardian-home/GuardianHomeScreen';
import type { GuardianHomeData, HomeScreenState } from '../../features/guardian-home/model/types';
import { loadGuardianHome } from '../../lib/guardianHome';
import { signOut, useSession } from '../../lib/session';
import { ModeGuard } from '../../shell/ModeGuard';
import { isSessionExpiredError } from '../../shell/navigation';

/**
 * Guardian: Parent Home (docs/design/parent-home-spec.md) with the authorized children (D2-H). RLS decides which
 * children come back; attendance stays "unavailable" and the "Danas" section empty until D3 — never sample data.
 */
function GuardianHomeRoute() {
  const { t } = useTranslation();
  const { session } = useSession();
  const userId = session?.user.id ?? '';
  const [reportFor, setReportFor] = useState<{ id: string; name: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [state, setState] = useState<HomeScreenState>('loading');
  const [data, setData] = useState<GuardianHomeData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [openChild, setOpenChild] = useState<string | null>(null);
  const closeChild = useCallback(() => setOpenChild(null), []);
  const [openDaily, setOpenDaily] = useState<{ groupId: string; groupName: string; entryId: string } | null>(null);
  const closeDaily = useCallback(() => setOpenDaily(null), []);
  const expired = useCallback((e: unknown) => {
    if (!isSessionExpiredError(e)) return false;
    void signOut('expired');
    return true;
  }, []);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setState('loading');
    try {
      const next = await loadGuardianHome();
      setData(next);
      setState(next.children.length ? 'success' : 'empty');
    } catch (e) {
      if (isSessionExpiredError(e)) return void signOut('expired');
      setState('error');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  useLiveRefresh(['notification', 'announcement', 'message'], () => void load(true));

  const closeReport = useCallback(() => setReportFor(null), []);
  if (reportFor) {
    return (
      <AbsenceReportView
        child={reportFor}
        onBack={closeReport}
        onDone={() => {
          setReportFor(null);
          setOpenChild(null);
          setMessage(t('absence.sent'));
          void load(true);
        }}
      />
    );
  }
  if (openDaily) return <DailyEntryView {...openDaily} onBack={closeDaily} onSessionExpired={expired} />;
  if (openChild) return <ChildDetailView childId={openChild} userId={userId} onBack={closeChild} onReportAbsence={setReportFor} />;
  return (
    <GuardianHomeScreen
      state={state}
      data={data}
      onRetry={() => void load()}
      onRefresh={() => void load(true)}
      refreshing={refreshing}
      onOpenActivity={(id) => {
        const a = data?.activities.find((x) => x.id === id);
        setMessage(null);
        if (a?.kind === 'dailyReport') setOpenDaily({ groupId: a.groupId, groupName: a.groupName, entryId: a.entryId });
        // An announcement opens in the notification centre (D4-D), where reading it marks it read.
        else if (a?.kind === 'announcement') router.navigate('/notices');
      }}
      onOpenChild={(id) => {
        setMessage(null);
        setOpenChild(id);
      }}
      onReportAbsence={(id) => {
        const child = data?.children.find((x) => x.id === id);
        setMessage(null);
        if (child) setReportFor({ id, name: `${child.firstName} ${child.lastName}` });
      }}
      onReviewAbsence={(id) => {
        setMessage(null);
        setOpenChild(id);
      }}
      message={message}
    />
  );
}

export default function GuardianHome() {
  return (
    <ModeGuard tab="home">
      <GuardianHomeRoute />
    </ModeGuard>
  );
}
