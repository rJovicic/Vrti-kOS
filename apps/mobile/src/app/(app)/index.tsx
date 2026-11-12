import { Redirect } from 'expo-router';
import { useShell } from '../../shell/ShellProvider';
import { landingTab } from '../../shell/navigation';

/** Entry of the signed-in app: the first tab of the current mode (educator: Danas, guardian: Početna). */
export default function AppIndex() {
  const { mode } = useShell();
  return <Redirect href={`/${landingTab(mode)}`} />;
}
