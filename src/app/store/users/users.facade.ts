import { inject, Injectable } from "@angular/core";

import { UsersStore } from "./users.store";
import { RegisterStore } from "./register.store";
import { UserService } from "src/app/core/services/http/user.service";
import { CreateAuthCredentialsPayload, CreateUserPayload } from "src/app/core/models/user/user.payload";
import { buildRegisterPayload, purgeSensitiveCredentials } from "./mappers";
import { catchError, finalize, shareReplay, take, tap, throwError, Observable } from 'rxjs';
import { ApiError } from "src/app/core/models/api";
import { User } from "src/app/core/models/user/user.response";
import { showNotificationAlert } from "../notification-alerts/notification-alert.actions";
import { Store } from "@ngrx/store";

@Injectable({ providedIn: 'root' })
export class UserFacade {
  private usersStore = inject(UsersStore);
  private registerStore = inject(RegisterStore);
  private userService = inject(UserService);
  private store = inject(Store);

  getAllUsers() {
    return this.usersStore.all;
  }

  getRegisterStatus() {
    return {
      status: this.registerStore.status,
      loading: this.registerStore.loading,
      error: this.registerStore.error,
      formErrors: this.registerStore.formErrors,
      lastRegisteredUserId: this.registerStore.lastRegisteredUserId,
    };
  }

  // Main method the component calls to register
  register(
    formUser: CreateUserPayload,
    formCreds: CreateAuthCredentialsPayload
  ): Observable<User> {
    // 1) prepare payload (shallow clones)
    const payload = buildRegisterPayload(formUser, formCreds);
    this.registerStore.start();
    // call service to register
    const obs$ = this.userService.register(payload).pipe(
      take(1),
      tap((user: User) => {
        // side-effects on success
        this.usersStore.upsertOne(user);
        this.registerStore.success(user.id, 'Usuario registrado correctamente');
        // NOTIFICACIÓN: éxito
        this.store.dispatch(
          showNotificationAlert({
            payload: {
              type: 'success',
              message: 'Usuario registrado correctamente',
              duration: 3500,
            },
          })
        );
      }),
      catchError((err: ApiError) => {
        let formErrors = err.validation;
        // mapear errores del backend a formErrors cuando aplique
        if (!formErrors) {
          // Map known backend error codes to field-level errors
          if (err.code === 'EMAIL_CONFLICT' || err.code === 'EMAIL_EXISTS') {
            formErrors = { email: ['Email already registered'] };
          } else if (
            err.code === 'PHONE_CONFLICT' ||
            err.code === 'PHONE_EXISTS'
          ) {
            formErrors = { phone: ['Phone number already registered'] };
          }
        }
        // actualizar register store con el error
        this.registerStore.setError(err, formErrors);
        // NOTIFICACIÓN: error
        this.store.dispatch(
          showNotificationAlert({
            payload: {
              type: 'error',
              message: err.message ?? 'Error registrando usuario',
              duration: 5000,
            },
          })
        );
        // rethrow para que los subscribers (component) también reciban el error
        return throwError(() => err);
      }),
      finalize(() => {
        // ensure password is purged even on error
        purgeSensitiveCredentials(payload);
      }),
      // Evitamos ejecuciones duplicadas si varios se subscriben.
      shareReplay({ bufferSize: 1, refCount: true })
    );
    // Iniciamos la ejecución inmediatamente (comportamiento "fire & forget" backwards compatible)
    obs$.subscribe({ next: () => {}, error: () => {} });

    // Retornamos el observable para que el componente pueda reaccionar (ej: resetear form)
    return obs$;
  }

  clearRegisterState(): void {
    this.registerStore.clear();
  }
}
