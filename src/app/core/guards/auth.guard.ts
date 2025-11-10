import { inject } from '@angular/core';
import {
  Router,
  UrlTree,
  CanActivateFn,
  CanActivateChildFn,
  CanLoadFn,
  CanMatchFn,
  Route,
  UrlSegment,
} from '@angular/router';
import { from, Observable, of } from 'rxjs';
import { map, catchError, take } from 'rxjs/operators';
import { AuthFacade } from 'src/app/store/auth/auth.facade';
import { AuthStore } from 'src/app/store/auth/auth.store';

/** Helper: resultado UrlTree hacia login con returnUrl */
function toLogin(router: Router, returnUrl?: string | undefined): UrlTree {
  // usamos createUrlTree con query param "returnUrl"
  return router.createUrlTree(['/auth/login'], { queryParams: { returnUrl: returnUrl ?? undefined } });
}

/** Normalizador: acepta Observable|Promise|valor y devuelve Observable<T|null> */
function normalizeToObservable<T = any>(maybe: Observable<T> | Promise<T> | T | undefined): Observable<T | null> {
  if (maybe == null) return of(null);
  // si es Observable
  if ((maybe as any)?.subscribe && typeof (maybe as any).subscribe === 'function') {
    return maybe as Observable<T>;
  }
  // si es Promise o valor síncrono
  return from(Promise.resolve(maybe as any));
}

/**
 * Heurística que decide si llamar performRefresh() y mapear resultado a boolean.
 * Devuelve Observable<boolean> con un único valor (take(1)).
 */
function tryRefreshIfSupported(authStore: AuthStore, authFacade: AuthFacade): Observable<boolean> {
  // Si ya autenticado, no hay que refrescar
  try {
    if (authStore.isAuthenticated && authStore.isAuthenticated()) return of(true);
  } catch {
    // si falla la comprobación, intentamos refresh de todas formas
  }

  const canPerform = typeof (authFacade as any).performRefresh === 'function';
  if (!canPerform) return of(false);

  // Ejecutamos performRefresh y normalizamos su resultado a Observable
  const raw = (authFacade as any).performRefresh?.();
  const obs$ = normalizeToObservable(raw).pipe(take(1));

  return obs$.pipe(
    map((tokenOrVal) => {
      // Si el store quedó autenticado por side-effect del refresh -> true
      try {
        if (authStore.isAuthenticated && authStore.isAuthenticated()) return true;
      } catch {}

      // Si el resultado es un string no vacío (access token)
      if (typeof tokenOrVal === 'string' && tokenOrVal.length > 0) return true;

      // Si el resultado es un objeto con accessToken (backend shape)
      if (tokenOrVal && typeof tokenOrVal === 'object' && typeof (tokenOrVal as any).accessToken === 'string') return true;

      // fallback: false
      return false;
    }),
    catchError(() => of(false))
  );
}

/** ---------------------------
 * authGuardWithRefresh -> CanActivate
 * --------------------------- */
export const authGuardWithRefresh: CanActivateFn = (route, state) => {
  const authStore = inject(AuthStore);
  const authFacade = inject(AuthFacade);
  const router = inject(Router);

  try { if (authStore.isAuthenticated && authStore.isAuthenticated()) return true; } catch {}

  return tryRefreshIfSupported(authStore, authFacade).pipe(
    map(ok => (ok ? true : toLogin(router, state.url)))
  );
};

/** ---------------------------
 * authGuardWithRefresh -> CanActivateChild
 * --------------------------- */
export const authGuardWithRefreshChild: CanActivateChildFn = (childRoute, state) => {
  // reutilizamos la misma lógica del guard principal
  return authGuardWithRefresh(childRoute, state);
};

/** ---------------------------
 * authGuardWithRefresh -> CanLoad
 * --------------------------- */
export const authGuardWithRefreshCanLoad: CanLoadFn = (route: Route, segments: UrlSegment[]) => {
  const authStore = inject(AuthStore);
  const authFacade = inject(AuthFacade);

  try { if (authStore.isAuthenticated && authStore.isAuthenticated()) return true; } catch {}

  return tryRefreshIfSupported(authStore, authFacade);
};

/** ---------------------------
 * authGuardWithRefresh -> CanMatch
 * --------------------------- */
export const authGuardWithRefreshCanMatch: CanMatchFn = (route, segments) => {
  const authStore = inject(AuthStore);
  const authFacade = inject(AuthFacade);

  try { if (authStore.isAuthenticated && authStore.isAuthenticated()) return true; } catch {}

  return tryRefreshIfSupported(authStore, authFacade).pipe(map(ok => ok));
};

/** ---------------------------
 * guestGuard -> evita acceso a páginas públicas si ya hay sesión
 * --------------------------- */
export const guestGuard: CanActivateFn = (route, state) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  try {
    if (!authStore.isAuthenticated || !authStore.isAuthenticated()) return true;
  } catch {
    return true;
  }

  // si ya está autenticado redirigir al returnUrl (si viene) o root
  const returnUrl = (route.queryParams && route.queryParams['returnUrl']) ?? (state?.url ?? '/');
  return router.createUrlTree([returnUrl]);
};

/** guest guard para canLoad */
export const guestGuardCanLoad: CanLoadFn = (route, segments) => {
  const authStore = inject(AuthStore);
  try {
    return !(authStore.isAuthenticated && authStore.isAuthenticated());
  } catch {
    return true;
  }
};
