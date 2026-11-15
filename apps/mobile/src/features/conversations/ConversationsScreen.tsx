import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { orgLocalDate } from '@vrticos/domain';
import { radius, space, type } from '@vrticos/tokens';
import { newCorrelationId } from '../../lib/correlation';
import { loadConversationChildren, type ConversationChild } from '../../lib/conversations';
import { shellStyles } from '../../shell/ShellScreens';
import { Button } from '../../ui/Button';
import { Notice } from '../../ui/Notice';
import { useColors } from '../../ui/theme';
import { ConversationView } from './ConversationView';

/** Guardian "Poruke" / educator "Razgovori" (D4-F): the children one can talk about, then the conversation. */
export function ConversationsScreen({ mode, kindergartens, onSessionExpired }: {
  mode: 'guardian' | 'educator';
  kindergartens: { id: string; timezone?: string }[];
  onSessionExpired: (e: unknown) => boolean;
}) {
  const { t } = useTranslation();
  const c = useColors();
  const [children, setChildren] = useState<ConversationChild[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<{ id: string; name: string } | null>(null);
  const close = useCallback(() => setOpen(null), []);

  const load = useCallback(async () => {
    setLoading(true);
    const correlationId = newCorrelationId();
    try {
      const tz = new Map(kindergartens.map((k) => [k.id, k.timezone]));
      setChildren(await loadConversationChildren(mode, (orgId) => orgLocalDate(new Date(), tz.get(orgId)), correlationId));
      setLoadError(null);
    } catch (e) {
      if (!onSessionExpired(e)) setLoadError(correlationId);
    } finally {
      setLoading(false);
    }
  }, [mode, kindergartens, onSessionExpired]);
  useEffect(() => {
    if (!open) void load();
  }, [load, open]);

  if (open) return <ConversationView child={open} onBack={close} onSessionExpired={onSessionExpired} />;
  const title = t(mode === 'educator' ? 'nav.conversations' : 'nav.messages');
  return (
    <ScrollView contentContainerStyle={shellStyles.screen} refreshControl={<RefreshControl refreshing={loading && children !== null} onRefresh={() => void load()} />}>
      <View style={{ gap: space[1] }}>
        <Text accessibilityRole="header" style={[shellStyles.title, { color: c.textPrimary }]}>
          {title}
        </Text>
        <Text style={[shellStyles.meta, { color: c.textSecondary }]}>{t(mode === 'educator' ? 'conversations.ledeEducator' : 'conversations.ledeGuardian')}</Text>
      </View>
      {loadError ? (
        <View style={shellStyles.section}>
          <Notice tone="error" title={t('conversations.loadError')} body={t('attendance.reference', { ref: loadError })} />
          <Button variant="secondary" label={t('common.retry')} onPress={() => void load()} />
        </View>
      ) : null}
      {loading && children === null && !loadError ? <ActivityIndicator color={c.accent} accessibilityLabel={t('common.loading')} /> : null}
      {children && !loadError ? (
        children.length === 0 ? (
          <Notice title={t(mode === 'educator' ? 'conversations.noChildrenEducator' : 'conversations.noChildrenGuardian')} />
        ) : (
          <View style={shellStyles.section}>
            {children.map((x) => (
              <Pressable
                key={x.childId}
                accessibilityRole="button"
                accessibilityLabel={x.unread ? `${x.name}. ${t('conversations.unread', { count: x.unread })}` : x.name}
                onPress={() => setOpen({ id: x.childId, name: x.name })}
                style={[styles.row, { backgroundColor: c.bgSurface, borderColor: c.borderSubtle }]}
              >
                <Text style={[styles.name, { color: c.textPrimary }]}>{x.name}</Text>
                {x.unread ? (
                  <View style={[styles.badge, { backgroundColor: c.accentSoft }]}>
                    <Text style={[styles.badgeText, { color: c.textAccent }]}>{x.unread}</Text>
                  </View>
                ) : null}
              </Pressable>
            ))}
          </View>
        )
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 56, borderWidth: 1, borderRadius: radius.lg, padding: space[3], flexDirection: 'row', alignItems: 'center', gap: space[3] },
  name: { flex: 1, fontSize: type.bodyStrong.size, lineHeight: type.bodyStrong.lineHeight, fontWeight: type.bodyStrong.weight },
  badge: { minWidth: 28, borderRadius: radius.pill, paddingHorizontal: space[2], paddingVertical: space[1], alignItems: 'center' },
  badgeText: { fontSize: type.footnote.size, fontWeight: '700' },
});
