import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { radius, space, type } from '@vrticos/tokens';
import { raised } from './components/surface';
import { loadChildDetail, type ChildDetail } from '../../lib/guardianHome';
import { signOut } from '../../lib/session';
import { isSessionExpiredError } from '../../shell/navigation';
import { shellStyles } from '../../shell/ShellScreens';
import { Button } from '../../ui/Button';
import { Notice } from '../../ui/Notice';
import { useColors } from '../../ui/theme';

/**
 * Guardian: one child — kindergarten, facility, today's group and the pickup persons (read-only, FR-04-8).
 * A view inside the Parent Home destination (not a route of its own): the tab navigator of this Expo Router version
 * does not open hidden nested routes, and deep links to a child are not part of the MVP. Back returns to the list.
 */
export function ChildDetailView({ childId: id, onBack }: { childId: string; onBack: () => void }) {
  const { t } = useTranslation();
  const c = useColors();
  const [child, setChild] = useState<ChildDetail | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      setChild(await loadChildDetail(String(id)));
    } catch (e) {
      if (isSessionExpiredError(e)) return void signOut('expired');
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Android hardware back returns to the list instead of leaving the app.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  const row = (label: string, value: string) => (
    <View style={styles.kv} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={[styles.k, { color: c.textSecondary }]}>{label}</Text>
      <Text style={[styles.v, { color: c.textPrimary }]}>{value}</Text>
    </View>
  );

  return (
    <ScrollView
      style={{ backgroundColor: c.bgCanvas }}
      contentContainerStyle={shellStyles.screen}
      refreshControl={<RefreshControl refreshing={loading && child !== undefined} onRefresh={() => void load()} />}
    >
      <View style={styles.back}>
        <Button variant="text" label={`‹ ${t('childDetail.back')}`} onPress={onBack} />
      </View>
      {loading && child === undefined ? <ActivityIndicator color={c.accent} accessibilityLabel={t('common.loading')} /> : null}
      {failed ? (
        <View style={shellStyles.section}>
          <Notice tone="error" title={t('shell.loadError')} body={t('mobile.loadErrorHelp')} />
          <Button variant="secondary" label={t('common.retry')} onPress={() => void load()} />
        </View>
      ) : null}
      {!failed && child === null ? <Notice title={t('childDetail.notFound')} /> : null}
      {!failed && child ? (
        <>
          <Text accessibilityRole="header" style={[shellStyles.title, { color: c.textPrimary }]}>
            {child.firstName} {child.lastName}
          </Text>
          <View style={[styles.card, raised, { backgroundColor: c.bgSurface, borderColor: c.borderSubtle }]}>
            {row(t('childDetail.kindergarten'), child.kindergartenName)}
            {child.locationName ? row(t('childDetail.facility'), child.locationName) : null}
            {row(t('childDetail.group'), child.groupName ?? t('childDetail.noGroup'))}
          </View>
          <View style={shellStyles.section}>
            <Text accessibilityRole="header" style={[styles.h2, { color: c.textPrimary }]}>
              {t('childDetail.pickups')}
            </Text>
            <Text style={[shellStyles.meta, { color: c.textSecondary }]}>{t('childDetail.pickupsNote')}</Text>
            {child.pickups.length ? (
              <View style={[styles.card, raised, { backgroundColor: c.bgSurface, borderColor: c.borderSubtle }]}>
                {child.pickups.map((p, i) => (
                  <Text key={p.id} style={[styles.person, { color: c.textPrimary, borderTopColor: c.borderSubtle }, i > 0 && styles.divider]}>
                    {p.name}
                  </Text>
                ))}
              </View>
            ) : (
              <Notice title={t('childDetail.pickupsEmpty')} />
            )}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  back: { alignItems: 'flex-start', marginLeft: -space[2] },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, paddingHorizontal: space[4], paddingVertical: space[2] },
  kv: { paddingVertical: space[2], gap: 2 },
  k: { fontSize: type.footnote.size, lineHeight: type.footnote.lineHeight },
  v: { fontSize: type.bodyStrong.size, lineHeight: type.bodyStrong.lineHeight, fontWeight: type.bodyStrong.weight },
  h2: { fontSize: type.title3.size, lineHeight: type.title3.lineHeight, fontWeight: type.title3.weight },
  person: { fontSize: type.body.size, lineHeight: type.body.lineHeight, paddingVertical: space[3] },
  divider: { borderTopWidth: StyleSheet.hairlineWidth },
});
