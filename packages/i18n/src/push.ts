import { hr } from './locales/hr.ts';

// D4-A, FR-08-2, SR-PUSH-01: push texts are generic per notification type. The builder takes NO content, name, group or
// sender — only the type and the opaque notification id — so a payload cannot carry personal data by construction. The
// app loads the resource after sign-in under its own authorization. Delivery itself waits for D-40 (ADR-0007).

/** The notification types of the database enum `public.notification_type` (checked against the generated types). */
export const notificationTypes = ['announcement.published', 'absence.reported', 'message.received', 'daily_entry.published'] as const;
export type NotificationType = (typeof notificationTypes)[number];

export interface PushPayload {
  title: string;
  body: string;
  data: { notificationId: string };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function pushPayload(type: NotificationType, notificationId: string): PushPayload {
  if (!UUID.test(notificationId)) throw new Error('INVALID_ARGUMENTS');
  return { title: hr.push.title, body: hr.push.types[type], data: { notificationId } };
}
