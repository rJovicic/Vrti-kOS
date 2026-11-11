import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { radius, space, touchTarget, type } from '@vrticos/tokens';
import { useColors } from './theme';

export function Button({ label, onPress, variant = 'primary', busy = false, disabled = false }: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'text';
  busy?: boolean;
  disabled?: boolean;
}) {
  const c = useColors();
  const off = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && { backgroundColor: off ? c.bgSunken : pressed ? c.accentPressed : c.accent },
        variant === 'secondary' && { backgroundColor: c.bgSurface, borderWidth: 1.5, borderColor: c.borderControl },
        variant === 'text' && { minHeight: touchTarget.ios, paddingHorizontal: space[2] },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={variant === 'primary' ? c.textOnAccent : c.accent} />
      ) : (
        <Text style={[styles.label, { color: variant === 'primary' ? (off ? c.textTertiary : c.textOnAccent) : variant === 'text' ? c.textAccent : c.textPrimary }]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: touchTarget.android, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space[5] },
  label: { fontSize: type.label.size, lineHeight: type.label.lineHeight, fontWeight: type.label.weight },
});
