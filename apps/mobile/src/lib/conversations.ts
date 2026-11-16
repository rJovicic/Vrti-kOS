import { CORRELATION_HEADER, newCorrelationId } from './correlation';
import { supabase } from './supabase';

// D4-F conversations, one per child AND guardian since D-42. Everything AS THE SIGNED-IN PERSON: the database computes
// the participants from current relationships (that guardian with receives_messages, educators of the child's group
// today); managers have no access (Q-T16, D-42). Messages are never stored on the device; sending needs a connection.

export const MESSAGE_MAX = 2000;
export const WITHDRAW_WINDOW_MS = 5 * 60 * 1000;

/** One conversation the person can have today (D-42): about a child, with one guardian. */
export interface ConversationChild {
  childId: string;
  name: string;
  /** The guardian's record; for a guardian it is their own. */
  guardianId: string;
  /** The guardian's name (shown to educators; a guardian only ever has their own conversation). */
  guardianName: string;
  /** Unread "Nova poruka" notifications of this conversation. */
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
 * The conversations the person can have today (D-42), from api.message_contacts: the database decides who takes part
 * (a guardian gets only their own entry per child; an educator every participant guardian of the children of their
 * groups). Child names come from what RLS lets the person read; unread counts from their own notifications.
 */
export async function loadConversationChildren(correlationId: string = newCorrelationId()): Promise<ConversationChild[]> {
  const [contacts, children, notifications] = await Promise.all([
    supabase.schema('api').rpc('message_contacts').setHeader(CORRELATION_HEADER, correlationId),
    supabase.from('children').select('id, first_name, last_name').setHeader(CORRELATION_HEADER, correlationId),
    supabase.from('notifications').select('resource_id, read_at').eq('type', 'message.received').setHeader(CORRELATION_HEADER, correlationId),
  ]);
  for (const r of [contacts, children, notifications]) if (r.error) throw r.error;
  const nameOf = new Map(((children.data ?? []) as { id: string; first_name: string; last_name: string }[]).map((c) => [c.id, `${c.first_name} ${c.last_name}`]));
  const unread = ((notifications.data ?? []) as { resource_id: string; read_at: string | null }[]).filter((n) => n.read_at === null);
  return ((contacts.data ?? []) as { child_id: string; guardian_id: string; guardian_name: string; conversation_id: string | null }[])
    .filter((x) => nameOf.has(x.child_id))
    .map((x) => ({
      childId: x.child_id,
      name: nameOf.get(x.child_id)!,
      guardianId: x.guardian_id,
      guardianName: x.guardian_name,
      unread: x.conversation_id ? unread.filter((n) => n.resource_id === x.conversation_id).length : 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'hr') || a.guardianName.localeCompare(b.guardianName, 'hr'));
}

export interface Conversation {
  id: string;
  participants: Participant[];
  messages: Message[];
}

/** Opens the conversation about a child with one guardian (D-42): a guardian always gets their own; an educator names the guardian. */
export async function openConversation(childId: string, guardianId?: string, correlationId: string = newCorrelationId()): Promise<Conversation> {
  const opened = await supabase
    .schema('api')
    .rpc('open_conversation', guardianId ? { p_child_id: childId, p_guardian_id: guardianId } : { p_child_id: childId })
    .setHeader(CORRELATION_HEADER, correlationId);
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
