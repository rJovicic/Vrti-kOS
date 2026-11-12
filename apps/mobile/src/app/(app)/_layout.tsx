import { Tabs } from 'expo-router';
import { Platform, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { type } from '@vrticos/tokens';
import { useSession } from '../../lib/session';
import { ShellProvider, useShell } from '../../shell/ShellProvider';
import { GateScreen } from '../../shell/ShellScreens';
import { navigationLayout, tabAllowed, type TabName } from '../../shell/navigation';
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
  // Tabs of the other mode are not offered (`href: null`); each role screen also guards itself (ModeGuard).
  const tab = (name: TabName, key: string) => ({
    title: t(key),
    tabBarLabel: t(key),
    tabBarAccessibilityLabel: t(key),
    ...(tabAllowed(name, mode) ? {} : { href: null }),
  });
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
      <Tabs.Screen name="today" options={tab('today', 'nav.today')} />
      <Tabs.Screen name="attendance" options={tab('attendance', 'nav.attendance')} />
      <Tabs.Screen name="index" options={tab('home', 'nav.home')} />
      <Tabs.Screen name="messages" options={tab('messages', 'nav.messages')} />
      <Tabs.Screen name="info" options={tab('info', 'nav.home')} />
      <Tabs.Screen name="profile" options={tab('profile', 'nav.profile')} />
    </Tabs>
  );
}
