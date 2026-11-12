import '../lib/i18n';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { SessionProvider, useSession } from '../lib/session';
import { DemoBanner } from '../ui/DemoBanner';
import { useColors } from '../ui/theme';

/**
 * Root of the app shell (D1-10). Authentication decides which branch exists at all: signed out → only `sign-in`;
 * signed in → only the `(app)` group (memberships, notice and role are checked there). Deep links into a branch
 * that is not allowed are redirected by expo-router's protected routes, never rendered.
 */
function RootNavigator() {
  const { session, ready } = useSession();
  const { t } = useTranslation();
  const c = useColors();
  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={c.accent} accessibilityLabel={t('common.loading')} />
      </View>
    );
  }
  const signedIn = session !== null;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bgCanvas } }}>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
      <Stack.Screen name="dev/parent-home" />
    </Stack>
  );
}

export default function RootLayout() {
  const c = useColors();
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.bgCanvas }}>
          <DemoBanner />
          <RootNavigator />
        </SafeAreaView>
      </SessionProvider>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
