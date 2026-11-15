import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatLongDate, formatTime } from '@vrticos/i18n';
import { radius, space } from '@vrticos/tokens';
import { loadGroupEntries, type DailyEntry } from '../../lib/dailyEntries';
import { shellStyles } from '../../shell/ShellScreens';
import { Button } from '../../ui/Button';
import { Notice } from '../../ui/Notice';
import { useColors } from '../../ui/theme';

const longDay = (date: string) => formatLongDate(new Date(`${date}T12:00:00Z`));

/**
 * Guardian: the daily overview of a group (prototype "Dnevni pregled: čitanje") — the chosen day in full and earlier
 * days the database lets the guardian read (only days on which their child was in the group). No child data, no author
 * name ("odgojiteljice skupine"). A view inside Parent Home.
 */
export function DailyEntryView({ groupId, groupName, entryId, onBack, onSessionExpired }: {
  groupId: string;
  groupName: string;
  entryId: string;
  onBack: () => void;
  onSessionExpired: (e: unknown) => boolean;
}) {
  const { t } = useTranslation();
  const c = useColors();
  const [entries, setEntries] = useState<DailyEntry[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      setEntries((await loadGroupEntries(groupId)).filter((e) => e.status === 'published'));
      setFailed(false);
    } catch (e) {
      if (!onSessionExpired(e)) setFailed(true);
    }
  }, [groupId, onSessionExpired]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  const main = entries?.find((e) => e.id === entryId) ?? null;
  const earlier = (entries ?? []).filter((e) => e.id !== entryId);
  const tagText = (e: DailyEntry) => e.tags.map((x) => t(`daily.tags.${x}`)).join(', ');
  return (
    <ScrollView contentContainerStyle={shellStyles.screen}>
      <Button variant="secondary" label={t('daily.backHome')} onPress={onBack} />
      <View style={{ gap: space[1] }}>
        <Text accessibilityRole="header" style={[shellStyles.title, { color: c.textPrimary }]}>
          {t('daily.title')}
        </Text>
        {main ? <Text style={[shellStyles.meta, { color: c.textSecondary }]}>{`${groupName} · ${longDay(main.date)}`}</Text> : null}
      </View>
      {failed ? (
        <View style={shellStyles.section}>
          <Notice tone="error" title={t('daily.loadError')} />
          <Button variant="secondary" label={t('common.retry')} onPress={() => void load()} />
        </View>
      ) : entries === null ? (
        <ActivityIndicator color={c.accent} accessibilityLabel={t('common.loading')} />
      ) : !main ? (
        <Notice title={t('daily.unavailable')} />
      ) : (
        <>
          <View style={[styles.card, { backgroundColor: c.bgSurface, borderColor: c.borderSubtle }]}>
            <Text style={[shellStyles.body, { color: c.textPrimary }]}>{main.body}</Text>
            {main.tags.length ? <Text style={[shellStyles.meta, { color: c.textSecondary }]}>{tagText(main)}</Text> : null}
            <Text style={[shellStyles.meta, { color: c.textSecondary }]}>
              {[t('daily.byGroupEducators', { time: formatTime(new Date(main.publishedAt!)) }), main.edited ? t('notices.edited') : null].filter(Boolean).join(' · ')}
            </Text>
          </View>
          {earlier.length ? (
            <View style={shellStyles.section}>
              <Text accessibilityRole="header" style={[shellStyles.h2, { color: c.textPrimary }]}>
                {t('daily.earlier')}
              </Text>
              {earlier.map((e) => (
                <View key={e.id} style={[styles.card, { backgroundColor: c.bgSurface, borderColor: c.borderSubtle }]}>
                  <Text style={[shellStyles.meta, { color: c.textSecondary, fontWeight: '600' }]}>{longDay(e.date)}</Text>
                  <Text style={[shellStyles.body, { color: c.textPrimary }]}>{e.body}</Text>
                  {e.tags.length ? <Text style={[shellStyles.meta, { color: c.textSecondary }]}>{tagText(e)}</Text> : null}
                </View>
              ))}
            </View>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.lg, padding: space[4], gap: space[2] },
});
