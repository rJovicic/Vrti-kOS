import { Platform, type ViewStyle } from 'react-native';
import { shadow } from '@vrticos/tokens';

/** shadow.raised from packages/tokens expressed for iOS (shadow*) and Android (elevation). */
export const raised: ViewStyle = Platform.select<ViewStyle>({
  ios: { shadowColor: shadow.raised.color, shadowOpacity: 1, shadowRadius: shadow.raised.blur / 2, shadowOffset: { width: shadow.raised.x, height: shadow.raised.y } },
  default: { elevation: 1 },
});
