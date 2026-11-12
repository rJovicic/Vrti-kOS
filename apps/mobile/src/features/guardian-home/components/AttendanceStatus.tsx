import { StyleSheet, Text, View } from 'react-native';
import type { ColorRoles } from '@vrticos/tokens';
import { radius, space, type } from '@vrticos/tokens';
import { useColors } from '../../../ui/theme';
import type { StatusTone, StatusView } from '../model/present';
import { StatusIcon } from './StatusIcon';

function toneColors(c: ColorRoles, tone: StatusTone): { bg: string; fg: string; border?: string } {
  switch (tone) {
    case 'present':
      return { bg: c.statePresentBg, fg: c.statePresentFg };
    case 'absent':
      return { bg: c.stateAbsentBg, fg: c.stateAbsentFg };
    case 'departed':
      return { bg: c.stateDepartedBg, fg: c.stateDepartedFg };
    case 'info':
      return { bg: c.infoBg, fg: c.infoFg };
    default:
      return { bg: c.stateExpectedBg, fg: c.stateExpectedFg, border: c.stateExpectedBorder };
  }
}

/** Today's status as a label with icon and text (spec §4: never colour alone). */
export function AttendanceStatus({ view }: { view: StatusView }) {
  const c = useColors();
  const t = toneColors(c, view.tone);
  return (
    <View style={[styles.pill, { backgroundColor: t.bg, borderColor: t.border ?? t.bg }]}>
      <StatusIcon icon={view.icon} color={t.fg} />
      <Text style={[styles.text, { color: t.fg }]}>{view.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1] + 2,
    borderWidth: 1.5,
    borderRadius: radius.tag,
    paddingHorizontal: space[2] + 2,
    paddingVertical: 2,
    maxWidth: '100%',
  },
  text: { flexShrink: 1, fontSize: type.caption.size, lineHeight: type.caption.lineHeight, fontWeight: type.caption.weight, fontVariant: ['tabular-nums'] },
});
