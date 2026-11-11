import { StyleSheet, Text, View } from 'react-native';
import { radius, space, type } from '@vrticos/tokens';
import { useColors } from './theme';

/** Calm state message (empty, error, info). Text only — no illustrations (design direction). */
export function Notice({ title, body, tone = 'neutral' }: { title: string; body?: string; tone?: 'neutral' | 'error' }) {
  const c = useColors();
  const bg = tone === 'error' ? c.dangerBg : c.bgSurface;
  const fg = tone === 'error' ? c.dangerFg : c.textPrimary;
  return (
    <View accessibilityRole={tone === 'error' ? 'alert' : 'text'} style={[styles.box, { backgroundColor: bg, borderColor: c.borderSubtle }]}>
      <Text style={[styles.title, { color: fg }]}>{title}</Text>
      {body ? <Text style={[styles.body, { color: tone === 'error' ? fg : c.textSecondary }]}>{body}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: radius.lg, padding: space[4], gap: space[1] },
  title: { fontSize: type.bodyStrong.size, lineHeight: type.bodyStrong.lineHeight, fontWeight: type.bodyStrong.weight },
  body: { fontSize: type.footnote.size, lineHeight: type.footnote.lineHeight },
});
