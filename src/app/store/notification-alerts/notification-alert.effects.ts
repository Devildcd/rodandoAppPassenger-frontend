import { inject, Injectable } from "@angular/core";
import { ToastController } from '@ionic/angular';
import { Actions, ofType, createEffect } from '@ngrx/effects';
import { tap } from "rxjs";
import { NotificationPayload } from "src/app/core/models/notification-alert/notification-alert.model";
import { showNotificationAlert } from "./notification-alert.actions";

@Injectable()

export class NotificationAlertEffects {
  private actions$ = inject(Actions);
  private toastCtrl = inject(ToastController);

  show$ = createEffect(
    () =>
      { return this.actions$.pipe(
        ofType(showNotificationAlert),
        tap(async ({ payload }: { payload: NotificationPayload }) => {
          const cssClasses = ['app-toast', `app-toast-${payload.type}`];
          // Default options
          const opts = {
            message: payload.message,
            duration: payload.duration ?? 3500,
            position: 'bottom' as const,
            cssClass: cssClasses,
            buttons: payload.type === 'error' ? [{ text: 'Cerrar', role: 'cancel' }] : undefined,
          };

          const toast = await this.toastCtrl.create(opts);
          await toast.present();
        })
      ) },
    { dispatch: false } // efecto solo side-effect
  );
}

