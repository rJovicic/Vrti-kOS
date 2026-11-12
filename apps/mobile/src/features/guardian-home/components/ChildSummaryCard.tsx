import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { radius, space, type } from '@vrticos/tokens';
import { Button } from '../../../ui/Button';
import { useColors } from '../../../ui/theme';
import { actionAvailability, attendanceView, cardAction, childAccessibilityLabel, formatAbsenceRange, groupLine, placeLine } from '../model/present';
import type { ChildSummary, Translate } from '../model/types';
import { AttendanceStatus } from './AttendanceStatus';
import { raised } from './surface';

interface Props {
  child: ChildSummary;
  /** Kindergarten-local date `YYYY-MM-DD`, decides whether an absence still applies. */
  today: string;
  /** Opens the child overview. Omitted until that route exists — then no chevron and no press target (spec §12 P3). */
  onOpen?: () => void;
  /** Opens the FS-06 absence form. Omitted until that screen exists — the button is then disabled with an explanation. */
  onReportAbsence?: () => void;
  /** Opens the child's attendance/absence overview. Omitted until that screen exists — disabled likewise. */
  onReviewAbsence?: () => void;
  actionsEnabled: boolean;
}

/** One child, one card: information block and the absence action are separate targets (spec §4). */
export function ChildSummaryCard({ child, today, onOpen, onReportAbsence, onReviewAbsence, actionsEnabled }: Props) {
  const { t: i18nT } = useTranslation();
  const t: Translate = (key, vars) => i18nT(key, vars ?? {});
  const c = useColors();
  const status = attendanceView(child.attendance.status, child.attendance.time, t);
  const absence =
    child.attendance.status === 'absent' && child.attendance.absenceStart
      ? formatAbsenceRange(child.attendance.absenceStart, child.attendance.absenceEnd)
      : null;
  const action = cardAction(child, today);
  const handler = action === 'report' ? onReportAbsence : action === 'review' ? onReviewAbsence : undefined;
  const availability = actionAvailability(handler !== undefined, actionsEnabled);
  const hint = availability.hintKey ? t(availability.hintKey) : undefined;

  const info = (
    <>
      <View style={styles.titleRow}>
        <Text accessibilityRole="header" style={[styles.name, { color: c.textPrimary }]}>
          {child.firstName} {child.lastName}
        </Text>
        {onOpen ? <Text style={[styles.chevron, { color: c.textTertiary }]}>›</Text> : null}
      </View>
      {/* Spec §4: status directly below the name; the absence range belongs to the status. */}
      <AttendanceStatus view={status} />
      {absence ? <Text style={[styles.meta, { color: c.textSecondary }]}>{t('guardianHome.absenceRange', { range: absence })}</Text> : null}
      <Text style={[styles.meta, { color: c.textSecondary }]}>
        {placeLine(child)}
      </Text>
      <Text style={[styles.meta, { color: c.textSecondary }]}>{groupLine(child, t)}</Text>
    </>
  );
  const label = childAccessibilityLabel(child, status, absence, t);

  return (
    <View style={[styles.card, raised, { backgroundColor: c.bgSurface, borderColor: c.borderSubtle }]}>
      {onOpen ? (
        <Pressable accessibilityRole="link" accessibilityLabel={label} onPress={onOpen} style={styles.info}>
          {info}
        </Pressable>
      ) : (
        <View accessible accessibilityLabel={label} style={styles.info}>
          {info}
        </View>
      )}
      {action ? (
        <View style={styles.action}>
          <Button
            variant="secondary"
            label={action === 'report' ? t('guardianHome.reportAbsence') : t('guardianHome.reviewAbsence')}
            onPress={() => handler?.()}
            disabled={!availability.enabled}
            accessibilityHint={hint}
          />
          {hint ? <Text style={[styles.hint, { color: c.textTertiary }]}>{hint}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, padding: space[4], gap: space[3] },
  info: { gap: space[2] },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space[2] },
  name: { flex: 1, fontSize: type.title3.size, lineHeight: type.title3.lineHeight, fontWeight: type.title3.weight },
  chevron: { fontSize: type.title3.size, lineHeight: type.title3.lineHeight },
  meta: { fontSize: type.footnote.size, lineHeight: type.footnote.lineHeight, fontVariant: ['tabular-nums'] },
  action: { gap: space[1] },
  hint: { fontSize: type.caption.size, lineHeight: type.caption.lineHeight },
});
