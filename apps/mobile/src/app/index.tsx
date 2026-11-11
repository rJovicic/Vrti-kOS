import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSession } from '../lib/session';
import { useColors } from '../ui/theme';

/** Entry: waits for the stored session (keychain), then routes to sign-in or home. */
export default function Index() {
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
  return <Redirect href={session ? '/home' : '/sign-in'} />;
}
