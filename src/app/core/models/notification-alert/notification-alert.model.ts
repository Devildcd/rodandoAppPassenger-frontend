export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface NotificationPayload {
  type: NotificationType;
  message: string;
  title?: string;
  duration?: number; // ms
  id?: string; // opcional, por si quieres trackear/close
  extra?: Record<string, unknown>;
}
