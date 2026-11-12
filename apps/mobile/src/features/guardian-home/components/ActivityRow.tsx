import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { radius, space, type } from '@vrticos/tokens';
import { useColors } from '../../../ui/theme';
import type { HomeActivity } from '../model/types';

/** A row in "Danas": published daily report or announcement (spec §5). No chevron without a destination. */
export function ActivityRow({ activity, onOpen, first }: { activity: HomeActivity; onOpen?: () => void; first: boolean }) {
  const { t } = useTranslation();
  const c = useColors();
  const title = activity.kind === 'dailyReport' ? t('guardianHome.dailyReport', { group: activity.groupName }) : activity.title;
  const meta =
    activity.kind === 'dailyReport'
      ? `${activity.organizationName} · ${t('guardianHome.publishedAt', { time: activity.publishedTime })}`
      : activity.organizationName;
  const unread = activity.kind === 'announcement' && activity.isUnread;
  const label = [title, meta, unread ? t('guardianHome.newBadge') : null].filter(Boolean).join('. ');
  const body = (
    <>
      <View style={styles.text}>
        <Text style={[styles.title, { color: c.textPrimary }]}>{title}</Text>
        <Text style={[styles.meta, { color: c.textSecondary }]}>{meta}</Text>
      </View>
      {unread ? <Text style={[styles.badge, { backgroundColor: c.infoBg, color: c.infoFg }]}>{t('guardianHome.newBadge')}</Text> : null}
      {onOpen ? <Text style={[styles.chevron, { color: c.textTertiary }]}>›</Text> : null}
    </>
  );
  const rowStyle = [styles.row, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.borderSubtle }];
  return onOpen ? (
    <Pressable accessibilityRole="link" accessibilityLabel={label} onPress={onOpen} style={rowStyle}>
      {body}
    </Pressable>
  ) : (
    <View accessible accessibilityLabel={label} style={rowStyle}>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 64, paddingVertical: space[3], paddingHorizontal: space[4] },
  text: { flex: 1, gap: 2 },
  title: { fontSize: type.bodyStrong.size, lineHeight: type.bodyStrong.lineHeight, fontWeight: type.bodyStrong.weight },
  meta: { fontSize: type.footnote.size, lineHeight: type.footnote.lineHeight, fontVariant: ['tabular-nums'] },
  badge: { borderRadius: radius.pill, overflow: 'hidden', paddingHorizontal: space[2] + 2, paddingVertical: 2, fontSize: type.caption.size, lineHeight: type.caption.lineHeight, fontWeight: type.caption.weight },
  chevron: { fontSize: type.title3.size },
});
