// auth.interceptor.ts
import { inject } from '@angular/core';
import {
  HttpRequest,
  HttpEvent,
  HttpErrorResponse,
  HttpHandlerFn,
  HttpInterceptorFn,
} from '@angular/common/http';
import { Observable, from, throwError, of } from 'rxjs';
import { mergeMap, catchError } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from 'src/app/store/auth/auth.store';
import { AuthFacade } from 'src/app/store/auth/auth.facade';
import { Router } from '@angular/router';
import { SessionType } from '../models/auth/auth.auxiliary';


const RETRIED_HEADER = 'x-auth-retried';

// single-flight promise
let refreshPromise: Promise<string | null> | null = null;

const isAuthEndpoint = (url: string) => /\/auth\/(refresh|login|logout)/i.test(url);

function attachAccessToken(req: HttpRequest<any>, token?: string | null) {
  if (!token) return req;
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authStore = inject(AuthStore);
  const authFacade = inject(AuthFacade);
  const router = inject(Router);

  if (isAuthEndpoint(req.url)) return next(req);

  const alreadyRetried = !!req.headers.get(RETRIED_HEADER);
  const token = authStore.accessToken?.();
  const authReq = attachAccessToken(req, token ?? undefined);

  return next(authReq).pipe(
    catchError((err: unknown) => {
      if (
        err instanceof HttpErrorResponse &&
        err.status === 401 &&
        !isAuthEndpoint(req.url) &&
        !alreadyRetried
      ) {
        return handle401(req, next, authFacade, authStore, router);
      }
      return throwError(() => err);
    })
  );
};

function handle401(
  req: HttpRequest<any>,
  next: HttpHandlerFn,
  authFacade: AuthFacade,
  authStore: AuthStore,
  router: Router,
): Observable<HttpEvent<any>> {
  // Si ya hay un refresh en curso, espera su resultado (single-flight)
  if (refreshPromise) {
    return from(refreshPromise).pipe(
      mergeMap((newToken) => retryOrLogout(req, next, authFacade, authStore, router, newToken)),
    );
  }

  // Crear la promesa compartida del refresh
  refreshPromise = (async () => {
    try {
      // performRefresh ya decide cookie/body, actualiza store y devuelve el nuevo accessToken
      const res = (authFacade as any).performRefresh?.();
      const newToken: string = typeof res?.subscribe === 'function'
        ? await firstValueFrom(res)
        : (typeof res?.then === 'function' ? await res : res);

      return typeof newToken === 'string' ? newToken : null;
    } catch {
      return null;
    }
  })();

  // Limpia la referencia cuando termine
  refreshPromise.finally(() => { refreshPromise = null; });

  return from(refreshPromise).pipe(
    mergeMap((newToken) => retryOrLogout(req, next, authFacade, authStore, router, newToken)),
  );
}

function retryOrLogout(
  req: HttpRequest<any>,
  next: HttpHandlerFn,
  authFacade: AuthFacade,
  authStore: AuthStore,
  router: Router,
  newToken: string | null
): Observable<HttpEvent<any>> {
  if (!newToken) {
    try { (authFacade as any).clearAll?.(); } catch {}
    try { authStore.clear?.(); } catch {}
    router.navigate(['/auth/login'], { replaceUrl: true }).catch(() => {});
    return throwError(() => new Error('Refresh failed (no token)'));
  }

  // Reintenta con el nuevo token y marca que ya reintentaste
  const retryReq = attachAccessToken(
    req.clone({ setHeaders: { [RETRIED_HEADER]: '1' } }),
    newToken
  );
  return next(retryReq);
}