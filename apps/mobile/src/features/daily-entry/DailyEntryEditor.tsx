import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatLongDate, formatTime } from '@vrticos/i18n';
import { radius, space, type } from '@vrticos/tokens';
import { businessCode } from '../../lib/attendanceKeys';
import { activityTags, DAILY_ENTRY_MAX, loadGroupEntries, saveDailyEntry, type ActivityTag, type DailyEntry } from '../../lib/dailyEntries';
import type { HomeGroup } from '../../lib/home';
import { shellStyles } from '../../shell/ShellScreens';
import { Button } from '../../ui/Button';
import { Notice } from '../../ui/Notice';
import { TextField } from '../../ui/TextField';
import { useColors } from '../../ui/theme';

/**
 * Educator: today's daily overview of one group (FS-10, prototype "Dnevni pregled: pisanje"). Group level only — the
 * warning says so; no automatic text analysis. Draft or publish; after publishing, same-day edits are marked "uređeno".
 * A view inside "Danas" (not a route). The database decides who may write (AC-10-2).
 */
export function DailyEntryEditor({ group, onBack, onSessionExpired }: { group: HomeGroup; onBack: () => void; onSessionExpired: (e: unknown) => boolean }) {
  const { t } = useTranslation();
  const c = useColors();
  const [entry, setEntry] = useState<DailyEntry | null | undefined>(undefined);
  const [body, setBody] = useState('');
  const [tags, setTags] = useState<ActivityTag[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'neutral'; text: string } | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const today = (await loadGroupEntries(group.id)).find((e) => e.date === group.today) ?? null;
      setEntry(today);
      setBody(today?.body ?? '');
      setTags(today?.tags ?? []);
      setFailed(false);
    } catch (e) {
      if (!onSessionExpired(e)) setFailed(true);
    }
  }, [group.id, group.today, onSessionExpired]);
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

  const save = async (publish: boolean) => {
    setBusy(true);
    setMessage(null);
    try {
      await saveDailyEntry(group.id, body, tags, publish);
      await load();
      setMessage({ tone: 'neutral', text: t(publish || entry?.status === 'published' ? 'daily.published' : 'daily.saved') });
    } catch (e) {
      if (onSessionExpired(e)) return;
      const code = businessCode(e);
      setMessage({ tone: 'error', text: code ? t(`errors.${code}`) : t('daily.saveError') });
    } finally {
      setBusy(false);
    }
  };

  const published = entry?.status === 'published';
  const valid = body.trim().length > 0 && body.length <= DAILY_ENTRY_MAX;
  return (
    <ScrollView contentContainerStyle={shellStyles.screen} keyboardShouldPersistTaps="handled">
      <Button variant="secondary" label={t('daily.back')} onPress={onBack} />
      <View style={styles.header}>
        <Text accessibilityRole="header" style={[shellStyles.title, { color: c.textPrimary }]}>
          {t('daily.title')}
        </Text>
        <Text style={[shellStyles.meta, { color: c.textSecondary }]}>{`${group.name} · ${formatLongDate(new Date(`${group.today}T12:00:00Z`))}`}</Text>
      </View>
      {failed ? (
        <View style={shellStyles.section}>
          <Notice tone="error" title={t('daily.loadError')} />
          <Button variant="secondary" label={t('common.retry')} onPress={() => void load()} />
        </View>
      ) : entry === undefined ? (
        <ActivityIndicator color={c.accent} accessibilityLabel={t('common.loading')} />
      ) : (
        <>
          <Notice title={t('daily.warning')} />
          {published && entry ? (
            <Text style={[shellStyles.meta, { color: c.textSecondary }]}>
              {[t('daily.publishedAt', { time: formatTime(new Date(entry.publishedAt!)) }), entry.edited ? t('notices.edited') : null].filter(Boolean).join(' · ')}
            </Text>
          ) : entry ? (
            <Text style={[shellStyles.meta, { color: c.textSecondary }]}>{t('daily.draft')}</Text>
          ) : null}
          <TextField label={t('daily.bodyLabel')} value={body} onChangeText={setBody} multiline maxLength={DAILY_ENTRY_MAX} />
          <Text style={[shellStyles.meta, { color: c.textSecondary }]} accessibilityLabel={t('daily.countLabel', { count: body.length, max: DAILY_ENTRY_MAX })}>
            {`${body.length} / ${DAILY_ENTRY_MAX}`}
          </Text>
          <View style={styles.row} accessibilityLabel={t('daily.tagsLabel')}>
            {activityTags.map((tag) => {
              const on = tags.includes(tag);
              return (
                <Pressable
                  key={tag}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  onPress={() => setTags((x) => (on ? x.filter((y) => y !== tag) : [...x, tag]))}
                  style={[styles.chip, { borderColor: c.borderControl, backgroundColor: on ? c.accentSoft : c.bgSurface }]}
                >
                  <Text style={[styles.chipText, { color: on ? c.textAccent : c.textPrimary }]}>{t(`daily.tags.${tag}`)}</Text>
                </Pressable>
              );
            })}
          </View>
          {message ? <Notice tone={message.tone} title={message.text} /> : null}
          <Button label={t(published ? 'daily.saveEdit' : 'daily.publish')} disabled={!valid || busy} onPress={() => void save(true)} />
          {!published ? <Button variant="secondary" label={t('daily.saveDraft')} disabled={!valid || busy} onPress={() => void save(false)} /> : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { gap: space[1] },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  chip: { minHeight: 44, justifyContent: 'center', borderWidth: 1.5, borderRadius: radius.pill, paddingHorizontal: space[3] },
  chipText: { fontSize: type.footnote.size, fontWeight: '600' },
});
