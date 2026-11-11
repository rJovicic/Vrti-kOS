import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { space, type } from '@vrticos/tokens';
import { isDemo } from '../lib/env';
import { useColors } from './theme';

/** Always-visible synthetic-data marker in demo builds (R-37). */
export function DemoBanner() {
  const { t } = useTranslation();
  const c = useColors();
  if (!isDemo) return null;
  return (
    <View accessibilityRole="text" style={[styles.bar, { backgroundColor: c.demoBg }]}>
      <Text style={[styles.text, { color: c.demoFg }]}>{t('common.demoBanner')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { paddingVertical: space[1], paddingHorizontal: space[4], alignItems: 'center' },
  text: { fontSize: type.caption.size, lineHeight: type.caption.lineHeight, fontWeight: type.caption.weight },
});
