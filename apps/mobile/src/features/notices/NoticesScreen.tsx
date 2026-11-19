import { useLiveRefresh } from '../../lib/live';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatDay, formatTime } from '@vrticos/i18n';
import { radius, space, type } from '@vrticos/tokens';
import { newCorrelationId } from '../../lib/correlation';
import { loadNotices, markRead, type NoticeAnnouncement, type Notices } from '../../lib/notices';
import { shellStyles } from '../../shell/ShellScreens';
import { Button } from '../../ui/Button';
import { Notice } from '../../ui/Notice';
import { useColors } from '../../ui/theme';

export interface NoticesScreenProps {
  kindergartens: { id: string; name: string }[];
  /** Educators also see absence reports of their groups (FR-06-5). */
  showAbsences: boolean;
  onSessionExpired: (error: unknown) => boolean;
}

const when = (iso: string) => `${formatDay(iso.slice(0, 10))} ${formatTime(new Date(iso))}`;

/**
 * Notification centre (FS-08, prototype "Obavijesti"): the kindergarten's official announcements the person may read now
 * — computed by the database from current relationships — with "Novo" for unread ones; for educators also the absence
 * reports of their groups. Opening an announcement shows it and marks it read. Push delivery is not part of this (D-40).
 */
export function NoticesScreen({ kindergartens, showAbsences, onSessionExpired }: NoticesScreenProps) {
  const { t } = useTranslation();
  const c = useColors();
  const [data, setData] = useState<Notices | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [open, setOpen] = useState<NoticeAnnouncement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const correlationId = newCorrelationId();
    try {
      setData(await loadNotices(kindergartens, correlationId));
      setLoadError(null);
    } catch (e) {
      if (!onSessionExpired(e)) setLoadError(correlationId);
    } finally {
      setLoading(false);
    }
  }, [kindergartens, onSessionExpired]);

  useEffect(() => {
    void load();
  }, [load]);
  useLiveRefresh(['notification', 'announcement'], () => void load());

  const close = useCallback(() => setOpen(null), []);
  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [open, close]);

  const read = async (ids?: string[]) => {
    if (ids && ids.length === 0) return;
    try {
      await markRead(ids);
      await load();
    } catch (e) {
      onSessionExpired(e);
    }
  };

  const openAnnouncement = (a: NoticeAnnouncement) => {
    setOpen(a);
    void read(a.unreadIds);
  };

  if (open) {
    return (
      <ScrollView contentContainerStyle={shellStyles.screen}>
        <Button variant="secondary" label={t('notices.back')} onPress={close} />
        <View style={shellStyles.section}>
          <Text accessibilityRole="header" style={[shellStyles.title, { color: c.textPrimary }]}>
            {open.title}
          </Text>
          <Text style={[shellStyles.meta, { color: c.textSecondary }]}>
            {[open.kindergarten, when(open.publishedAt), open.edited ? t('notices.edited') : null].filter(Boolean).join(' · ')}
          </Text>
          <Text style={[shellStyles.body, { color: c.textPrimary }]}>{open.body}</Text>
        </View>
      </ScrollView>
    );
  }

  const announcements = data?.announcements ?? [];
  const absences = showAbsences ? (data?.absences ?? []) : [];
  return (
    <ScrollView contentContainerStyle={shellStyles.screen} refreshControl={<RefreshControl refreshing={loading && data !== null} onRefresh={() => void load()} />}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={[shellStyles.title, { color: c.textPrimary }]}>
          {t('notices.title')}
        </Text>
        <Text style={[shellStyles.meta, { color: c.textSecondary }]}>{t('notices.lede')}</Text>
      </View>

      {loadError ? (
        <View style={shellStyles.section}>
          <Notice tone="error" title={t('notices.loadError')} body={t('attendance.reference', { ref: loadError })} />
          <Button variant="secondary" label={t('common.retry')} onPress={() => void load()} />
        </View>
      ) : null}
      {loading && data === null && !loadError ? <ActivityIndicator color={c.accent} accessibilityLabel={t('common.loading')} /> : null}

      {data && !loadError ? (
        <>
          {data.unread > 0 ? <Button variant="secondary" label={t('notices.markAll', { count: data.unread })} onPress={() => void read()} /> : null}

          {absences.length ? (
            <View style={shellStyles.section}>
              <Text accessibilityRole="header" style={[shellStyles.h2, { color: c.textPrimary }]}>
                {t('notices.absences')}
              </Text>
              {absences.map((a) => (
                <Pressable
                  key={a.notificationId}
                  accessibilityRole="button"
                  accessibilityLabel={[
                    a.detail ? t('notices.absenceItem', { name: a.detail.childName, range: range(a.detail.startsOn, a.detail.endsOn) }) : t('notices.unavailable'),
                    a.unread ? t('notices.new') : '',
                  ]
                    .filter(Boolean)
                    .join('. ')}
                  onPress={() => (a.unread ? void read([a.notificationId]) : undefined)}
                  style={[styles.row, { backgroundColor: c.bgSurface, borderColor: c.borderSubtle }]}
                >
                  <View style={styles.rowText}>
                    <Text style={[styles.rowTitle, { color: c.textPrimary }]}>
                      {a.detail ? t('notices.absenceItem', { name: a.detail.childName, range: range(a.detail.startsOn, a.detail.endsOn) }) : t('notices.unavailable')}
                    </Text>
                    <Text style={[shellStyles.meta, { color: c.textSecondary }]}>{when(a.createdAt)}</Text>
                  </View>
                  {a.unread ? <Badge text={t('notices.new')} /> : null}
                </Pressable>
              ))}
            </View>
          ) : null}

          <View style={shellStyles.section}>
            <Text accessibilityRole="header" style={[shellStyles.h2, { color: c.textPrimary }]}>
              {t('notices.announcements')}
            </Text>
            {announcements.length === 0 ? <Notice title={t('notices.empty')} body={t('notices.emptyHelp')} /> : null}
            {announcements.map((a) => (
              <Pressable
                key={a.id}
                accessibilityRole="button"
                accessibilityLabel={[a.title, a.kindergarten, when(a.publishedAt), a.edited ? t('notices.edited') : '', a.unreadIds.length ? t('notices.new') : '']
                  .filter(Boolean)
                  .join('. ')}
                onPress={() => openAnnouncement(a)}
                style={[styles.row, { backgroundColor: c.bgSurface, borderColor: c.borderSubtle }]}
              >
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, { color: c.textPrimary }]}>{a.title}</Text>
                  <Text style={[shellStyles.meta, { color: c.textSecondary }]}>
                    {[a.kindergarten, when(a.publishedAt), a.edited ? t('notices.edited') : null].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                {a.unreadIds.length ? <Badge text={t('notices.new')} /> : null}
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
    </ScrollView>
  );

  function range(from: string, to: string) {
    return from === to ? formatDay(from) : `${formatDay(from)} – ${formatDay(to)}`;
  }
  function Badge({ text }: { text: string }) {
    return (
      <View style={[styles.badge, { backgroundColor: c.accentSoft }]}>
        <Text style={[styles.badgeText, { color: c.textAccent }]}>{text}</Text>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  header: { gap: space[1] },
  row: { minHeight: 56, borderWidth: 1, borderRadius: radius.lg, padding: space[3], flexDirection: 'row', alignItems: 'center', gap: space[3] },
  rowText: { flex: 1, gap: space[1] },
  rowTitle: { fontSize: type.bodyStrong.size, lineHeight: type.bodyStrong.lineHeight, fontWeight: type.bodyStrong.weight },
  badge: { borderRadius: radius.pill, paddingHorizontal: space[2], paddingVertical: space[1] },
  badgeText: { fontSize: type.footnote.size, fontWeight: '700' },
});
