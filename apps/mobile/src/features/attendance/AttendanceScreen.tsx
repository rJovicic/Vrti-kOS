import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { nextAction, type AttendanceState } from '@vrticos/domain';
import { formatLongDate, formatTime } from '@vrticos/i18n';
import type { ColorRoles } from '@vrticos/tokens';
import { radius, space, type } from '@vrticos/tokens';
import { businessCode, loadGroupDay, recordAttendance, undoAttendance, type AttendanceTile, type GroupDay } from '../../lib/attendance';
import { newCorrelationId } from '../../lib/correlation';
import type { HomeGroup } from '../../lib/home';
import { Button } from '../../ui/Button';
import { Notice } from '../../ui/Notice';
import { useColors } from '../../ui/theme';

/** Undo window (FR-05-5): the server enforces the same 10 seconds. */
export const UNDO_WINDOW_MS = 10_000;

type Filter = 'all' | 'expected' | 'present' | 'departed';
interface Snack {
  text: string;
  undo?: { recordId: string; name: string; kind: 'check_in' | 'check_out' };
}

function tone(c: ColorRoles, state: AttendanceState) {
  switch (state) {
    case 'present':
      return { bg: c.statePresentBg, fg: c.statePresentFg, border: c.statePresentBg };
    case 'departed':
      return { bg: c.stateDepartedBg, fg: c.stateDepartedFg, border: c.stateDepartedBg };
    case 'absent':
      return { bg: c.stateAbsentBg, fg: c.stateAbsentFg, border: c.stateAbsentBg };
    default:
      return { bg: c.stateExpectedBg, fg: c.stateExpectedFg, border: c.stateExpectedBorder };
  }
}

export interface AttendanceScreenProps {
  groups: HomeGroup[];
  /** Ends the session on 401 (handled by the route). */
  onSessionExpired: (error: unknown) => boolean;
  now?: () => Date;
}

/**
 * Educator attendance (FS-05, prototype "Evidencija dolazaka"): one tap per child, no "all present" (FR-05-6), undo for
 * 10 s (FR-05-5), confirmation before recording a child with a reported absence (FR-05-7), conflict → current state
 * (FR-05-8). Online in this package; the offline queue follows in D3-E.
 */
export function AttendanceScreen({ groups, onSessionExpired, now = () => new Date() }: AttendanceScreenProps) {
  const { t } = useTranslation();
  const c = useColors();
  const [groupId, setGroupId] = useState(groups[0]?.id ?? null);
  const [day, setDay] = useState<GroupDay | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [confirm, setConfirm] = useState<AttendanceTile | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [snack, setSnack] = useState<Snack | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const group = groups.find((g) => g.id === groupId) ?? null;

  const load = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    const correlationId = newCorrelationId();
    try {
      setDay(await loadGroupDay(groupId, correlationId));
      setLoadError(null);
    } catch (e) {
      if (!onSessionExpired(e)) setLoadError(correlationId);
    } finally {
      setLoading(false);
    }
  }, [groupId, onSessionExpired]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => () => (undoTimer.current ? clearTimeout(undoTimer.current) : undefined), []);

  const showSnack = (next: Snack) => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setSnack(next);
    // After the window the undo action disappears; the confirmation text stays until the next action.
    if (next.undo) undoTimer.current = setTimeout(() => setSnack((s) => (s ? { text: s.text } : s)), UNDO_WINDOW_MS);
  };

  const fail = async (e: unknown) => {
    if (onSessionExpired(e)) return;
    const code = businessCode(e);
    setNotice(code ? t(`errors.${code}`) : t('attendance.saveError'));
    await load();
  };

  const perform = async (tile: AttendanceTile, kind: 'check_in' | 'check_out') => {
    setConfirm(null);
    setNotice(null);
    setBusy(tile.childId);
    try {
      const r = await recordAttendance(tile.childId, kind);
      const time = formatTime(new Date(r.occurredAt));
      showSnack({
        text: t(kind === 'check_in' ? 'attendance.savedCheckIn' : 'attendance.savedCheckOut', { name: tile.displayName, time }),
        undo: { recordId: r.recordId, name: tile.displayName, kind },
      });
      await load();
    } catch (e) {
      await fail(e);
    } finally {
      setBusy(null);
    }
  };

  const undo = async (u: NonNullable<Snack['undo']>) => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setSnack(null);
    try {
      await undoAttendance(u.recordId);
      showSnack({ text: t(u.kind === 'check_in' ? 'attendance.undoneCheckIn' : 'attendance.undoneCheckOut', { name: u.name }) });
      await load();
    } catch (e) {
      await fail(e);
    }
  };

  const tap = (tile: AttendanceTile) => {
    const action = nextAction(tile.state);
    if (action === 'confirm_check_in') return setConfirm(tile);
    if (action) void perform(tile, action);
  };

  if (!groups.length) {
    return (
      <View style={styles.screen}>
        <Notice title={t('attendance.noGroupToday')} body={t('attendance.noGroupTodayHelp')} />
      </View>
    );
  }

  const tiles = day?.tiles ?? [];
  const count = (s: AttendanceState) => tiles.filter((x) => x.state === s).length;
  const shown = filter === 'all' ? tiles : tiles.filter((x) => x.state === filter);
  const filters: { key: Filter; label: string; n: number }[] = [
    { key: 'all', label: t('attendance.filterAll'), n: tiles.length },
    { key: 'expected', label: t('attendance.expected'), n: count('expected') },
    { key: 'present', label: t('attendance.present'), n: count('present') },
    { key: 'departed', label: t('attendance.departed'), n: count('departed') },
  ];
  const statusText = (x: AttendanceTile) =>
    x.state === 'present' && x.time
      ? t('attendance.presentSince', { time: formatTime(new Date(x.time)) })
      : x.state === 'departed' && x.time
        ? t('attendance.departedAt', { time: formatTime(new Date(x.time)) })
        : t(`attendance.${x.state}`);

  return (
    <View style={{ flex: 1, backgroundColor: c.bgCanvas }}>
      <ScrollView contentContainerStyle={styles.screen} refreshControl={<RefreshControl refreshing={loading && day !== null} onRefresh={() => void load()} />}>
        <View style={styles.header}>
          <Text accessibilityRole="header" style={[styles.title, { color: c.textPrimary }]}>
            {group?.name}
          </Text>
          <Text style={[styles.meta, { color: c.textSecondary }]}>{[formatLongDate(now()), group?.facility].filter(Boolean).join(' · ')}</Text>
        </View>

        {groups.length > 1 ? (
          <View style={styles.row} accessibilityRole="tablist" accessibilityLabel={t('attendance.groupPicker')}>
            {groups.map((g) => (
              <Pressable
                key={g.id}
                accessibilityRole="tab"
                accessibilityState={{ selected: g.id === groupId }}
                onPress={() => {
                  setGroupId(g.id);
                  setDay(null);
                }}
                style={[styles.chip, { borderColor: c.borderControl, backgroundColor: g.id === groupId ? c.accentSoft : c.bgSurface }]}
              >
                <Text style={[styles.chipText, { color: g.id === groupId ? c.textAccent : c.textPrimary }]}>{g.name}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {loadError ? (
          <View style={styles.section}>
            <Notice tone="error" title={t('attendance.loadError')} body={t('attendance.reference', { ref: loadError })} />
            <Button variant="secondary" label={t('common.retry')} onPress={() => void load()} />
          </View>
        ) : null}

        {loading && day === null && !loadError ? <ActivityIndicator color={c.accent} accessibilityLabel={t('common.loading')} /> : null}

        {day && !loadError ? (
          <>
            <View style={styles.row} accessibilityRole="tablist" accessibilityLabel={t('attendance.filterLabel')}>
              {filters.map((f) => (
                <Pressable
                  key={f.key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: filter === f.key }}
                  accessibilityLabel={`${f.label}: ${f.n}`}
                  onPress={() => setFilter(f.key)}
                  style={[styles.chip, { borderColor: c.borderControl, backgroundColor: filter === f.key ? c.accentSoft : c.bgSurface }]}
                >
                  <Text style={[styles.chipText, { color: filter === f.key ? c.textAccent : c.textPrimary }]}>
                    {f.n} {f.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {notice ? <Notice tone="error" title={notice} /> : null}

            {confirm ? (
              <View style={[styles.confirm, { backgroundColor: c.bgSurface, borderColor: c.borderControl }]} accessibilityRole="alert">
                <Text style={[styles.confirmTitle, { color: c.textPrimary }]}>{t('attendance.confirmAbsentTitle', { name: confirm.fullName })}</Text>
                <Text style={[styles.meta, { color: c.textSecondary }]}>{t('attendance.confirmAbsentBody')}</Text>
                <View style={styles.row}>
                  <Button label={t('attendance.confirmCheckIn')} onPress={() => void perform(confirm, 'check_in')} />
                  <Button variant="secondary" label={t('attendance.cancel')} onPress={() => setConfirm(null)} />
                </View>
              </View>
            ) : null}

            {tiles.length === 0 ? <Notice title={t('mobile.groupEmpty')} /> : null}

            <View style={styles.wall}>
              {shown.map((x) => {
                const k = tone(c, x.state);
                const action = nextAction(x.state);
                const hint = x.state === 'departed' ? t('attendance.tileHintDeparted') : x.state === 'present' ? t('attendance.tapToCheckOut') : t('attendance.tapToCheckIn');
                return (
                  <Pressable
                    key={x.childId}
                    accessibilityRole="button"
                    accessibilityLabel={`${x.fullName}. ${statusText(x)}`}
                    accessibilityHint={hint}
                    accessibilityState={{ disabled: action === null || busy !== null, busy: busy === x.childId }}
                    disabled={action === null || busy !== null}
                    onPress={() => tap(x)}
                    style={[styles.tile, { backgroundColor: k.bg, borderColor: k.border }]}
                  >
                    <Text style={[styles.tileName, { color: c.textPrimary }]}>{x.displayName}</Text>
                    <Text style={[styles.tileStatus, { color: k.fg }]}>{statusText(x)}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={[styles.meta, { color: c.textSecondary }]}>{t('attendance.allSaved', { time: formatTime(day.loadedAt) })}</Text>
          </>
        ) : null}
      </ScrollView>

      {snack ? (
        <View style={[styles.snack, { backgroundColor: c.textPrimary }]} accessibilityLiveRegion="polite" accessibilityRole="alert">
          <Text style={[styles.snackText, { color: c.bgSurface }]}>{snack.text}</Text>
          {snack.undo ? (
            <Pressable accessibilityRole="button" onPress={() => void undo(snack.undo!)} style={styles.snackAction}>
              <Text style={[styles.snackActionText, { color: c.bgSurface }]}>{t('attendance.undo')}</Text>
            </Pressable>
          ) : (
            <Pressable accessibilityRole="button" onPress={() => setSnack(null)} style={styles.snackAction}>
              <Text style={[styles.snackActionText, { color: c.bgSurface }]}>{t('attendance.close')}</Text>
            </Pressable>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { padding: space[4], gap: space[4], paddingBottom: space[12] },
  header: { gap: space[1] },
  title: { fontSize: type.title2.size, lineHeight: type.title2.lineHeight, fontWeight: type.title2.weight },
  meta: { fontSize: type.footnote.size, lineHeight: type.footnote.lineHeight },
  section: { gap: space[3] },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  chip: { minHeight: 44, justifyContent: 'center', borderWidth: 1.5, borderRadius: radius.pill, paddingHorizontal: space[3] },
  chipText: { fontSize: type.footnote.size, fontWeight: '600' },
  wall: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3] },
  tile: { width: '47%', minHeight: 72, borderWidth: 1.5, borderRadius: radius.lg, padding: space[3], gap: space[1], justifyContent: 'center' },
  tileName: { fontSize: type.bodyStrong.size, lineHeight: type.bodyStrong.lineHeight, fontWeight: type.bodyStrong.weight },
  tileStatus: { fontSize: type.footnote.size, lineHeight: type.footnote.lineHeight, fontWeight: '600' },
  confirm: { borderWidth: 1.5, borderRadius: radius.lg, padding: space[4], gap: space[2] },
  confirmTitle: { fontSize: type.bodyStrong.size, lineHeight: type.bodyStrong.lineHeight, fontWeight: type.bodyStrong.weight },
  snack: { position: 'absolute', left: space[4], right: space[4], bottom: space[4], borderRadius: radius.md, padding: space[3], flexDirection: 'row', alignItems: 'center', gap: space[3] },
  snackText: { flex: 1, fontSize: type.footnote.size, lineHeight: type.footnote.lineHeight },
  snackAction: { minHeight: 44, minWidth: 44, justifyContent: 'center', paddingHorizontal: space[2] },
  snackActionText: { fontSize: type.footnote.size, fontWeight: '700' },
});
