import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { space, type } from '@vrticos/tokens';
import { signOut } from '../lib/session';
import { Button } from '../ui/Button';
import { Notice } from '../ui/Notice';
import { useColors } from '../ui/theme';
import type { ShellGate } from './access';

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
  const content =
    gate.kind === 'error'
      ? { tone: 'error' as const, title: t('shell.loadError'), body: t('mobile.loadErrorHelp') }
      : gate.kind === 'noMembership'
        ? { tone: 'neutral' as const, title: t('shell.noMembership'), body: t('shell.noMembershipHelp') }
        : {
            tone: 'neutral' as const,
            title: t('shell.noticeRequired'),
            body: t('shell.noticeRequiredHelp', { kindergartens: gate.kindergartens.map((k) => k.name).join(', ') }),
          };
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
});

const styles = StyleSheet.create({
  ...shellStyles,
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
