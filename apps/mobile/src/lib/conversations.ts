import { parseDateRange, spanContains } from '@vrticos/domain';
import { CORRELATION_HEADER, newCorrelationId } from './correlation';
import { supabase } from './supabase';

// D4-F conversations. Everything AS THE SIGNED-IN PERSON: the database computes the participants from current
// relationships (guardians with receives_messages, educators of the child's group today); managers have no access
// (Q-T16). Messages are never stored on the device; sending needs a connection.

export const MESSAGE_MAX = 2000;
export const WITHDRAW_WINDOW_MS = 5 * 60 * 1000;

export interface ConversationChild {
  childId: string;
  name: string;
  /** Unread "Nova poruka" notifications of this child's conversation. */
  unread: number;
}
export interface Message {
  id: string;
  body: string | null;
  createdAt: string;
  withdrawn: boolean;
  mine: boolean;
  senderKind: 'guardian' | 'staff';
  senderName: string | null;
}
export interface Participant {
  kind: 'guardian' | 'group';
  name: string;
  isMe: boolean;
}

/**
 * The children the person can talk about: guardians — own links valid today with receives_messages (RLS returns only
 * own, unrestricted links); educators — the children RLS returns (enrolled today in their groups).
 */
export async function loadConversationChildren(mode: 'guardian' | 'educator', today: (orgId: string) => string, correlationId: string = newCorrelationId()): Promise<ConversationChild[]> {
  const [children, conversations, notifications, links] = await Promise.all([
    supabase.from('children').select('id, first_name, last_name, organization_id').order('first_name').setHeader(CORRELATION_HEADER, correlationId),
    supabase.from('conversations').select('id, child_id').setHeader(CORRELATION_HEADER, correlationId),
    supabase.from('notifications').select('resource_id, read_at').eq('type', 'message.received').setHeader(CORRELATION_HEADER, correlationId),
    mode === 'guardian'
      ? supabase.from('child_guardians').select('child_id, receives_messages, valid_during').setHeader(CORRELATION_HEADER, correlationId)
      : Promise.resolve({ data: null, error: null }),
  ]);
  for (const r of [children, conversations, notifications, links]) if (r.error) throw r.error;
  const convOf = new Map(((conversations.data ?? []) as { id: string; child_id: string }[]).map((c) => [c.child_id, c.id]));
  const unread = ((notifications.data ?? []) as { resource_id: string; read_at: string | null }[]).filter((n) => n.read_at === null);
  const allowed = (childId: string, orgId: string) => {
    if (mode === 'educator') return true;
    const day = today(orgId);
    return ((links.data ?? []) as { child_id: string; receives_messages: boolean; valid_during: string }[]).some(
      (l) => l.child_id === childId && l.receives_messages && inRange(l.valid_during, day),
    );
  };
  return ((children.data ?? []) as { id: string; first_name: string; last_name: string; organization_id: string }[])
    .filter((c) => allowed(c.id, c.organization_id))
    .map((c) => ({ childId: c.id, name: `${c.first_name} ${c.last_name}`, unread: unread.filter((n) => n.resource_id === convOf.get(c.id)).length }))
    .sort((a, b) => a.name.localeCompare(b.name, 'hr'));
}

function inRange(range: string, day: string): boolean {
  const span = parseDateRange(String(range));
  return span !== null && spanContains(span, day);
}

export interface Conversation {
  id: string;
  participants: Participant[];
  messages: Message[];
}

export async function openConversation(childId: string, correlationId: string = newCorrelationId()): Promise<Conversation> {
  const opened = await supabase.schema('api').rpc('open_conversation', { p_child_id: childId }).setHeader(CORRELATION_HEADER, correlationId);
  if (opened.error) throw opened.error;
  const id = opened.data as string;
  const [participants, messages] = await Promise.all([
    supabase.schema('api').rpc('conversation_participants', { p_conversation_id: id }).setHeader(CORRELATION_HEADER, correlationId),
    supabase.schema('api').rpc('conversation_messages', { p_conversation_id: id }).setHeader(CORRELATION_HEADER, correlationId),
  ]);
  if (participants.error) throw participants.error;
  if (messages.error) throw messages.error;
  return {
    id,
    participants: ((participants.data ?? []) as { kind: Participant['kind']; name: string; is_me: boolean }[]).map((p) => ({ kind: p.kind, name: p.name, isMe: p.is_me })),
    messages: ((messages.data ?? []) as { id: string; body: string | null; created_at: string; withdrawn: boolean; mine: boolean; sender_kind: Message['senderKind']; sender_name: string | null }[]).map(
      (m) => ({ id: m.id, body: m.body, createdAt: m.created_at, withdrawn: m.withdrawn, mine: m.mine, senderKind: m.sender_kind, senderName: m.sender_name }),
    ),
  };
}

export async function sendMessage(conversationId: string, body: string, correlationId: string = newCorrelationId()): Promise<void> {
  const { error } = await supabase.schema('api').rpc('send_message', { p_conversation_id: conversationId, p_body: body }).setHeader(CORRELATION_HEADER, correlationId);
  if (error) throw error;
}

export async function withdrawMessage(messageId: string, correlationId: string = newCorrelationId()): Promise<void> {
  const { error } = await supabase.schema('api').rpc('withdraw_message', { p_message_id: messageId }).setHeader(CORRELATION_HEADER, correlationId);
  if (error) throw error;
}

/** Marks the person's unread "Nova poruka" notifications of this conversation read. */
export async function markConversationRead(conversationId: string): Promise<void> {
  const { data, error } = await supabase.from('notifications').select('id, resource_id, read_at').eq('type', 'message.received');
  if (error) throw error;
  const ids = ((data ?? []) as { id: string; resource_id: string; read_at: string | null }[]).filter((n) => n.resource_id === conversationId && n.read_at === null).map((n) => n.id);
  if (!ids.length) return;
  const r = await supabase.schema('api').rpc('mark_notifications_read', { p_ids: ids });
  if (r.error) throw r.error;
}
