import { computed, inject, Injectable } from "@angular/core";
import { Router } from "@angular/router";
import { Platform } from '@ionic/angular';

import { AuthStore } from "./auth.store";
import { AuthService } from "src/app/core/services/http/auth.service";
import { catchError, concatMap, defer, finalize, firstValueFrom, from, map, mergeMap, Observable, of, shareReplay, Subject, Subscription, switchMap, take, takeUntil, tap, throwError } from "rxjs";
import { showNotificationAlert } from "../notification-alerts/notification-alert.actions";
import { SecureStorageService } from "src/app/core/services/http/secure-storage.service";
import { LoginPayload } from "src/app/core/models/auth/auth.payload";
import { LoginResponse, LoginResponseMobile, LoginResponseWeb, RefreshResponse, RefreshResponseMobile, RefreshResponseWeb } from "src/app/core/models/auth/auth.response";
import { ApiError } from "src/app/core/models/api";
import { User, UserProfile } from "src/app/core/models/user/user.response";
import { LoginStore } from "./login.store";
import { Store } from "@ngrx/store";
import { SessionType } from "src/app/core/models/auth/auth.auxiliary";
import { mapProfileToUser } from "../users/mappers";
import { PassengerLocationReporter } from "@/app/features/passenger/passenger-location.reporter";
import { UsersStore } from "../users/users.store";

@Injectable({ providedIn: 'root' })
export class AuthFacade {
  private readonly authStore = inject(AuthStore);
  private readonly loginStore = inject(LoginStore);
  private readonly store = inject(Store);
  private readonly secureStorage = inject(SecureStorageService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly platform = inject(Platform);
  private readonly passengerLocationReporter = inject(PassengerLocationReporter);
  private readonly usersStore = inject(UsersStore);

  private refresh$?: Observable<string>;
  private refreshSubscription?: Subscription | null = null;
  private refreshCancel$ = new Subject<void>();
  private refreshTimerId: any = null; // id de setTimeout
  private readonly AUTO_REFRESH_OFFSET = 30_000; // 30s
  private readonly SESSION_TYPE_KEY = 'auth.sessionType';

  // Determina plataforma synchronously (útil para el interceptor)
  getPlatformSync(): 'web' | 'mobile' {
    // En Ionic: platform.is('hybrid') indica que corre en device. Ajusta según tu app.
    try {
      return this.platform.is('hybrid') ? 'mobile' : 'web';
    } catch {
      return 'web';
    }
  }

  /**
   * Login: intenta autenticar y actualizar el estado.
   * - Si es web: backend pondrá cookie HttpOnly (refreshToken) y devolverá { accessToken }
   * - Si es mobile: backend devolverá { accessToken, refreshToken } y debemos persistir refreshToken
   */
 login(payload: LoginPayload): Observable<User> {
  this.loginStore.start();

  const obs$ = this.authService
    .login(payload, { withCredentials: true })
    .pipe(
      take(1),

      switchMap((res: LoginResponse) => {
        // 1) persistir sessionType tal cual viene del backend
        const sessionType: SessionType | null = (res as any).sessionType ?? null;
        this.authStore.setAuth({ sessionType } as any);

        // 2) decidir si usamos cookie según la forma de la respuesta
        const usesCookie = !('refreshToken' in res && (res as any).refreshToken);
        this.authStore.setAuth({ usesCookie } as any);

        if (!usesCookie) {
          // ======== MOBILE / BODY TOKENS ========
          const { accessToken, refreshToken } = res as LoginResponseMobile;
          const accessTokenExpiresAt = (res as any).accessTokenExpiresAt as number | undefined;

          const setToken$ = from(
            this.setAccessTokenWithExp({
              accessToken,
              accessTokenExpiresAt,
              refreshToken,
              sessionType,
            })
          );

          try { this.authStore.setRefreshTokenInMemory(refreshToken); } catch {}

          return setToken$.pipe(
            switchMap(() =>
              this.secureStorage.save('refreshToken', refreshToken).pipe(
                take(1),
                switchMap(() =>
                  // PERFIL DEL PASSENGER (trae currentLocation como GeoJSON)
                  this.authService.me(false).pipe(
                    catchError(() => of(this.parseUserFromToken(accessToken)))
                  )
                ),
                catchError((storageErr) => {
                  this.clearAll();
                  return throwError(() => storageErr);
                })
              )
            )
          );
        }

        // ======== WEB / COOKIE HTTPONLY ========
        const accessToken = (res as LoginResponseWeb).accessToken ?? null;
        const accessTokenExpiresAt = (res as any).accessTokenExpiresAt as number | undefined;

        const setToken$ = from(
          this.setAccessTokenWithExp({
            accessToken,
            accessTokenExpiresAt,
            sessionType,
          })
        );

        return setToken$.pipe(
          switchMap(() =>
            // PERFIL DEL PASSENGER (trae currentLocation como GeoJSON)
            this.authService.me(true).pipe(
              catchError(() => of(this.parseUserFromToken(accessToken)))
            )
          )
        );
      }),

      // 3) Guardar user + UsersStore con currentLocation del PASSENGER
      tap((profileOrUser) => {
        if (!profileOrUser) throw new Error('Usuario no disponible tras login');

        const parsed = this.parseUserFromToken(this.authStore.accessToken?.() ?? null) ?? {};
        // id preferentemente del token
        const uid: string = (parsed as any)?.sub || (parsed as any)?.id || (profileOrUser as any)?.id;
        if (!uid) throw new Error('No se pudo inferir el id del usuario');

        // Si vino UserProfile de /profile, mapea a tu User
        const isProfile = !!(profileOrUser as any).userType && (profileOrUser as any).name !== undefined;
        const mergedUser: User = isProfile
          ? mapProfileToUser(uid, profileOrUser as UserProfile)
          : ({ ...parsed, ...(profileOrUser as any), id: uid } as User);

        // set en AuthStore
        try {
          this.authStore.setAuth({
            accessToken: this.authStore.accessToken(),
            user: mergedUser as any,
            sessionType: (this.authStore as any).sessionType?.() ?? null,
          } as any);
        } catch {
          this.authStore.setUser(mergedUser as any);
        }

        // Upsert en UsersStore (para tener currentLocation normalizada)
        this.usersStore.upsertOne(mergedUser);

        this.loginStore.success();
        this.store.dispatch(showNotificationAlert({
          payload: { type: 'success', message: 'Inicio de sesión correcto', duration: 3000 },
        }));
      }),

      // 4) Arrancar reporter del PASSENGER (siempre passenger según tu comentario)
      tap(() => {
        try { this.passengerLocationReporter.bootstrapOnLogin(); } catch {}
      }),

      // 5) Errores del flujo
      catchError((err: ApiError) => {
        let formErrors: Record<string, string[]> | undefined = (err as any)?.validation ?? undefined;
        if (!formErrors) {
          if (err?.code === 'INVALID_CREDENTIALS' || err?.code === 'UNAUTHORIZED') {
            formErrors = { password: ['Credenciales inválidas'] };
          } else if (err?.code === 'EMAIL_NOT_VERIFIED') {
            formErrors = { email: ['Email no verificado'] };
          }
        }

        this.loginStore.setError(err, formErrors ?? null);
        this.authStore.clear();

        this.store.dispatch(showNotificationAlert({
          payload: { type: 'error', message: err?.message ?? 'Error iniciando sesión', duration: 5000 },
        }));

        try {
          this.secureStorage.remove('refreshToken').pipe(take(1))
            .subscribe({ next: () => {}, error: () => {} });
        } catch {}

        return throwError(() => err);
      }),

      finalize(() => {
        try {
          if ((payload as any).password) {
            (payload as any).password = '';
            delete (payload as any).password;
          }
        } catch {}
        this.loginStore.clear();
      }),

      shareReplay({ bufferSize: 1, refCount: true })
    );

  // En esta app “siempre passenger”, ya NO hacemos bootstrap del driver.
  return obs$;
}


  // ----------------------------
  // setAccessTokenWithExp
  // ----------------------------
  /**
   * Actualiza el store con el access token y expiraciones.
   * - PREFIERE valores que vienen del backend (expiresAt en ms / expiresIn ms).
   * - Usa parseExpFromToken solo como fallback.
   * - Reprograma auto-refresh (facade) — el store no debe gestionar timers.
   */
/**
 * Centraliza actualización de token/expiraciones/sessionType y (opcional) user.
 *
 * - No sobrescribe user si no hay userFromParams ni user parseado del token.
 * - Persiste refreshToken (secureStorage) si viene (mobile).
 * - Persiste sessionType en localStorage (no sensible).
 * - Programa auto-refresh.
 *
 * params.user: opcional. Si el backend ya te devuelve el perfil al hacer login/refresh,
 * pásalo aquí y se almacenará inmediatamente.
 */
public async setAccessTokenWithExp(params: {
  accessToken: string | null;
  accessTokenExpiresAt?: number | null; // epoch ms preferido
  accessTokenExpiresIn?: number | null; // ms (alternativa)
  refreshToken?: string | null; // mobile-only (persistir desde facade)
  refreshTokenExpiresAt?: number | null;
  sid?: string | null;
  sessionType?: SessionType | null;
  user?: any | null; // opcional: perfil completo devuelto por backend
}): Promise<void> {
  const now = Date.now();
  let expiresAt: number | null = null;

  // 1) determinar expiresAt (ms) con prioridad:
  // params.accessTokenExpiresAt > accessTokenExpiresIn > token.exp
  if (typeof params.accessTokenExpiresAt === 'number') {
    expiresAt = params.accessTokenExpiresAt;
    console.log('[AuthFacade] setAccessTokenWithExp - using accessTokenExpiresAt from params:', expiresAt);
  } else if (typeof params.accessTokenExpiresIn === 'number') {
    expiresAt = now + Math.max(0, params.accessTokenExpiresIn);
    console.log('[AuthFacade] setAccessTokenWithExp - using accessTokenExpiresIn, computed expiresAt:', expiresAt);
  } else {
    expiresAt = this.parseExpFromToken(params.accessToken ?? null);
    console.log('[AuthFacade] setAccessTokenWithExp - parsed exp from token:', expiresAt);
  }

  // 2) parse user from token (fallback only)
  const parsedUserFromToken = this.parseUserFromToken(params.accessToken ?? null);
  if (parsedUserFromToken) {
    console.log('[AuthFacade] setAccessTokenWithExp - parsed user from token (fallback):', parsedUserFromToken);
  }

  // 3) persistir refreshToken si viene (mobile)
  if (params.refreshToken) {
    try {
      console.log('[AuthFacade] setAccessTokenWithExp - persisting refreshToken to secure storage (mobile)');
      // secureStorage.save devuelve Observable<void> en tu implementación; usar firstValueFrom para normalizar
      await firstValueFrom(this.secureStorage.save('refreshToken', params.refreshToken));
      console.log('[AuthFacade] setAccessTokenWithExp - persisted refreshToken');
    } catch (e) {
      console.warn('[AuthFacade] setAccessTokenWithExp - Failed to persist refresh token to secure storage', e);
    }
  }

  // 4) actualizar store (no sobrescribir user salvo si hay user explícito o si no existía user y podemos inferirlo)
  try {
    const newSessionType = params.sessionType ?? this.authStore.sessionType?.() ?? null;

    // Decide qué user guardar: prioridad params.user (perfil completo) > existing store.user > parsedUserFromToken
    const currentUser = this.authStore.user?.();
    let userToSet: any | null = currentUser ?? null;
    if (params.user && typeof params.user === 'object') {
      userToSet = params.user;
    } else if (!currentUser && parsedUserFromToken) {
      userToSet = parsedUserFromToken;
    }

    this.authStore.setAuth({
      accessToken: params.accessToken ?? null,
      accessTokenExpiresAt: expiresAt ?? null,
      refreshTokenInMemory: params.refreshToken ?? null,
      refreshTokenExpiresAt: params.refreshTokenExpiresAt ?? null,
      sid: params.sid ?? null,
      sessionType: newSessionType,
      user: userToSet ?? null,
    });

    console.log('[AuthFacade] setAccessTokenWithExp - authStore updated', {
      accessTokenExists: !!params.accessToken,
      accessTokenExpiresAt: expiresAt,
      sessionType: newSessionType,
      sid: params.sid ?? null,
      userSet: !!userToSet,
    });

    // 4b) persistir sessionType en localStorage (no sensible)
    try {
      if (newSessionType) {
        localStorage.setItem(this.SESSION_TYPE_KEY, newSessionType);
        console.log('[AuthFacade] setAccessTokenWithExp - persisted sessionType to localStorage:', newSessionType);
      } else {
        localStorage.removeItem(this.SESSION_TYPE_KEY);
      }
    } catch (e) {
      console.warn('[AuthFacade] setAccessTokenWithExp - failed to persist sessionType to localStorage', e);
    }
  } catch (e) {
    console.warn('[AuthFacade] setAccessTokenWithExp - failed to update authStore', e);
  }

  // 5) (re)programar auto-refresh
  try {
    this.scheduleAutoRefresh(expiresAt);
  } catch (e) {
    console.warn('[AuthFacade] setAccessTokenWithExp - scheduleAutoRefresh failed', e);
  }
}


  // ----------------------------
  // Auto-refresh scheduling
  // ----------------------------
  public clearAutoRefresh(): void {
  if (this.refreshTimerId) {
    clearTimeout(this.refreshTimerId);
    this.refreshTimerId = null;
    console.log('[AuthFacade] clearAutoRefresh - timer cleared');
  } else {
    console.log('[AuthFacade] clearAutoRefresh - no timer to clear');
  }
}

  public scheduleAutoRefresh(expiresAt?: number | null): void {
  // cancelar cualquier timer previo
  this.clearAutoRefresh();
  if (!expiresAt) {
    console.log('[AuthFacade] scheduleAutoRefresh - no expiresAt provided, nothing to schedule');
    return;
  }

  const now = Date.now();
  const ttl = Math.max(0, expiresAt - now);
  // offset adaptativo: si el ttl es menor al offset, usamos ttl/2 como offset para evitar negative scheduling
  const offset = Math.min(this.AUTO_REFRESH_OFFSET ?? 30000, Math.floor(ttl / 2));
  const msUntilRefresh = ttl - offset;

  console.log('[AuthFacade] scheduleAutoRefresh - computed', {
    expiresAt,
    now,
    ttl,
    offset,
    msUntilRefresh,
  });

  // si ya pasó o está muy próximo, ejecutar en microtask (evitar reentrancias sincrónicas)
  if (msUntilRefresh <= 0) {
    console.log('[AuthFacade] scheduleAutoRefresh - msUntilRefresh <= 0, scheduling immediate (microtask) refresh');
    Promise.resolve().then(() => {
      // lanzar el observable/proceso de refresh sincronicamente -> performRefresh se encargará del single-flight
      this.performRefresh()
        .pipe(take(1))
        .subscribe({
          next: () => {
            console.log('[AuthFacade] scheduleAutoRefresh - immediate performRefresh succeeded');
          },
          error: (e) => {
            console.warn('[AuthFacade] scheduleAutoRefresh - immediate performRefresh failed', e);
          },
        });
    });
    return;
  }

  // programar con setTimeout
  const safeDelay = Math.max(0, msUntilRefresh);
  console.log('[AuthFacade] scheduleAutoRefresh - scheduling setTimeout in ms:', safeDelay);

  this.refreshTimerId = setTimeout(() => {
    console.log('[AuthFacade] scheduleAutoRefresh - timer fired, calling performRefresh()');
    this.performRefresh()
      .pipe(take(1))
      .subscribe({
        next: () => console.log('[AuthFacade] scheduleAutoRefresh - performRefresh succeeded (timer)'),
        error: (e) => console.warn('[AuthFacade] scheduleAutoRefresh - performRefresh failed (timer)', e),
      });
  }, safeDelay) as unknown as number;
}

public performRefresh(): Observable<string> {
  // single-flight
  if (this.refresh$) return this.refresh$;

  this.authStore.setLoading(true);

  // 1) Determinar flujo por FLAG del store (seteado en login)
  //    Fallback a shape si el flag no existe por compatibilidad.
  const snap = this.authStore.getSnapshot();
  const storedUsesCookie: boolean | null =
    (typeof (this.authStore as any).usesCookie === 'function'
      ? (this.authStore as any).usesCookie()
      : (snap as any)?.usesCookie) ?? null;

  let refreshRequest$: Observable<RefreshResponse>;

  if (storedUsesCookie === true) {
    // ===== COOKIE FLOW =====
    refreshRequest$ = (this.authService.refresh(undefined, true) as Observable<RefreshResponse>)
      .pipe(takeUntil(this.refreshCancel$));
  } else if (storedUsesCookie === false) {
    // ===== BODY FLOW (mobile/api_client) =====
    const refreshToken$ = defer(() => {
      const inMemory = this.authStore.refreshTokenInMemory?.() ?? null;
      if (inMemory) return of(inMemory);
      return (this.secureStorage.load('refreshToken') as Observable<string | null>)
        .pipe(catchError(() => of(null)));
    });

    refreshRequest$ = refreshToken$.pipe(
      mergeMap(rt => {
        if (!rt) {
          return throwError(() => new Error('No refresh token available for mobile refresh'));
        }
        return this.authService.refresh(rt, false) as Observable<RefreshResponse>;
      }),
      takeUntil(this.refreshCancel$)
    );
  } else {
    // ===== Fallback defensivo si aún no existe usesCookie en store =====
    // intenta cookie primero; si falla por 401/403, intenta body si hay RT
    const tryCookie$ = (this.authService.refresh(undefined, true) as Observable<RefreshResponse>)
      .pipe(
        catchError(() => {
          const rtInMem = this.authStore.refreshTokenInMemory?.() ?? null;
          if (!rtInMem) return throwError(() => new Error('No usesCookie flag and no refresh token'));
          return this.authService.refresh(rtInMem, false) as Observable<RefreshResponse>;
        }),
        takeUntil(this.refreshCancel$)
      );
    refreshRequest$ = tryCookie$;
  }

  const pipeline$ = refreshRequest$.pipe(
    mergeMap((res) => {
      if (!res || typeof res.accessToken !== 'string') {
        return throwError(() => new Error('Refresh response malformed: missing accessToken'));
      }

      const accessToken: string = res.accessToken;
      const refreshToken: string | undefined = (res as any).refreshToken;
      const accessTokenExpiresAt: number | undefined = (res as any).accessTokenExpiresAt;
      const refreshTokenExpiresAt: number | undefined = (res as any).refreshTokenExpiresAt;
      const sid: string | undefined = (res as any).sid;
      const respSessionType: SessionType | undefined = (res as any).sessionType;

      // preferir timestamp absoluto que manda el backend
      const expFromJwt = this.parseExpFromToken(accessToken) ?? undefined;
      const finalAccessExpiresAt = typeof accessTokenExpiresAt === 'number'
        ? accessTokenExpiresAt
        : expFromJwt;

      // si el backend manda sessionType actualizado, sincronízalo
      if (respSessionType) {
        try { this.authStore.setAuth({ sessionType: respSessionType } as any); } catch {}
      }

      // 1) Actualizar tokens/expiraciones y reprogramar auto-refresh
      return from(this.setAccessTokenWithExp({
        accessToken,
        accessTokenExpiresAt: finalAccessExpiresAt ?? undefined,
        refreshToken: refreshToken ?? undefined,              // <- setAccessTokenWithExp ya persiste RT si viene
        refreshTokenExpiresAt: refreshTokenExpiresAt ?? undefined,
        sid: sid ?? undefined,
        sessionType: respSessionType ?? (this.authStore.sessionType?.() ?? null) ?? undefined,
      })).pipe(
        // 2) Refrescar perfil
        mergeMap(() => {
          // decidir uso de cookie por flag del store (posiblemente actualizado en login)
          const usesCookieNow =
            typeof (this.authStore as any).usesCookie === 'function'
              ? (this.authStore as any).usesCookie()
              : (this.authStore.getSnapshot() as any)?.usesCookie ?? false;

          return (this.authService.me(!!usesCookieNow) as Observable<any>).pipe(
            take(1),
            catchError(() => of(this.parseUserFromToken(accessToken) ?? null))
          );
        }),
        map((userFromMe) => {
          try {
            if (userFromMe && typeof userFromMe === 'object') {
              this.authStore.setAuth({ user: userFromMe } as any);
            } else {
              const parsed = this.parseUserFromToken(accessToken);
              if (parsed && !this.authStore.user?.()) {
                this.authStore.setUser(parsed);
              }
            }
          } catch {}
          return accessToken;
        })
      );
    }),
    takeUntil(this.refreshCancel$),
    catchError((err) => {
      // Limpieza defensiva si el refresh falla
      Promise.resolve(this.clearAll()).catch(() => {});
      const normalized = typeof (this as any).normalizeError === 'function'
        ? (this as any).normalizeError(err)
        : err;
      return throwError(() => normalized);
    }),
    finalize(() => {
      this.authStore.setLoading(false);
      this.refresh$ = undefined;
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  this.refresh$ = pipeline$;
  return this.refresh$;
}



// Metodo para rehidratar el estado desde el localStorage
public async restoreSessionTypeFromStorage(): Promise<void> {
  try {
    const st = localStorage.getItem(this.SESSION_TYPE_KEY);
    if (!st) {
      console.log('[AuthFacade] restoreSessionTypeFromStorage - no sessionType in storage');
      return;
    }

    // validar valor conocido (opcional)
    const allowed = ['web', 'mobile_app', 'api_client'] as const;
    if (!allowed.includes(st as any)) {
      console.warn('[AuthFacade] restoreSessionTypeFromStorage - unexpected sessionType in storage:', st);
      localStorage.removeItem(this.SESSION_TYPE_KEY);
      return;
    }

    // poner en authStore de forma segura
    try {
      const sessionType = st as SessionType;
      if (typeof (this.authStore as any).setSessionType === 'function') {
        (this.authStore as any).setSessionType(sessionType);
      } else {
        // fallback: setAuth
        this.authStore.setAuth({ sessionType } as any);
      }
      console.log('[AuthFacade] restoreSessionTypeFromStorage - restored sessionType:', sessionType);
    } catch (e) {
      console.warn('[AuthFacade] restoreSessionTypeFromStorage - failed to set store', e);
    }
  } catch (e) {
    console.warn('[AuthFacade] restoreSessionTypeFromStorage - error reading localStorage', e);
  }
}

/**
 * Restore session completo: intenta silent refresh (utiliza performRefresh),
 * y si tiene éxito solicita /me() para poblar user en el store.
 *
 * No persiste user en localStorage — solo poblamos el store en memoria.
 */
/**
 * restoreSession:
 * - Restaura sessionType desde localStorage (si existe).
 * - Si ya hay accessToken válido + user en memoria -> no hace nada.
 * - Si no hay token o expiró -> intenta performRefresh().
 * - Si refresh tuvo éxito -> llama a me() y actualiza el user en store.
 * - Si no hay success -> limpia store por seguridad.
 *
 * Este método está pensado para usarse en APP_INITIALIZER (bootstrap).
 */
public async restoreSession(): Promise<void> {
    try {
      // 1) Restaurar sessionType primero
      await this.restoreSessionTypeFromStorage();

      // 2) Revisa snapshot: si ya hay access token válido y user, no hacemos nada
      const snap = this.authStore.getSnapshot();
      if (snap.accessToken && snap.user && (snap.accessTokenExpiresAt ?? 0) > Date.now()) {
        console.log('[AuthFacade] restoreSession - already have valid access token & user in memory');
      // ya hay user/token válidos en memoria → arrancar reporter passenger
      try { await this.passengerLocationReporter.bootstrapOnLogin(); } catch {}
        return;
      }

      // 3) Intentar silent refresh mediante performRefresh()
      let newAccessToken: string | null = null;
      try {
        console.log('[AuthFacade] restoreSession - attempting silent refresh via performRefresh()');
        const refresh$ = this.performRefresh(); // devuelve Observable<string>
        newAccessToken = await firstValueFrom(refresh$);
      } catch (e) {
        console.warn('[AuthFacade] restoreSession - silent refresh failed or not possible', e);
        newAccessToken = null;
      }

      if (!newAccessToken) {
        // No se pudo renovar => limpiar store por seguridad y salir
        try { this.authStore.clear(); } catch {}
        console.log('[AuthFacade] restoreSession - no token after silent refresh -> cleared store');
        return;
      }

      // 4) Si refresh tuvo éxito: pedir el perfil real al backend y poblar el store
      try {
        const sessionType = this.authStore.sessionType?.() ?? null;
        const useCookie = sessionType === SessionType.WEB || sessionType === SessionType.API_CLIENT;
        console.log('[AuthFacade] restoreSession - calling me() to load profile (useCookie=', useCookie, ')');

        const userFromMe = await firstValueFrom(
          this.authService.me(useCookie).pipe(
            take(1),
            catchError(meErr => {
              // propaga el error para caer al fallback abajo
              throw meErr;
            })
          )
        );

        if (userFromMe && typeof userFromMe === 'object') {
          // Actualizar user en store sin tocar tokens (setAuth sólo user)
          try {
            this.authStore.setAuth({ user: userFromMe } as any);
            console.log('[AuthFacade] restoreSession - profile loaded and stored', userFromMe);
          } catch (e) {
            console.warn('[AuthFacade] restoreSession - failed to set user in store (setAuth), using setUser', e);
            this.authStore.setUser(userFromMe);
          }
        // ✅ En todos los casos exitosos: arrancar presencia del passenger
        try { await this.passengerLocationReporter.bootstrapOnLogin(); } catch {}
          return;
        }

        // Si no vino user, fallback a parseUserFromToken
        const parsed = this.parseUserFromToken(this.authStore.accessToken());
        if (parsed) {
          const currentUser = this.authStore.user?.();
          if (!currentUser) {
            this.authStore.setUser(parsed);
            console.log('[AuthFacade] restoreSession - used parsed token user as fallback', parsed);
          }
        // ✅ Aún con fallback, enciende heartbeat-only
        try { await this.passengerLocationReporter.bootstrapOnLogin(); } catch {}
        } else {
          // Si tampoco hay parsed user -> limpiar por seguridad
          try { this.authStore.clear(); } catch {}
          console.log('[AuthFacade] restoreSession - no profile available after refresh -> cleared store');
        }
      } catch (meErr) {
        // Si me() falla, fallback a parsed token y no sobrescribir user existente
        console.warn('[AuthFacade] restoreSession - me() failed after refresh; falling back to parsed token user', meErr);
        const parsed = this.parseUserFromToken(this.authStore.accessToken());
        if (parsed) {
          const currentUser = this.authStore.user?.();
          if (!currentUser) {
            this.authStore.setUser(parsed);
            console.log('[AuthFacade] restoreSession - set parsed user after me() failure', parsed);
          }
        // ✅ Enciende heartbeat-only también en esta rama
        try { await this.passengerLocationReporter.bootstrapOnLogin(); } catch {}
        } else {
          try { this.authStore.clear(); } catch {}
          console.log('[AuthFacade] restoreSession - no parsed user available -> cleared store');
        }
      }
    } catch (err) {
      console.error('[AuthFacade] restoreSession - unexpected error', err);
      try { this.authStore.clear(); } catch {}
    }
  }

  // ----------------------------
  // clearAll: limpia store, secure storage y redirige al login
  // ----------------------------
public async clearAll(): Promise<void> {
    // 0) Cortar YA cualquier emisión de ubicación del passenger
    try { this.passengerLocationReporter.stop(); } catch {}

    // 1) Cancelar timer de auto-refresh (access token)
    this.clearAutoRefresh(); // debe limpiar this.refreshTimerId internamente

    // 2) Cancelar cualquier refresh en curso (streams/promises)
    try {
      // Señal de cancelación para pipelines con takeUntil(this.refreshCancel$)
      this.refreshCancel$.next();
      // Desuscribirse de streams vivos (si existe)
      this.refreshSubscription?.unsubscribe?.();
      this.refreshSubscription = null;
      // Completar el subject actual para evitar emisiones tardías
      this.refreshCancel$.complete();
    } catch {
      // swallow
    }
    // Re-crear el Subject para futuros logins
    this.refreshCancel$ = new Subject<void>();

    // 3) Limpiar storage (secureStorage.remove devuelve Observable<void>)
    try {
      await firstValueFrom(this.secureStorage.remove('refreshToken'));
    } catch {
      // swallow: si falla el borrado seguimos con la limpieza
    }

    // 4) Borrar sessionType persistido (y cualquier rastro local relacionado)
    try {
      localStorage.removeItem(this.SESSION_TYPE_KEY); // 'auth.sessionType'
      console.log('[AuthFacade] clearAll - removed sessionType from localStorage');
    } catch {
      // noop
    }

    // 5) Limpiar stores (al final, para evitar estados intermedios raros)
    try { this.usersStore.reset(); } catch {}
    try { this.loginStore.clear(); } catch {}
    try { this.authStore.clear(); } catch {}

    // 6) Navegar a login (si corresponde)
    try {
      await this.router.navigateByUrl('/auth/login');
    } catch {
      // swallow navigation errors
    }
  }



  getLoginStatus() {
    return {
      status: this.loginStore.status,
      loading: this.loginStore.loading,
      error: this.loginStore.error,
      formErrors: this.loginStore.formErrors,
    };
  }

  // ----------------------------
  // Helpers: parse JWT payload safely
  // ----------------------------
  private parseUserFromToken(token?: string | null): any | null {
    if (!token) return null;
    try {
      const payload = this.parseJwt<{
        sub?: string;
        email?: string;
        phoneNumber?: string;
      }>(token);
      if (!payload?.sub) return null;
      return {
        id: payload.sub,
        email: payload.email ?? null,
        phoneNumber: payload.phoneNumber ?? null,
      } as any;
    } catch {
      return null;
    }
  }

  // 1) Extraer expiration (exp) del token y devolver timestamp en ms
  private parseExpFromToken(token?: string | null): number | null {
    if (!token) return null;
    const payload = this.parseJwt<{ exp?: number }>(token);
    if (!payload || typeof payload.exp !== 'number') return null;
    // exp viene en segundos desde epoch -> convertir a ms
    return payload.exp * 1000;
  }

  /**
   * Decodes a JWT token and returns its payload.
   */
  private parseJwt<T = any>(token: string): T | null {
    try {
      const base64Url = token.split('.')[1];
      if (!base64Url) return null;
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload) as T;
    } catch {
      return null;
    }
  }

  /**
   * Refresh flow para WEB (cookie-based).
   * - Llama authService.refreshWeb() con withCredentials.
   * - Actualiza accessToken en el store.
   * - En caso de fallo limpia el estado (logout client-side).
   * - Devuelve Observable<string> con el nuevo accessToken.
   */
  refreshWebFlow(): Observable<RefreshResponseWeb> {
    this.authStore.setLoading(true);

    // CAST seguro: sabemos que para useCookie=true el backend debe devolver la forma "web".
    // Hacemos además una comprobación runtime para rechazar si viene `refreshToken`.
    const request$ = this.authService.refresh(
      undefined,
      true
    ) as unknown as Observable<RefreshResponseWeb | RefreshResponseMobile>;

    return (request$ as Observable<RefreshResponseWeb>).pipe(
      take(1),
      mergeMap((res: RefreshResponseWeb) => {
        // runtime guard: si por alguna razón viene refreshToken => rechazamos (no es el flujo web)
        if ((res as any)?.refreshToken !== undefined) {
          return throwError(
            () => new Error('Refresh returned mobile shape while expecting web')
          );
        }

        if (!res || typeof res.accessToken !== 'string') {
          return throwError(
            () => new Error('Respuesta refresh web malformada')
          );
        }

        const accessToken = res.accessToken;
        const accessTokenExpiresAt = (res as any).accessTokenExpiresAt as
          | number
          | undefined;
        const expiresFromJwt = this.parseExpFromToken(accessToken) ?? undefined;
        const finalAccessExpiresAt =
          typeof accessTokenExpiresAt === 'number'
            ? accessTokenExpiresAt
            : expiresFromJwt;
        const user = this.parseUserFromToken(accessToken);

        // Delegar la orquestación a setAccessTokenWithExp (async) y convertir a Observable
        return from(
          this.setAccessTokenWithExp({
            accessToken,
            accessTokenExpiresAt: finalAccessExpiresAt ?? undefined,
            refreshToken: undefined, // web -> refresh token está en cookie
            refreshTokenExpiresAt:
              (res as any).refreshTokenExpiresAt ?? undefined,
            sid: (res as any).sid ?? undefined,
            sessionType:
              (res as any).sessionType ??
              this.authStore.sessionType?.() ??
              undefined,
          })
        ).pipe(map(() => res));
      }),
      catchError((err) => {
        // limpiar store si falla y propagar error normalizado
        this.authStore.clear();
        const normalized =
          typeof (this as any).normalizeError === 'function'
            ? (this as any).normalizeError(err)
            : err;
        return throwError(() => normalized);
      }),
      finalize(() => {
        this.authStore.setLoading(false);
      })
    );
  }

  /**
   * Refresh flow para MOBILE (refreshToken en body).
   * - Lee refreshToken en memoria o secure storage.
   * - Llama authService.refreshMobile(refreshToken).
   * - Actualiza accessToken y (si viene) refreshToken en store y secure storage.
   * - Si falla, limpia estado y borra secure storage.
   * - Devuelve Observable<string> con el nuevo accessToken.
   */
  refreshTokenInMobileFlow(): Observable<RefreshResponseMobile> {
    this.authStore.setLoading(true);

    // Observable que resuelve el refresh response:
    // - obtiene rt (memoria o secure storage)
    // - llama al API con rt
    const refreshResponse$ = defer(() =>
      from(
        (async () => {
          // preferir token en memoria
          let rt: string | null =
            this.authStore.refreshTokenInMemory?.() ?? null;

          if (!rt) {
            try {
              // secureStorage.load devuelve Observable<string|null> en tu impl — usar firstValueFrom para resolverlo
              rt = await firstValueFrom(
                this.secureStorage.load(
                  'refreshToken'
                ) as unknown as Observable<string | null>
              );
            } catch {
              // si falla la conversión, intentar como promise (compatibilidad)
              try {
                rt = await Promise.resolve(
                  this.secureStorage.load('refreshToken') as unknown as Promise<
                    string | null
                  >
                );
              } catch {
                rt = null;
              }
            }
          }

          if (!rt) throw new Error('No hay refresh token disponible');

          // llamar al backend con refreshToken en body
          const resp = await firstValueFrom(
            this.authService.refresh(
              rt,
              false
            ) as Observable<RefreshResponseMobile>
          );
          return resp;
        })()
      )
    );

    return refreshResponse$.pipe(
      take(1),
      mergeMap((res: RefreshResponseMobile) => {
        if (!res || typeof res.accessToken !== 'string') {
          return throwError(
            () => new Error('Respuesta refresh mobile malformada')
          );
        }

        const accessToken = res.accessToken;
        const refreshToken = (res as any).refreshToken as string | undefined;
        const accessTokenExpiresAt = (res as any).accessTokenExpiresAt as
          | number
          | undefined;
        const expiresFromJwt = this.parseExpFromToken(accessToken) ?? undefined;
        const finalAccessExpiresAt =
          typeof accessTokenExpiresAt === 'number'
            ? accessTokenExpiresAt
            : expiresFromJwt;

        const user = this.parseUserFromToken(accessToken);

        // 1) actualizar store y programar scheduling vía setAccessTokenWithExp
        return from(
          this.setAccessTokenWithExp({
            accessToken,
            accessTokenExpiresAt: finalAccessExpiresAt ?? undefined,
            refreshToken: refreshToken ?? undefined, // si viene, será persistido dentro de setAccessTokenWithExp
            refreshTokenExpiresAt:
              (res as any).refreshTokenExpiresAt ?? undefined,
            sid: (res as any).sid ?? undefined,
            sessionType:
              (res as any).sessionType ??
              this.authStore.sessionType?.() ??
              undefined,
            // opcional: user
          })
        ).pipe(
          // 2) si hay refreshToken nuevo, persistirlo en secureStorage (fire-and-forget dentro del flujo)
          mergeMap(() => {
            if (refreshToken) {
              // secureStorage.save devuelve Observable<void>, devolvemos el response al final
              return this.secureStorage
                .save('refreshToken', refreshToken)
                .pipe(map(() => res));
            }
            return of(res);
          })
        );
      }),
      catchError((err) => {
        // limpiar store + borrar secureStorage y propagar error normalizado
        this.authStore.clear();
        // intentar borrar refreshToken de storage (fire-and-forget)
        void firstValueFrom(
          this.secureStorage.remove('refreshToken') as Observable<void>
        ).catch(() => {});
        const normalized =
          typeof (this as any).normalizeError === 'function'
            ? (this as any).normalizeError(err)
            : err;
        return throwError(() => normalized);
      }),
      finalize(() => {
        this.authStore.setLoading(false);
      })
    );
  }

  private normalizeError(err: any): ApiError {
    if (!err) return { message: 'Error desconocido' };

    // HttpErrorResponse con body estructurado
    if (err.error) {
      const body = err.error;
      // Caso típico: { message: '...', code?: '...', details?: ... }
      if (typeof body === 'object') {
        const message =
          body.message ??
          (Array.isArray(body.errors)
            ? body.errors.map((e: any) => e.message || e).join(', ')
            : null);
        return {
          message: message ?? err.message ?? 'Error de servidor',
          status: err.status ?? null,
          code: body.code ?? null,
          // details: body.details ?? body.errors ?? null,
        };
      }
      // body es string
      if (typeof body === 'string') {
        return { message: body, status: err.status ?? null };
      }
    }

    // Fallbacks
    if (err.message)
      return { message: err.message, status: err.status ?? null };
    return { message: 'Error de red', status: err.status ?? null };
  }

 /**
 * Logout para WEB: llamamos al endpoint (cookie-based) y siempre ejecutamos la limpieza local.
 * Devuelve Observable<void>.
 */
logoutWebFlow(): Observable<void> {
  this.authStore.setLoading(true);

  return this.authService.logoutWeb().pipe(
    // si el backend falla, no abortamos la limpieza local — solo logueamos
    catchError((err) => {
      console.warn('[AuthFacade] logoutWeb: error remoto al invocar /auth/logout', err);
      // devolvemos un valor vacío para continuar con la limpieza local
      return of(void 0);
    }),
    // Ejecutar la limpieza centralizada (clearAll devuelve Promise<void>)
    switchMap(() =>
      from(this.clearAll()).pipe(
        catchError((err) => {
          // swallow: clearAll puede fallar (p. ej. navegación); lo logueamos y seguimos
          console.warn('[AuthFacade] logoutWebFlow - clearAll failed', err);
          return of(void 0);
        })
      )
    ),
    finalize(() => {
      this.authStore.setLoading(false);
    }),
    // map al tipo Observable<void>
    map(() => void 0)
  );
}

/**
 * Logout para MOBILE: intentamos enviar refreshToken si existe (memoria o secure storage),
 * pero en cualquier caso limpiamos el cliente y borramos storage.
 */
logoutMobileFlow(): Observable<void> {
  this.authStore.setLoading(true);

  // obtener refresh token (memoria preferida, sino secure storage)
  const inMemory = this.authStore.refreshTokenInMemory();
  const loadRefresh$ = inMemory
    ? of(inMemory)
    : from(this.secureStorage.load('refreshToken')).pipe(
        catchError((err) => {
          console.warn('[AuthFacade] logoutMobile: error cargando refresh token', err);
          return of(null);
        })
      );

  return loadRefresh$.pipe(
    take(1),
    switchMap((refreshToken) => {
      if (!refreshToken) {
        // no hay token que enviar; borramos storage y limpiamos cliente
        return from(this.clearAll()).pipe(
          catchError((err) => {
            console.warn('[AuthFacade] logoutMobileFlow - clearAll failed (no token)', err);
            return of(void 0);
          })
        );
      }

      // si hay refreshToken, invocamos endpoint remoto y luego limpiamos cliente
      return this.authService.logoutMobile(refreshToken).pipe(
        catchError((err) => {
          // si el backend falla, lo logueamos pero seguimos con la limpieza local
          console.warn('[AuthFacade] logoutMobile: error remoto', err);
          return of(void 0);
        }),
        switchMap(() =>
          from(this.clearAll()).pipe(
            catchError((err) => {
              console.warn('[AuthFacade] logoutMobileFlow - clearAll failed (after remote)', err);
              return of(void 0);
            })
          )
        )
      );
    }),
    finalize(() => {
      this.authStore.setLoading(false);
    }),
    map(() => void 0)
  );
}

  /**
   * Limpieza/Logout local centralizado.
   * - Cancela timers de auto-refresh.
   * - Limpia authStore + loginStore.
   * - Borra refreshToken persistente (secureStorage) fire-and-forget.
   * - Opcional: intenta llamar al endpoint de logout remoto (web/mobile) en background.
   * - Navega a /auth/login (fire-and-forget).
   */
  clearLoginState(): void {
    this.loginStore.clear();
  }
}

