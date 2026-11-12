import { StyleSheet, View } from 'react-native';
import type { StatusIcon as Icon } from '../model/present';

/** Small geometric icons drawn with Views (no icon package). Decorative: the status text carries the meaning. */
export function StatusIcon({ icon, color }: { icon: Icon; color: string }) {
  return (
    <View style={styles.box} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {icon === 'check' ? <View style={[styles.check, { borderColor: color }]} /> : null}
      {icon === 'ring' ? <View style={[styles.ring, { borderColor: color }]} /> : null}
      {icon === 'dash' ? (
        <View style={[styles.ring, styles.center, { borderColor: color }]}>
          <View style={[styles.dash, { backgroundColor: color }]} />
        </View>
      ) : null}
      {icon === 'calendar' ? (
        <View style={[styles.calendar, { borderColor: color }]}>
          <View style={[styles.calendarBar, { backgroundColor: color }]} />
        </View>
      ) : null}
      {icon === 'arrow' ? (
        <View style={styles.center}>
          <View style={[styles.arrowLine, { backgroundColor: color }]} />
          <View style={[styles.arrowHead, { borderColor: color }]} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: 14, height: 14, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  check: { width: 6, height: 10, borderRightWidth: 2, borderBottomWidth: 2, transform: [{ rotate: '45deg' }], marginTop: -3 },
  ring: { width: 12, height: 12, borderRadius: 6, borderWidth: 1.5 },
  dash: { width: 6, height: 1.5 },
  calendar: { width: 12, height: 12, borderRadius: 2, borderWidth: 1.5, overflow: 'hidden' },
  calendarBar: { height: 3 },
  arrowLine: { width: 10, height: 1.5 },
  arrowHead: { position: 'absolute', right: 0, width: 6, height: 6, borderTopWidth: 1.5, borderRightWidth: 1.5, transform: [{ rotate: '45deg' }] },
});
