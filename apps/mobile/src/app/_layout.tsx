import '../lib/i18n';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { SessionProvider } from '../lib/session';
import { DemoBanner } from '../ui/DemoBanner';
import { useColors } from '../ui/theme';

export default function RootLayout() {
  const c = useColors();
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.bgCanvas }}>
          <DemoBanner />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bgCanvas } }} />
        </SafeAreaView>
      </SessionProvider>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
