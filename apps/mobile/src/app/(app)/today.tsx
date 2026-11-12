import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatDay, formatLongDate } from '@vrticos/i18n';
import { radius, space, type } from '@vrticos/tokens';
import { loadHome, type HomeGroup } from '../../lib/home';
import { signOut, useSession } from '../../lib/session';
import { isSessionExpiredError } from '../../shell/navigation';
import { shellStyles } from '../../shell/ShellScreens';
import { Button } from '../../ui/Button';
import { Notice } from '../../ui/Notice';
import { useColors } from '../../ui/theme';
import { ModeGuard } from '../../shell/ModeGuard';

/** Educator: "Moje skupine danas" — groups assigned today, decided by RLS (ADR-0005). Attendance follows in D3. */
function TodayScreen() {
  const { t } = useTranslation();
  const c = useColors();
  const { session } = useSession();
  const [groups, setGroups] = useState<HomeGroup[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const userId = session?.user.id;

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setFailed(false);
    try {
      setGroups((await loadHome(userId)).groups);
    } catch (e) {
      if (isSessionExpiredError(e)) return void signOut('expired');
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ScrollView
      contentContainerStyle={shellStyles.screen}
      refreshControl={<RefreshControl refreshing={loading && groups !== null} onRefresh={() => void load()} />}
    >
      <View style={shellStyles.section}>
        <Text style={[shellStyles.meta, { color: c.textSecondary }]}>{formatLongDate(new Date())}</Text>
        <Text accessibilityRole="header" style={[shellStyles.title, { color: c.textPrimary }]}>
          {t('mobile.myGroups')}
        </Text>
      </View>
      {loading && groups === null ? <ActivityIndicator color={c.accent} accessibilityLabel={t('common.loading')} /> : null}
      {failed ? (
        <View style={shellStyles.section}>
          <Notice tone="error" title={t('shell.loadError')} body={t('mobile.loadErrorHelp')} />
          <Button variant="secondary" label={t('common.retry')} onPress={() => void load()} />
        </View>
      ) : null}
      {groups && !failed ? (
        groups.length ? (
          <View style={shellStyles.section}>
            {groups.map((g) => (
              <View key={g.id} style={[styles.card, { backgroundColor: c.bgSurface, borderColor: c.borderSubtle }]}>
                <Text style={[styles.cardTitle, { color: c.textPrimary }]}>{g.name}</Text>
                <Text style={[shellStyles.meta, { color: c.textSecondary }]}>{[g.facility, g.organization].filter(Boolean).join(' · ')}</Text>
                {g.substituteUntil ? (
                  <Text style={[styles.pill, { backgroundColor: c.infoBg, color: c.infoFg }]}>
                    {t('mobile.substituteUntil', { date: formatDay(g.substituteUntil) })}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : (
          <Notice title={t('attendance.noGroupToday')} body={t('attendance.noGroupTodayHelp')} />
        )
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.lg, padding: space[4], gap: space[1] },
  cardTitle: { fontSize: type.bodyStrong.size, lineHeight: type.bodyStrong.lineHeight, fontWeight: type.bodyStrong.weight },
  pill: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: space[3], paddingVertical: 2, fontSize: type.caption.size, fontWeight: '600', overflow: 'hidden' },
});

export default function Today() {
  return (
    <ModeGuard tab="today">
      <TodayScreen />
    </ModeGuard>
  );
}
