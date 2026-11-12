import { StyleSheet, Text, View } from 'react-native';
import { radius, space, type } from '@vrticos/tokens';
import { useColors } from '../../../ui/theme';

/** Informational banner at the top of the content (offline). Text only, announced politely. */
export function InlineBanner({ text }: { text: string }) {
  const c = useColors();
  return (
    <View accessibilityRole="text" accessibilityLiveRegion="polite" style={[styles.box, { backgroundColor: c.infoBg }]}>
      <Text style={[styles.text, { color: c.infoFg }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: radius.md, paddingVertical: space[3], paddingHorizontal: space[4] },
  text: { fontSize: type.footnote.size, lineHeight: type.footnote.lineHeight, fontWeight: '600' },
});
