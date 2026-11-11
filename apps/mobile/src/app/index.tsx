import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { radius, space, touchTarget, type } from '@vrticos/tokens';
import { env } from '../lib/env';
import { useColors } from '../ui/theme';

type Health = 'checking' | 'ok' | 'down';

/**
 * D0 shell: confirms the app reaches the local Supabase stack. Feature screens arrive in D1–D4
 * (docs/architecture/mobile-app.md). No personal data is shown or fetched here.
 */
export default function StatusScreen() {
  const { t } = useTranslation();
  const c = useColors();
  const [health, setHealth] = useState<Health>('checking');

  const check = useCallback(async () => {
    setHealth('checking');
    try {
      const res = await fetch(`${env.supabaseUrl}/auth/v1/health`, {
        headers: { apikey: env.supabasePublishableKey },
      });
      setHealth(res.ok ? 'ok' : 'down');
    } catch {
      setHealth('down');
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  return (
    <View style={[styles.screen, { backgroundColor: c.bgCanvas }]}>
      <Text accessibilityRole="header" style={[styles.title, { color: c.textPrimary }]}>
        {t('common.appName')}
      </Text>
      <Text style={[styles.subtitle, { color: c.textSecondary }]}>{t('health.title')}</Text>
      <View
        accessibilityLiveRegion="polite"
        style={[
          styles.card,
          { backgroundColor: health === 'down' ? c.dangerBg : health === 'ok' ? c.statePresentBg : c.bgSurface, borderColor: c.borderSubtle },
        ]}
      >
        {health === 'checking' ? (
          <ActivityIndicator color={c.accent} accessibilityLabel={t('common.loading')} />
        ) : (
          <Text style={[styles.body, { color: health === 'ok' ? c.statePresentFg : c.dangerFg }]}>
            {health === 'ok' ? t('health.apiOk') : t('health.apiDown')}
          </Text>
        )}
      </View>
      {health === 'down' ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => void check()}
          style={({ pressed }) => [styles.button, { backgroundColor: pressed ? c.accentPressed : c.accent }]}
        >
          <Text style={[styles.buttonText, { color: c.textOnAccent }]}>{t('common.retry')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: space[6], gap: space[3] },
  title: { fontSize: type.title1.size, lineHeight: type.title1.lineHeight, fontWeight: type.title1.weight, letterSpacing: type.title1.tracking },
  subtitle: { fontSize: type.body.size, lineHeight: type.body.lineHeight },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: space[4], minHeight: touchTarget.attendanceTag, justifyContent: 'center' },
  body: { fontSize: type.body.size, lineHeight: type.body.lineHeight },
  button: { minHeight: touchTarget.android, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space[5] },
  buttonText: { fontSize: type.label.size, fontWeight: type.label.weight },
});
