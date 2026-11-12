import { router } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { signOut, useSession } from '../../lib/session';
import { useShell } from '../../shell/ShellProvider';
import { shellStyles } from '../../shell/ShellScreens';
import { landingTab } from '../../shell/navigation';
import { Button } from '../../ui/Button';
import { useColors } from '../../ui/theme';

/** Profile: who is signed in, kindergartens, switching between educator and guardian mode, sign-out. */
export default function Profile() {
  const { t } = useTranslation();
  const c = useColors();
  const { session } = useSession();
  const { gate, mode, setMode } = useShell();
  const access = gate.kind === 'ready' ? gate.access : null;

  return (
    <ScrollView contentContainerStyle={shellStyles.screen}>
      <Text accessibilityRole="header" style={[shellStyles.title, { color: c.textPrimary }]}>
        {t('mobile.profile')}
      </Text>
      {session?.user.email ? <Text style={[shellStyles.meta, { color: c.textSecondary }]}>{t('mobile.signedInAs', { email: session.user.email })}</Text> : null}

      {access && access.kindergartens.length > 0 ? (
        <View style={shellStyles.section}>
          <Text accessibilityRole="header" style={[shellStyles.h2, { color: c.textPrimary }]}>
            {t('shell.kindergartens')}
          </Text>
          {access.kindergartens.map((k) => (
            <Text key={k.id} style={{ color: c.textPrimary }}>
              {k.name}
            </Text>
          ))}
        </View>
      ) : null}

      {access && access.modes.length > 1 ? (
        <View style={shellStyles.section}>
          <Text accessibilityRole="header" style={[shellStyles.h2, { color: c.textPrimary }]}>
            {t('shell.mode')}
          </Text>
          {access.modes.map((m) => (
            <Button
              key={m}
              variant={m === mode ? 'primary' : 'secondary'}
              label={t(m === 'educator' ? 'shell.modeEducator' : 'shell.modeGuardian')}
              accessibilityHint={m === mode ? t('shell.modeCurrent') : undefined}
              onPress={() => {
                setMode(m);
                router.replace(`/${landingTab(m)}`);
              }}
            />
          ))}
        </View>
      ) : null}

      <Button variant="secondary" label={t('auth.signOut')} onPress={() => void signOut()} />
    </ScrollView>
  );
}
