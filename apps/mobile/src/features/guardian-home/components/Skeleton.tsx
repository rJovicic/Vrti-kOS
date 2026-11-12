import { StyleSheet, View } from 'react-native';
import { radius, space } from '@vrticos/tokens';
import { useColors } from '../../../ui/theme';
import { raised } from './surface';

// Static placeholders (no shimmer): calm by design and nothing to disable for reduced motion (spec §8).
function Bar({ width, height = 14 }: { width: `${number}%`; height?: number }) {
  const c = useColors();
  return <View style={{ width, height, borderRadius: radius.sm, backgroundColor: c.bgSunken }} />;
}

export function ChildCardSkeleton() {
  const c = useColors();
  return (
    <View style={[styles.card, raised, { backgroundColor: c.bgSurface, borderColor: c.borderSubtle }]}>
      <Bar width="55%" height={20} />
      <Bar width="70%" />
      <Bar width="40%" />
      <Bar width="45%" height={22} />
      <View style={{ height: 48, borderRadius: radius.md, backgroundColor: c.bgSunken }} />
    </View>
  );
}

export function ActivityRowSkeleton({ first }: { first: boolean }) {
  const c = useColors();
  return (
    <View style={[styles.row, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.borderSubtle }]}>
      <Bar width="65%" />
      <Bar width="40%" />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, padding: space[4], gap: space[3] },
  row: { minHeight: 64, justifyContent: 'center', gap: space[2], paddingHorizontal: space[4] },
});
