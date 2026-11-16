import { StyleSheet, Text, View } from 'react-native';
import { radius, space, type } from '@vrticos/tokens';
import { useColors } from './theme';

/**
 * Calm state message (empty, error, info). Text only — no illustrations (design direction). `announce` marks the result
 * of an action (saved, sent, refused): screen readers read it when it appears (D5 audit; errors are always announced).
 */
export function Notice({ title, body, tone = 'neutral', announce = false }: { title: string; body?: string; tone?: 'neutral' | 'error'; announce?: boolean }) {
  const c = useColors();
  const bg = tone === 'error' ? c.dangerBg : c.bgSurface;
  const fg = tone === 'error' ? c.dangerFg : c.textPrimary;
  const live = tone === 'error' || announce;
  return (
    <View
      accessibilityRole={live ? 'alert' : 'text'}
      accessibilityLiveRegion={tone === 'error' ? 'assertive' : announce ? 'polite' : 'none'}
      style={[styles.box, { backgroundColor: bg, borderColor: c.borderSubtle }]}
    >
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
