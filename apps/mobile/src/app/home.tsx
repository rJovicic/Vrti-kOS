import { Redirect, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatDay, formatLongDate } from '@vrticos/i18n';
import { radius, space, type } from '@vrticos/tokens';
import { loadHome, type HomeData } from '../lib/home';
import { signOut, useSession } from '../lib/session';
import { Button } from '../ui/Button';
import { Notice } from '../ui/Notice';
import { useColors } from '../ui/theme';

/** D1 home: educator "Moje skupine danas", guardian empty state (parent-home-spec §8), profile + sign-out. */
export default function Home() {
  const { t } = useTranslation();
  const c = useColors();
  const { session, ready } = useSession();
  const [data, setData] = useState<HomeData | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const userId = session?.user.id;

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setFailed(false);
    try {
      setData(await loadHome(userId));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (ready && !session) return <Redirect href="/sign-in" />;

  return (
    <ScrollView contentContainerStyle={styles.screen} refreshControl={<RefreshControl refreshing={loading && data !== null} onRefresh={() => void load()} />}>
      <Text style={[styles.date, { color: c.textSecondary }]}>{formatLongDate(new Date())}</Text>

      {loading && !data ? <ActivityIndicator color={c.accent} accessibilityLabel={t('common.loading')} /> : null}
      {failed ? (
        <View style={styles.section}>
          <Notice tone="error" title={t('mobile.loadError')} body={t('mobile.loadErrorHelp')} />
          <Button variant="secondary" label={t('common.retry')} onPress={() => void load()} />
        </View>
      ) : null}

      {data?.isEducator ? (
        <View style={styles.section}>
          <Text accessibilityRole="header" style={[styles.h2, { color: c.textPrimary }]}>
            {t('mobile.myGroups')}
          </Text>
          {data.groups.length ? (
            data.groups.map((g) => (
              <View key={g.id} style={[styles.card, { backgroundColor: c.bgSurface, borderColor: c.borderSubtle }]}>
                <Text style={[styles.cardTitle, { color: c.textPrimary }]}>{g.name}</Text>
                <Text style={[styles.meta, { color: c.textSecondary }]}>{[g.facility, g.organization].filter(Boolean).join(' · ')}</Text>
                {g.substituteUntil ? (
                  <Text style={[styles.pill, { backgroundColor: c.infoBg, color: c.infoFg }]}>
                    {t('mobile.substituteUntil', { date: formatDay(g.substituteUntil) })}
                  </Text>
                ) : null}
              </View>
            ))
          ) : (
            <Notice title={t('attendance.noGroupToday')} body={t('attendance.noGroupTodayHelp')} />
          )}
        </View>
      ) : null}

      {data?.isGuardian ? (
        <View style={styles.section}>
          <Text accessibilityRole="header" style={[styles.h2, { color: c.textPrimary }]}>
            {t('mobile.myChildren')}
          </Text>
          {/* No guardian links exist before D2; the copy must not reveal or interpret relationship state. */}
          <Notice title={t('mobile.noData')} body={t('mobile.noDataHelp')} />
        </View>
      ) : null}

      {data && !data.isEducator && !data.isGuardian ? (
        <Notice title={data.isManagerOnly ? t('mobile.managersUseWeb') : t('mobile.noData')} body={data.isManagerOnly ? undefined : t('mobile.noDataHelp')} />
      ) : null}

      <View style={[styles.section, styles.profile, { borderColor: c.borderSubtle }]}>
        <Text accessibilityRole="header" style={[styles.h2, { color: c.textPrimary }]}>
          {t('mobile.profile')}
        </Text>
        {session?.user.email ? <Text style={[styles.meta, { color: c.textSecondary }]}>{t('mobile.signedInAs', { email: session.user.email })}</Text> : null}
        <Button
          variant="secondary"
          label={t('auth.signOut')}
          onPress={() => {
            void signOut().finally(() => router.replace('/sign-in'));
          }}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { padding: space[4], gap: space[6] },
  date: { fontSize: type.footnote.size, lineHeight: type.footnote.lineHeight },
  section: { gap: space[3] },
  h2: { fontSize: type.title3.size, lineHeight: type.title3.lineHeight, fontWeight: type.title3.weight },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: space[4], gap: space[1] },
  cardTitle: { fontSize: type.bodyStrong.size, lineHeight: type.bodyStrong.lineHeight, fontWeight: type.bodyStrong.weight },
  meta: { fontSize: type.footnote.size, lineHeight: type.footnote.lineHeight },
  pill: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: space[3], paddingVertical: 2, fontSize: type.caption.size, fontWeight: '600', overflow: 'hidden' },
  profile: { borderTopWidth: 1, paddingTop: space[4] },
});
