import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { space, type } from '@vrticos/tokens';
import { signOut } from '../lib/session';
import { Button } from '../ui/Button';
import { Notice } from '../ui/Notice';
import { useColors } from '../ui/theme';
import type { PrivacyNotice, ShellGate } from './access';
import { useShell } from './ShellProvider';

/** Full-screen states of the signed-in shell before any tab is shown (loading, error, blocked). */
export function GateScreen({ gate, onRetry }: { gate: Exclude<ShellGate, { kind: 'ready' }>; onRetry: () => void }) {
  const { t } = useTranslation();
  const c = useColors();
  if (gate.kind === 'loading' || gate.kind === 'sessionExpired') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={c.accent} accessibilityLabel={t('common.loading')} />
      </View>
    );
  }
  if (gate.kind === 'noticeRequired') return <NoticeGate />;
  const content =
    gate.kind === 'error'
      ? { tone: 'error' as const, title: t('shell.loadError'), body: t('mobile.loadErrorHelp') }
      : { tone: 'neutral' as const, title: t('shell.noMembership'), body: t('shell.noMembershipHelp') };
  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text accessibilityRole="header" style={[styles.title, { color: c.textPrimary }]}>
        {t('common.appName')}
      </Text>
      <Notice tone={content.tone} title={content.title} body={content.body} />
      {gate.kind === 'error' ? <Button variant="secondary" label={t('common.retry')} onPress={onRetry} /> : null}
      <Button variant="text" label={t('auth.signOut')} onPress={() => void signOut()} />
    </ScrollView>
  );
}

/**
 * FR-01-5 / AC-01-5: the kindergarten's privacy notice is shown in full before any data. Reading is recorded with the
 * version (the database refuses any other version and sets the time); it is not consent. One kindergarten at a time.
 * A demo text is labelled so it cannot be taken for a real legal notice.
 */
function NoticeGate() {
  const { t } = useTranslation();
  const c = useColors();
  const { notices, acknowledge } = useShell();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const notice: PrivacyNotice | undefined = notices[0];
  if (!notice) return null;
  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text accessibilityRole="header" style={[styles.title, { color: c.textPrimary }]}>
        {notice.title}
      </Text>
      {notice.isDemo ? <Notice tone="error" title={t('shell.noticeDemo')} body={t('shell.noticeDemoHelp')} /> : null}
      <Text style={[styles.meta, { color: c.textSecondary }]}>{t('shell.noticeVersion', { version: notice.version })}</Text>
      {notice.body.split(/\n{2,}/).map((paragraph, i) => (
        <Text key={i} style={[styles.body, { color: c.textPrimary }]}>
          {paragraph}
        </Text>
      ))}
      <Text style={[styles.meta, { color: c.textSecondary }]}>{t('shell.noticeNotConsent')}</Text>
      {failed ? <Notice tone="error" title={t('shell.noticeAckFailed')} /> : null}
      <Button
        label={t('shell.noticeAcknowledge')}
        busy={busy}
        onPress={() => {
          setBusy(true);
          setFailed(false);
          void acknowledge(notice.organizationId, notice.version).then((ok) => {
            setBusy(false);
            if (!ok) setFailed(true);
          });
        }}
      />
      <Button variant="text" label={t('auth.signOut')} onPress={() => void signOut()} />
    </ScrollView>
  );
}

/**
 * A destination whose feature does not exist yet. Says so plainly and names the layer that brings it — it never
 * imitates the feature (no sample data, no disabled fake controls).
 */
export function ComingLater({ title, body }: { title: string; body: string }) {
  const c = useColors();
  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text accessibilityRole="header" style={[styles.title, { color: c.textPrimary }]}>
        {title}
      </Text>
      <Notice title={body} />
    </ScrollView>
  );
}

export const shellStyles = StyleSheet.create({
  screen: { padding: space[4], gap: space[6] },
  title: { fontSize: type.title2.size, lineHeight: type.title2.lineHeight, fontWeight: type.title2.weight },
  h2: { fontSize: type.title3.size, lineHeight: type.title3.lineHeight, fontWeight: type.title3.weight },
  meta: { fontSize: type.footnote.size, lineHeight: type.footnote.lineHeight },
  section: { gap: space[3] },
  body: { fontSize: type.body.size, lineHeight: type.body.lineHeight },
});

const styles = StyleSheet.create({
  ...shellStyles,
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
