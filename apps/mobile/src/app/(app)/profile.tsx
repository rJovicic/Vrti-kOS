import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { PushPreferences } from '../../features/notices/PushPreferences';
import { queueFor } from '../../lib/attendanceQueue';
import { signOut, useSession } from '../../lib/session';
import { useShell } from '../../shell/ShellProvider';
import { shellStyles } from '../../shell/ShellScreens';
import { landingTab, tabPath } from '../../shell/navigation';
import { Button } from '../../ui/Button';
import { Notice } from '../../ui/Notice';
import { useColors } from '../../ui/theme';

/** Profile: who is signed in, kindergartens, switching between educator and guardian mode, sign-out. */
export default function Profile() {
  const { t } = useTranslation();
  const c = useColors();
  const { session } = useSession();
  const { gate, mode, setMode } = useShell();
  const access = gate.kind === 'ready' ? gate.access : null;
  const [unsent, setUnsent] = useState(0);

  // AC-05-5: before a sign-out by choice, warn when attendance taps have not been sent; sign-out wipes them (SR-MOB-02).
  const requestSignOut = async () => {
    const userId = session?.user.id;
    const n = userId ? (await queueFor(userId).load()).length : 0;
    if (n > 0 && unsent === 0) return setUnsent(n);
    await signOut();
  };

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
                // Switch to the new mode's landing tab (a tab switch; Profil stays in the tab history).
                router.navigate(tabPath(landingTab(m)));
              }}
            />
          ))}
        </View>
      ) : null}

      {session && (mode === 'educator' || mode === 'guardian') ? (
        <PushPreferences
          userId={session.user.id}
          types={mode === 'educator' ? ['announcement.published', 'absence.reported', 'message.received'] : ['announcement.published', 'message.received', 'daily_entry.published']}
        />
      ) : null}

      {unsent > 0 ? (
        <View style={shellStyles.section} accessibilityRole="alert">
          <Notice tone="error" title={t('attendance.signOutQueuedTitle')} body={`${t('attendance.queued', { count: unsent })}. ${t('attendance.signOutQueuedBody')}`} />
          <Button label={t('attendance.signOutQueuedConfirm')} onPress={() => void signOut()} />
          <Button variant="secondary" label={t('attendance.cancel')} onPress={() => setUnsent(0)} />
        </View>
      ) : (
        <Button variant="secondary" label={t('auth.signOut')} onPress={() => void requestSignOut()} />
      )}
    </ScrollView>
  );
}
