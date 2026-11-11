import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { radius, space, touchTarget, type } from '@vrticos/tokens';
import { useColors } from './theme';

export function TextField({ label, ...input }: { label: string } & TextInputProps) {
  const c = useColors();
  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: c.textPrimary }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={c.textTertiary}
        style={[styles.input, { color: c.textPrimary, backgroundColor: c.bgSurface, borderColor: c.borderControl }]}
        {...input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[1] },
  label: { fontSize: type.footnote.size, lineHeight: type.footnote.lineHeight, fontWeight: '600' },
  input: { minHeight: touchTarget.android, borderWidth: 1.5, borderRadius: radius.md, paddingHorizontal: space[3], fontSize: type.body.size },
});
