import { useLiveRefresh } from '../../lib/live';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { nextAction, type AttendanceState, type QueuedAttendance } from '@vrticos/domain';
import { formatLongDate, formatTime } from '@vrticos/i18n';
import type { ColorRoles } from '@vrticos/tokens';
import { radius, space, type } from '@vrticos/tokens';
import { loadGroupDay, loadHandoverCandidates, newIdempotencyKey, undoAttendance, type AttendanceTile, type GroupDay, type HandoverCandidate } from '../../lib/attendance';
import { enqueue, flushAttendance, removeFromQueue } from '../../lib/attendanceQueue';
import { newCorrelationId } from '../../lib/correlation';
import type { HomeGroup } from '../../lib/home';
import { Button } from '../../ui/Button';
import { Notice } from '../../ui/Notice';
import { useColors } from '../../ui/theme';

/** Undo window (FR-05-5): the server enforces the same 10 seconds. */
export const UNDO_WINDOW_MS = 10_000;
/** While unsent taps exist, the screen retries this often (and whenever the app comes to the foreground). */
export const RETRY_INTERVAL_MS = 30_000;

type Filter = 'all' | 'expected' | 'present' | 'departed';
interface Snack {
  text: string;
  /** `recordId` for a sent event (server undo), `queuedKey` for a tap not sent yet (removed locally). */
  undo?: { recordId?: string; queuedKey?: string; name: string; kind: 'check_in' | 'check_out' };
}
interface ShownTile extends AttendanceTile {
  pending: boolean;
}
/** D3-H: the handover panel of one child. `candidates` is null while loading; names live only in this state. */
interface HandoverPanel {
  tile: AttendanceTile;
  kind: 'check_in' | 'check_out';
  candidates: HandoverCandidate[] | null;
  failed: boolean;
  notListed: boolean;
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
  userId: string;
  groups: HomeGroup[];
  /** Ends the session on 401 (handled by the route). */
  onSessionExpired: (error: unknown) => boolean;
  now?: () => Date;
}

/**
 * Educator attendance (FS-05, prototype "Evidencija dolazaka"): one tap per child, no "all present" (FR-05-6), undo for
 * 10 s (FR-05-5), confirmation before recording a child with a reported absence (FR-05-7), conflict → current state
 * (FR-05-8). Every tap goes through the encrypted offline queue (D3-E, ADR-0012) and is sent at once when possible.
 */
export function AttendanceScreen({ userId, groups, onSessionExpired, now = () => new Date() }: AttendanceScreenProps) {
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
  const [queue, setQueue] = useState<QueuedAttendance[]>([]);
  const [handover, setHandover] = useState<HandoverPanel | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const group = groups.find((g) => g.id === groupId) ?? null;

  const load = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    const correlationId = newCorrelationId();
    try {
      // Unsent taps go first, in tap order (ADR-0012); the list then shows the server's state.
      setQueue((await flushAttendance(userId)).remaining);
      setDay(await loadGroupDay(groupId, correlationId));
      setLoadError(null);
    } catch (e) {
      if (!onSessionExpired(e)) setLoadError(correlationId);
    } finally {
      setLoading(false);
    }
  }, [groupId, userId, onSessionExpired]);

  useEffect(() => {
    void load();
  }, [load]);
  useLiveRefresh(['attendance'], () => void load());
  // Retry unsent taps when the app returns to the foreground and periodically while any are waiting.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => (s === 'active' ? void load() : undefined));
    return () => sub.remove();
  }, [load]);
  const waiting = queue.some((x) => x.state === 'queued');
  useEffect(() => {
    if (!waiting) return;
    const id = setInterval(() => void load(), RETRY_INTERVAL_MS);
    return () => clearInterval(id);
  }, [waiting, load]);
  useEffect(() => () => (undoTimer.current ? clearTimeout(undoTimer.current) : undefined), []);

  const showSnack = (next: Snack) => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setSnack(next);
    // After the window the undo action disappears; the confirmation text stays until the next action.
    if (next.undo) undoTimer.current = setTimeout(() => setSnack((s) => (s ? { text: s.text } : s)), UNDO_WINDOW_MS);
  };

  const perform = async (tile: AttendanceTile, kind: 'check_in' | 'check_out', person?: HandoverCandidate) => {
    setConfirm(null);
    setHandover(null);
    setNotice(null);
    setBusy(tile.childId);
    const item: QueuedAttendance = {
      key: newIdempotencyKey(),
      childId: tile.childId,
      kind,
      occurredAt: now().toISOString(),
      attempts: 0,
      state: 'queued',
      // Only the kind and id of the person go into the encrypted queue, never the name (SR-MOB-02).
      ...(person ? { handover: { kind: person.kind, id: person.id } } : {}),
    };
    const withPerson = (text: string) => (person ? `${text} · ${t('attendance.handoverBy', { person: person.name })}` : text);
    try {
      await enqueue(userId, item);
      const report = await flushAttendance(userId);
      const result = report.results.get(item.key);
      if (result?.ok) {
        const time = formatTime(new Date(item.occurredAt));
        showSnack({
          text: withPerson(t(kind === 'check_in' ? 'attendance.savedCheckIn' : 'attendance.savedCheckOut', { name: tile.displayName, time })),
          undo: { recordId: result.recordId, name: tile.displayName, kind },
        });
        setQueue(report.remaining);
        await load();
      } else if (result && !result.network) {
        // Refused at once (e.g. another educator was faster): nothing is queued, the current state is shown.
        setQueue(await removeFromQueue(userId, item.key));
        setNotice(t(`errors.${result.code}`));
        await load();
      } else {
        // Not delivered: the tap stays on this device, encrypted, and is sent later (FR-05-8).
        setQueue(report.remaining);
        showSnack({ text: withPerson(t('attendance.queuedSaved', { name: tile.displayName })), undo: { queuedKey: item.key, name: tile.displayName, kind } });
      }
    } finally {
      setBusy(null);
    }
  };

  const undo = async (u: NonNullable<Snack['undo']>) => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setSnack(null);
    const text = t(u.kind === 'check_in' ? 'attendance.undoneCheckIn' : 'attendance.undoneCheckOut', { name: u.name });
    if (u.queuedKey) {
      setQueue(await removeFromQueue(userId, u.queuedKey));
      showSnack({ text });
      return;
    }
    try {
      await undoAttendance(u.recordId!);
      showSnack({ text });
      await load();
    } catch (e) {
      if (onSessionExpired(e)) return;
      const code = (e as { code?: string; message?: string }).code === 'P0001' ? (e as { message: string }).message : null;
      setNotice(code ? t(`errors.${code}`) : t('attendance.saveError'));
      await load();
    }
  };

  const dismissFailed = async (key: string) => setQueue(await removeFromQueue(userId, key));

  /** D3-H (FR-05-3, D-38 b): optional person from the list; restricted guardians are shown with the mark, not hidden. */
  const openHandover = async (tile: AttendanceTile) => {
    const action = nextAction(tile.state);
    if (!action) return;
    const kind = action === 'check_out' ? 'check_out' : 'check_in';
    setConfirm(null);
    setHandover({ tile, kind, candidates: null, failed: false, notListed: false });
    try {
      const candidates = await loadHandoverCandidates(tile.childId);
      setHandover((h) => (h && h.tile.childId === tile.childId ? { ...h, candidates } : h));
    } catch (e) {
      if (onSessionExpired(e)) return;
      setHandover((h) => (h && h.tile.childId === tile.childId ? { ...h, candidates: [], failed: true } : h));
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

  // Server state with unsent taps on top (shown as "Čeka slanje").
  const tiles: ShownTile[] = (day?.tiles ?? []).map((x) => {
    const mine = queue.filter((q) => q.childId === x.childId && q.state === 'queued').sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
    const last = mine.at(-1);
    return last
      ? { ...x, state: last.kind === 'check_in' ? 'present' : 'departed', time: last.occurredAt, pending: true }
      : { ...x, pending: false };
  });
  const queuedCount = queue.filter((q) => q.state === 'queued').length;
  const failed = queue.filter((q) => q.state === 'failed');
  const nameOf = (childId: string) => day?.tiles.find((x) => x.childId === childId)?.displayName ?? '—';
  const count = (s: AttendanceState) => tiles.filter((x) => x.state === s).length;
  const shown = filter === 'all' ? tiles : tiles.filter((x) => x.state === filter);
  const filters: { key: Filter; label: string; n: number }[] = [
    { key: 'all', label: t('attendance.filterAll'), n: tiles.length },
    { key: 'expected', label: t('attendance.expected'), n: count('expected') },
    { key: 'present', label: t('attendance.present'), n: count('present') },
    { key: 'departed', label: t('attendance.departed'), n: count('departed') },
  ];
  const statusText = (x: ShownTile) =>
    (x.pending ? `${t('attendance.pendingSync')} · ` : '') +
    (x.state === 'present' && x.time
      ? t('attendance.presentSince', { time: formatTime(new Date(x.time)) })
      : x.state === 'departed' && x.time
        ? t('attendance.departedAt', { time: formatTime(new Date(x.time)) })
        : t(`attendance.${x.state}`));

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

            {failed.map((f) => (
              <View key={f.key} style={[styles.confirm, { backgroundColor: c.bgSurface, borderColor: c.dangerFg }]} accessibilityRole="alert">
                <Text style={[styles.confirmTitle, { color: c.textPrimary }]}>
                  {t('attendance.notSent', { name: nameOf(f.childId), time: formatTime(new Date(f.occurredAt)) })}
                </Text>
                <Text style={[styles.meta, { color: c.textSecondary }]}>{t(`errors.${f.errorCode ?? 'INTERNAL'}`, { correlationId: '—' })}</Text>
                <Button variant="secondary" label={t('attendance.dismiss')} onPress={() => void dismissFailed(f.key)} />
              </View>
            ))}

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

            {handover ? (
              <View style={[styles.confirm, { backgroundColor: c.bgSurface, borderColor: c.borderControl }]} accessibilityRole="alert">
                <Text accessibilityRole="header" style={[styles.confirmTitle, { color: c.textPrimary }]}>
                  {t(handover.kind === 'check_in' ? 'attendance.handoverTitleIn' : 'attendance.handoverTitleOut', { name: handover.tile.fullName })}
                </Text>
                {handover.kind === 'check_in' && handover.tile.state === 'absent' ? (
                  <Text style={[styles.meta, { color: c.textSecondary }]}>{t('attendance.handoverAbsent')}</Text>
                ) : null}
                {handover.candidates === null ? <ActivityIndicator color={c.accent} accessibilityLabel={t('common.loading')} /> : null}
                {handover.failed ? <Text style={[styles.meta, { color: c.textSecondary }]}>{t('attendance.handoverUnavailable')}</Text> : null}
                {handover.candidates?.length === 0 && !handover.failed ? (
                  <Text style={[styles.meta, { color: c.textSecondary }]}>{t('attendance.handoverEmpty')}</Text>
                ) : null}
                {(handover.candidates ?? []).map((p) => (
                  <Pressable
                    key={`${p.kind}:${p.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={[p.name, t(p.kind === 'guardian' ? 'attendance.handoverGuardian' : 'attendance.handoverPickup'), p.restricted ? `${t('attendance.handoverRestricted')}. ${t('attendance.handoverRestrictedHelp')}` : '']
                      .filter(Boolean)
                      .join(', ')}
                    disabled={busy !== null}
                    onPress={() => void perform(handover.tile, handover.kind, p)}
                    style={[styles.person, { borderColor: p.restricted ? c.warningFg : c.borderControl }]}
                  >
                    <View style={styles.personText}>
                      <Text style={[styles.personName, { color: c.textPrimary }]}>{p.name}</Text>
                      <Text style={[styles.meta, { color: c.textSecondary }]}>
                        {t(p.kind === 'guardian' ? 'attendance.handoverGuardian' : 'attendance.handoverPickup')}
                      </Text>
                      {p.restricted ? <Text style={[styles.meta, { color: c.textSecondary }]}>{t('attendance.handoverRestrictedHelp')}</Text> : null}
                    </View>
                    {p.restricted ? (
                      <View style={[styles.badge, { backgroundColor: c.warningBg }]}>
                        <Text style={[styles.badgeText, { color: c.warningFg }]}>{t('attendance.handoverRestricted')}</Text>
                      </View>
                    ) : null}
                  </Pressable>
                ))}
                {handover.candidates !== null ? (
                  <Button variant="secondary" label={t('attendance.handoverNotListed')} onPress={() => setHandover({ ...handover, notListed: true })} />
                ) : null}
                {handover.notListed ? <Notice title={t('attendance.handoverNotListedHelp')} announce /> : null}
                <View style={styles.row}>
                  <Button variant="secondary" label={t('attendance.handoverWithout')} onPress={() => void perform(handover.tile, handover.kind)} />
                  <Button variant="secondary" label={t('attendance.cancel')} onPress={() => setHandover(null)} />
                </View>
              </View>
            ) : null}

            {tiles.length === 0 ? <Notice title={t('mobile.groupEmpty')} /> : null}
            {tiles.length > 0 ? <Text style={[styles.meta, { color: c.textSecondary }]}>{t('attendance.handoverHint')}</Text> : null}

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
                    onLongPress={() => void openHandover(x)}
                    accessibilityActions={action ? [{ name: 'handover', label: t('attendance.handoverAction') }] : []}
                    onAccessibilityAction={(e) => (e.nativeEvent.actionName === 'handover' ? void openHandover(x) : undefined)}
                    style={[styles.tile, { backgroundColor: k.bg, borderColor: k.border }]}
                  >
                    <Text style={[styles.tileName, { color: c.textPrimary }]}>{x.displayName}</Text>
                    <Text style={[styles.tileStatus, { color: k.fg }]}>{statusText(x)}</Text>
                  </Pressable>
                );
              })}
            </View>
            {queuedCount > 0 ? (
              <View style={styles.section}>
                <Text style={[styles.meta, { color: c.textSecondary }]}>{t('attendance.queued', { count: queuedCount })}</Text>
                <Button variant="secondary" label={t('attendance.sendNow')} onPress={() => void load()} />
              </View>
            ) : (
              <Text style={[styles.meta, { color: c.textSecondary }]}>{t('attendance.allSaved', { time: formatTime(day.loadedAt) })}</Text>
            )}
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
  person: { minHeight: 56, borderWidth: 1.5, borderRadius: radius.md, padding: space[3], flexDirection: 'row', alignItems: 'center', gap: space[3] },
  personText: { flex: 1, gap: space[1] },
  personName: { fontSize: type.bodyStrong.size, lineHeight: type.bodyStrong.lineHeight, fontWeight: type.bodyStrong.weight },
  badge: { borderRadius: radius.pill, paddingHorizontal: space[2], paddingVertical: space[1] },
  badgeText: { fontSize: type.footnote.size, fontWeight: '700' },
  snack: { position: 'absolute', left: space[4], right: space[4], bottom: space[4], borderRadius: radius.md, padding: space[3], flexDirection: 'row', alignItems: 'center', gap: space[3] },
  snackText: { flex: 1, fontSize: type.footnote.size, lineHeight: type.footnote.lineHeight },
  snackAction: { minHeight: 44, minWidth: 44, justifyContent: 'center', paddingHorizontal: space[2] },
  snackActionText: { fontSize: type.footnote.size, fontWeight: '700' },
});
