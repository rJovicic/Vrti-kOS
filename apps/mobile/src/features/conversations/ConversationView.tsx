import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatDay, formatTime } from '@vrticos/i18n';
import { radius, space, type } from '@vrticos/tokens';
import { businessCode } from '../../lib/attendanceKeys';
import { markConversationRead, MESSAGE_MAX, openConversation, sendMessage, withdrawMessage, WITHDRAW_WINDOW_MS, type Conversation } from '../../lib/conversations';
import { shellStyles } from '../../shell/ShellScreens';
import { Button } from '../../ui/Button';
import { Notice } from '../../ui/Notice';
import { TextField } from '../../ui/TextField';
import { useColors } from '../../ui/theme';

/**
 * One conversation about a child (FS-11, prototype "Poruke"): always says who can see it and that the kindergarten
 * answers in its working hours (FR-11-2; the hours themselves are open, Q-T05); text only; the sender may withdraw a
 * message for 5 minutes. Staff messages are shown by role, without a name. Nothing is stored on the device.
 */
export function ConversationView({ child, onBack, onSessionExpired, now = () => new Date() }: {
  child: { id: string; name: string };
  onBack: () => void;
  onSessionExpired: (e: unknown) => boolean;
  now?: () => Date;
}) {
  const { t } = useTranslation();
  const c = useColors();
  const [conv, setConv] = useState<Conversation | null>(null);
  const [failed, setFailed] = useState<'denied' | 'error' | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const next = await openConversation(child.id);
      setConv(next);
      setFailed(null);
      void markConversationRead(next.id).catch(() => undefined);
    } catch (e) {
      if (onSessionExpired(e)) return;
      setFailed((e as { code?: string }).code === '42501' ? 'denied' : 'error');
    }
  }, [child.id, onSessionExpired]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
      await load();
    } catch (e) {
      if (onSessionExpired(e)) return;
      const code = businessCode(e);
      setMessage(code ? t(`errors.${code}`) : t('conversations.sendError'));
    } finally {
      setBusy(false);
    }
  };

  const others = conv?.participants.filter((p) => p.kind === 'guardian' && !p.isMe).map((p) => p.name) ?? [];
  const groups = conv?.participants.filter((p) => p.kind === 'group').map((p) => p.name) ?? [];
  const meIsGuardian = conv?.participants.some((p) => p.kind === 'guardian' && p.isMe) ?? false;
  const who = [meIsGuardian ? t('conversations.you') : null, ...others, groups.length ? t('conversations.groupEducators', { groups: groups.join(', ') }) : null]
    .filter(Boolean)
    .join(', ');

  return (
    <ScrollView contentContainerStyle={shellStyles.screen} keyboardShouldPersistTaps="handled">
      <Button variant="secondary" label={t('conversations.back')} onPress={onBack} />
      <Text accessibilityRole="header" style={[shellStyles.title, { color: c.textPrimary }]}>
        {child.name}
      </Text>
      {failed === 'denied' ? (
        <Notice title={t('conversations.denied')} body={t('conversations.deniedHelp')} />
      ) : failed === 'error' ? (
        <View style={shellStyles.section}>
          <Notice tone="error" title={t('conversations.loadError')} />
          <Button variant="secondary" label={t('common.retry')} onPress={() => void load()} />
        </View>
      ) : !conv ? (
        <ActivityIndicator color={c.accent} accessibilityLabel={t('common.loading')} />
      ) : (
        <>
          <View style={[styles.info, { backgroundColor: c.infoBg }]}>
            <Text style={[shellStyles.meta, { color: c.infoFg }]}>{t('conversations.whoSees', { who })}</Text>
            <Text style={[shellStyles.meta, { color: c.infoFg }]}>{t('conversations.responseTime')}</Text>
          </View>
          {conv.messages.length === 0 ? <Notice title={t('conversations.empty')} /> : null}
          {conv.messages.map((m) => {
            const author = m.mine ? t('conversations.me') : m.senderKind === 'staff' ? t('conversations.staff') : (m.senderName ?? '');
            const at = `${formatDay(m.createdAt.slice(0, 10))} ${formatTime(new Date(m.createdAt))}`;
            const canWithdraw = m.mine && !m.withdrawn && now().getTime() - new Date(m.createdAt).getTime() < WITHDRAW_WINDOW_MS;
            return (
              <View
                key={m.id}
                style={[styles.bubble, m.mine ? styles.mine : null, { backgroundColor: m.mine ? c.accentSoft : c.bgSurface, borderColor: c.borderSubtle }]}
                accessibilityLabel={`${author}, ${at}: ${m.withdrawn ? t('conversations.withdrawn') : m.body}`}
              >
                <Text style={[shellStyles.meta, { color: c.textSecondary, fontWeight: '600' }]}>{`${author} · ${at}`}</Text>
                <Text style={[shellStyles.body, { color: m.withdrawn ? c.textSecondary : c.textPrimary, fontStyle: m.withdrawn ? 'italic' : 'normal' }]}>
                  {m.withdrawn ? t('conversations.withdrawn') : m.body}
                </Text>
                {canWithdraw ? (
                  <Pressable accessibilityRole="button" onPress={() => void act(() => withdrawMessage(m.id))} style={styles.withdraw} disabled={busy}>
                    <Text style={[styles.withdrawText, { color: c.textAccent }]}>{t('conversations.withdraw')}</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
          {message ? <Notice tone="error" title={message} /> : null}
          <TextField label={t('conversations.compose')} value={draft} onChangeText={setDraft} multiline maxLength={MESSAGE_MAX} />
          <Button
            label={t('conversations.send')}
            disabled={busy || draft.trim().length === 0}
            onPress={() =>
              void act(async () => {
                await sendMessage(conv.id, draft);
                setDraft('');
              })
            }
          />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  info: { borderRadius: radius.md, padding: space[3], gap: space[1] },
  bubble: { borderWidth: 1, borderRadius: radius.lg, padding: space[3], gap: space[1], maxWidth: '88%', alignSelf: 'flex-start' },
  mine: { alignSelf: 'flex-end' },
  withdraw: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  withdrawText: { fontSize: type.footnote.size, fontWeight: '700' },
});
