import { createAction, props } from "@ngrx/store";
import { NotificationPayload } from "src/app/core/models/notification-alert/notification-alert.model";

export const showNotificationAlert = createAction(
  '[Notification] Show',
  props<{ payload: NotificationPayload }>()
);

export const hideNotificationAlert = createAction(
  '[Notification] Hide',
  props<{ id?: string }>()
);
