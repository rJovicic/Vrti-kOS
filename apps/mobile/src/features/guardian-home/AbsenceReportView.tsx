import { useEffect, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { orgLocalDate } from '@vrticos/domain';
import { radius, space, type } from '@vrticos/tokens';
import { businessCode } from '../../lib/attendanceKeys';
import { reportAbsence } from '../../lib/guardianHome';
import { shellStyles } from '../../shell/ShellScreens';
import { Button } from '../../ui/Button';
import { Notice } from '../../ui/Notice';
import { useColors } from '../../ui/theme';
import { formatAbsenceRange } from './model/present';

/** Days the form offers: today and the next 30 days (FR-06-1: at most 30 days ahead; the server checks the same). */
export const HORIZON_DAYS = 30;

export const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const dayLabel = (day: string) =>
  new Intl.DateTimeFormat('hr-HR', { weekday: 'short', day: 'numeric', month: 'numeric', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`));
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000) + 1;

/**
 * FS-06 absence report for one child: choose the inclusive range, check the summary, send. No reason field and no
 * free text (FR-06-2). Never queued offline (spec §8): without a connection nothing is sent and nothing is confirmed.
 */
export function AbsenceReportView({ child, onDone, onBack, now = () => new Date() }: {
  child: { id: string; name: string };
  onDone: () => void;
  onBack: () => void;
  now?: () => Date;
}) {
  const { t } = useTranslation();
  const c = useColors();
  const today = orgLocalDate(now());
  const days = Array.from({ length: HORIZON_DAYS + 1 }, (_, i) => addDays(today, i));
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [step, setStep] = useState<'choose' | 'summary'>('choose');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  const chips = (selected: string, onPick: (d: string) => void, min: string, label: string) => (
    <View style={shellStyles.section}>
      <Text style={[styles.label, { color: c.textPrimary }]}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {days
          .filter((d) => d >= min && daysBetween(min, d) <= HORIZON_DAYS + 1)
          .map((d) => (
            <Pressable
              key={d}
              accessibilityRole="radio"
              accessibilityState={{ checked: d === selected }}
              accessibilityLabel={`${label} ${dayLabel(d)}`}
              onPress={() => onPick(d)}
              style={[styles.chip, { borderColor: c.borderControl, backgroundColor: d === selected ? c.accentSoft : c.bgSurface }]}
            >
              <Text style={[styles.chipText, { color: d === selected ? c.textAccent : c.textPrimary }]}>{dayLabel(d)}</Text>
            </Pressable>
          ))}
      </ScrollView>
    </View>
  );

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      await reportAbsence(child.id, from, to);
      onDone();
    } catch (e) {
      const code = businessCode(e);
      const status = (e as { code?: string; status?: number }).code;
      setError(code ? t(`errors.${code}`) : !status ? t('absence.needsConnection') : t('errors.PERMISSION_DENIED'));
      setSending(false);
    }
  };

  const range = formatAbsenceRange(from, to) ?? '';
  return (
    <ScrollView contentContainerStyle={shellStyles.screen}>
      <View style={styles.back}>
        <Button variant="text" label={`‹ ${t('childDetail.back')}`} onPress={onBack} />
      </View>
      <Text accessibilityRole="header" style={[shellStyles.title, { color: c.textPrimary }]}>
        {t('absence.title')}
      </Text>
      <Text style={[shellStyles.meta, { color: c.textSecondary }]}>{child.name}</Text>
      {error ? <Notice tone="error" title={error} /> : null}
      {step === 'choose' ? (
        <>
          {chips(from, (d) => {
            setFrom(d);
            if (to < d) setTo(d);
          }, today, t('absence.from'))}
          {chips(to, setTo, from, t('absence.to'))}
          <Text style={[shellStyles.meta, { color: c.textSecondary }]}>{t('absence.noReasonNote')}</Text>
          <Button label={t('absence.continue')} onPress={() => setStep('summary')} />
        </>
      ) : (
        <View style={[styles.card, { backgroundColor: c.bgSurface, borderColor: c.borderSubtle }]}>
          <Text accessibilityRole="header" style={[styles.label, { color: c.textPrimary }]}>
            {t('absence.summary')}
          </Text>
          <Text style={[styles.summary, { color: c.textPrimary }]}>{t('absence.summaryLine', { name: child.name, range })}</Text>
          <Text style={[shellStyles.meta, { color: c.textSecondary }]}>{t('absence.days', { count: daysBetween(from, to) })}</Text>
          <Button label={t('absence.send')} busy={sending} onPress={() => void send()} />
          <Button variant="secondary" label={t('absence.change')} onPress={() => setStep('choose')} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  back: { alignItems: 'flex-start', marginLeft: -space[2] },
  label: { fontSize: type.bodyStrong.size, lineHeight: type.bodyStrong.lineHeight, fontWeight: type.bodyStrong.weight },
  chips: { gap: space[2], paddingVertical: space[1] },
  chip: { minHeight: 44, minWidth: 64, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderRadius: radius.md, paddingHorizontal: space[3] },
  chipText: { fontSize: type.footnote.size, fontWeight: '600' },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, padding: space[4], gap: space[3] },
  summary: { fontSize: type.body.size, lineHeight: type.body.lineHeight },
});
