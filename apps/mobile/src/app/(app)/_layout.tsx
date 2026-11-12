import { Tabs } from 'expo-router';
import { Platform, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { type } from '@vrticos/tokens';
import { useSession } from '../../lib/session';
import { ShellProvider, useShell } from '../../shell/ShellProvider';
import { GateScreen } from '../../shell/ShellScreens';
import { navigationLayout, tabAllowed } from '../../shell/navigation';
import { useColors } from '../../ui/theme';

/** Signed-in shell: memberships → (notice) → role-based tabs. Rendered only while a session exists (root guard). */
export default function AppLayout() {
  const { session } = useSession();
  if (!session) return null;
  return (
    <ShellProvider key={session.user.id} userId={session.user.id}>
      <AppTabs />
    </ShellProvider>
  );
}

function AppTabs() {
  const { gate, mode, reload } = useShell();
  const { t } = useTranslation();
  const c = useColors();
  const { width } = useWindowDimensions();
  if (gate.kind !== 'ready') return <GateScreen gate={gate} onRetry={reload} />;

  const layout = navigationLayout(width, Platform.OS);
  const label = (key: string) => ({ title: t(key), tabBarLabel: t(key), tabBarAccessibilityLabel: t(key) });
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarPosition: layout.position,
        tabBarVariant: layout.variant,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.textSecondary,
        tabBarStyle: { backgroundColor: c.bgSurface, borderColor: c.borderSubtle },
        tabBarLabelStyle: { fontSize: type.footnote.size, fontWeight: '600' },
        tabBarIcon: () => null,
        sceneStyle: { backgroundColor: c.bgCanvas },
      }}
    >
      {/* `index` only redirects to the landing tab of the current mode; never a tab itself. */}
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Protected guard={tabAllowed('today', mode)}>
        <Tabs.Screen name="today" options={label('nav.today')} />
        <Tabs.Screen name="attendance" options={label('nav.attendance')} />
      </Tabs.Protected>
      <Tabs.Protected guard={tabAllowed('home', mode)}>
        <Tabs.Screen name="home" options={label('nav.home')} />
        <Tabs.Screen name="messages" options={label('nav.messages')} />
      </Tabs.Protected>
      <Tabs.Protected guard={tabAllowed('info', mode)}>
        <Tabs.Screen name="info" options={label('nav.home')} />
      </Tabs.Protected>
      <Tabs.Screen name="profile" options={label('nav.profile')} />
    </Tabs>
  );
}
