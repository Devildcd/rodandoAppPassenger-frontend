// auth.store.ts
import { Injectable, signal, computed } from '@angular/core';
import type { User, UserProfile } from '../.././core/models/user/user.response';
import { SessionType } from 'src/app/core/models/auth/auth.auxiliary';

export interface AuthState {
  accessToken: string | null;
  refreshTokenInMemory: string | null; // mobile only (persistir desde facade si se desea)
  user: UserProfile | null;
  loading: boolean;
  error: any | null;
  sessionType?: SessionType | null;
  accessTokenExpiresAt?: number | null; // epoch ms
  refreshTokenExpiresAt?: number | null; // epoch ms (opcional)
  sid?: string | null; // jti de la sesión (opcional)
  refreshInProgress?: boolean; // indicador utilitario (opcional)
}

const initialState: AuthState = {
  accessToken: null,
  refreshTokenInMemory: null,
  user: null,
  loading: false,
  error: null,
  sessionType: null,
  accessTokenExpiresAt: null,
  refreshTokenExpiresAt: null,
  sid: null,
  refreshInProgress: false,
};

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly _state = signal<AuthState>({ ...initialState });

  // --- Computed selectors ---
  readonly accessToken = computed(() => this._state().accessToken);
  readonly refreshTokenInMemory = computed(() => this._state().refreshTokenInMemory);
  readonly user = computed(() => this._state().user);
  readonly loading = computed(() => this._state().loading);
  readonly error = computed(() => this._state().error);
  readonly accessTokenExpiresAt = computed(() => this._state().accessTokenExpiresAt);
  readonly refreshTokenExpiresAt = computed(() => this._state().refreshTokenExpiresAt);
  readonly sid = computed(() => this._state().sid);
  readonly sessionType = computed(() => this._state().sessionType);
  readonly refreshInProgress = computed(() => !!this._state().refreshInProgress);

   // ms restantes hasta que expire el access token (>=0), o null si no hay token/fecha
  readonly accessTokenExpiresIn = computed(() => {
    const at = this._state().accessTokenExpiresAt;
    if (!at) return null;
    return Math.max(0, at - Date.now());
  });

   // booleans convenientes
  readonly isAccessTokenValid = computed(() => {
    const token = this._state().accessToken;
    const exp = this._state().accessTokenExpiresAt ?? 0;
    return !!token && exp > Date.now();
  });

  readonly isAuthenticated = computed(() => {
    const token = this._state().accessToken;
    const user = this._state().user;
    const exp = this._state().accessTokenExpiresAt ?? 0;
    return !!token && !!user && exp > Date.now();
  });

  // --- Internals para auto-refresh ---
  private autoRefreshTimer: number | null = null;
  private autoRefreshCallback?: () => Promise<void>;

// --- Mutations simples ---
  setAccessToken(token: string | null) {
    this._state.update(s => ({ ...s, accessToken: token }));
  }

  setRefreshTokenInMemory(token: string | null, persist?: boolean) {
    // NOTA: Si quieres persistir en secure storage, hazlo desde el facade
    // pasandolo como callback. El store sólo mantiene la copia en memoria.
    this._state.update(s => ({ ...s, refreshTokenInMemory: token }));
  }

  setUser(user: UserProfile | null) {
    this._state.update(s => ({ ...s, user }));
  }

  setLoading(loading: boolean) {
    this._state.update(s => ({ ...s, loading }));
  }

  setError(err: any | null) {
    this._state.update(s => ({ ...s, error: err }));
  }

  setSessionType(type: SessionType | null) {
    this._state.update(s => ({ ...s, sessionType: type }));
  }

  setSid(sid: string | null) {
    this._state.update(s => ({ ...s, sid }));
  }

  setRefreshInProgress(flag: boolean) {
    this._state.update(s => ({ ...s, refreshInProgress: flag }));
  }

/** Setter atómico conveniente para varios campos (ej. al login/refresh) */
  setAuth(payload: {
    accessToken?: string | null;
    accessTokenExpiresAt?: number | null;
    refreshTokenInMemory?: string | null;
    refreshTokenExpiresAt?: number | null;
    user?: UserProfile | null;
    sessionType?: SessionType | null;
    sid?: string | null;
  }) {
    this._state.update(s => ({
      ...s,
      accessToken: payload.accessToken ?? s.accessToken,
      accessTokenExpiresAt: payload.accessTokenExpiresAt ?? s.accessTokenExpiresAt,
      refreshTokenInMemory: payload.refreshTokenInMemory ?? s.refreshTokenInMemory,
      refreshTokenExpiresAt: payload.refreshTokenExpiresAt ?? s.refreshTokenExpiresAt,
      user: payload.user ?? s.user,
      sessionType: payload.sessionType ?? s.sessionType,
      sid: payload.sid ?? s.sid,
    }));
  }

   getSnapshot() { return this._state(); }

  // --- Limpieza ---
  clear() {
    this._state.set({ ...initialState });
  }
}
