import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { radius, space, type } from '@vrticos/tokens';
import { newCorrelationId } from '../../lib/correlation';
import { loadConversationChildren, type ConversationChild } from '../../lib/conversations';
import { shellStyles } from '../../shell/ShellScreens';
import { Button } from '../../ui/Button';
import { Notice } from '../../ui/Notice';
import { useColors } from '../../ui/theme';
import { ConversationView } from './ConversationView';

/**
 * Guardian "Poruke" / educator "Razgovori" (D4-F, D-42): the conversations one can have — a guardian one per child
 * (their own), an educator one per child and guardian — then the conversation.
 */
export function ConversationsScreen({ mode, onSessionExpired }: {
  mode: 'guardian' | 'educator';
  onSessionExpired: (e: unknown) => boolean;
}) {
  const { t } = useTranslation();
  const c = useColors();
  const [children, setChildren] = useState<ConversationChild[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<{ id: string; name: string; guardianId?: string; guardianName?: string } | null>(null);
  const close = useCallback(() => setOpen(null), []);

  const load = useCallback(async () => {
    setLoading(true);
    const correlationId = newCorrelationId();
    try {
      setChildren(await loadConversationChildren(correlationId));
      setLoadError(null);
    } catch (e) {
      if (!onSessionExpired(e)) setLoadError(correlationId);
    } finally {
      setLoading(false);
    }
  }, [onSessionExpired]);
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
            {children.map((x) => {
              // Educators see one conversation per guardian (D-42); a guardian only has their own, so no name is needed.
              const label = mode === 'educator' ? t('conversations.withGuardian', { child: x.name, guardian: x.guardianName }) : x.name;
              return (
              <Pressable
                key={`${x.childId}:${x.guardianId}`}
                accessibilityRole="button"
                accessibilityLabel={x.unread ? `${label}. ${t('conversations.unread', { count: x.unread })}` : label}
                onPress={() => setOpen(mode === 'educator' ? { id: x.childId, name: x.name, guardianId: x.guardianId, guardianName: x.guardianName } : { id: x.childId, name: x.name })}
                style={[styles.row, { backgroundColor: c.bgSurface, borderColor: c.borderSubtle }]}
              >
                <View style={styles.text}>
                  <Text style={[styles.name, { color: c.textPrimary }]}>{x.name}</Text>
                  {mode === 'educator' ? <Text style={[styles.sub, { color: c.textSecondary }]}>{t('conversations.guardianLine', { guardian: x.guardianName })}</Text> : null}
                </View>
                {x.unread ? (
                  <View style={[styles.badge, { backgroundColor: c.accentSoft }]}>
                    <Text style={[styles.badgeText, { color: c.textAccent }]}>{x.unread}</Text>
                  </View>
                ) : null}
              </Pressable>
              );
            })}
          </View>
        )
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 56, borderWidth: 1, borderRadius: radius.lg, padding: space[3], flexDirection: 'row', alignItems: 'center', gap: space[3] },
  text: { flex: 1, gap: 2 },
  name: { fontSize: type.bodyStrong.size, lineHeight: type.bodyStrong.lineHeight, fontWeight: type.bodyStrong.weight },
  sub: { fontSize: type.footnote.size, lineHeight: type.footnote.lineHeight },
  badge: { minWidth: 28, borderRadius: radius.pill, paddingHorizontal: space[2], paddingVertical: space[1], alignItems: 'center' },
  badgeText: { fontSize: type.footnote.size, fontWeight: '700' },
});
