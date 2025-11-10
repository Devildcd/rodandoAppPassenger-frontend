import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
import { ApiError } from '../../models/api';
import { LoginResponse, RefreshResponse, RefreshResponseMobile, RefreshResponseWeb } from '../../models/auth/auth.response';
import { catchError, from, map, mergeMap, Observable, throwError } from 'rxjs';
import { LoginPayload } from '../../models/auth/auth.payload';
import { UserProfile } from '../../models/user/user.response';

/* ----------------- Helpers async para normalizar errores ----------------- */

/** intenta parsear body aunque venga como Blob/string/obj */
async function parseBodyMaybeAsync(body: any): Promise<any> {
  if (body instanceof Blob) {
    try {
      const text = await body.text();
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    } catch {
      return body;
    }
  }

  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return body;
    }
  }

  if (body !== null && typeof body === 'object') {
    return body;
  }

  return body;
}

function extractApiErrorFields(parsed: any, err: HttpErrorResponse, apiErr: ApiError): void {
  apiErr.message =
    parsed?.message ??
    parsed?.error?.message ??
    parsed?.detail ??
    parsed?.title ??
    err.message ??
    apiErr.message;

  apiErr.code =
    parsed?.code ??
    parsed?.errorCode ??
    parsed?.error?.code ??
    parsed?.statusCode ??
    parsed?.error?.status ??
    apiErr.code;

  apiErr.validation =
    parsed?.validation ??
    parsed?.errors ??
    parsed?.error?.validation ??
    parsed?.error?.errors ??
    apiErr.validation;

  apiErr.raw = parsed;
}

function handleParsedString(parsed: string, err: HttpErrorResponse, apiErr: ApiError): void {
  apiErr.raw = parsed;
  if (parsed.length > 0) {
    if (parsed.startsWith('<!DOCTYPE') || parsed.trim().startsWith('<html')) {
      apiErr.message = `Server error (HTML response) - status ${apiErr.status}`;
    } else {
      apiErr.message = parsed;
    }
  } else {
    apiErr.message = err.message ?? apiErr.message;
  }
}

function extractHeaderCode(err: HttpErrorResponse, apiErr: ApiError): void {
  try {
    const headers: any = (err as any).headers;
    if (headers && typeof headers.get === 'function') {
      const hdrCode = headers.get('x-error-code') || headers.get('x-app-error') || headers.get('x-error');
      if (hdrCode && !apiErr.code) apiErr.code = hdrCode;
    }
  } catch {
    // ignore
  }
}

/** Normaliza HttpErrorResponse -> ApiError (async) */
async function normalizeHttpError(err: HttpErrorResponse): Promise<ApiError> {
  const apiErr: ApiError = {
    status: err.status ?? 0,
    message: 'Network error',
    raw: err.error ?? err,
    url: err.url ?? null,
  };

  // network / CORS / progress event
  if (err.error instanceof ProgressEvent || err.status === 0) {
    apiErr.message = 'Network error: please check your connection.';
    apiErr.raw = err.error;
    return apiErr;
  }

  const parsed = await parseBodyMaybeAsync(err.error ?? err);

  if (parsed && typeof parsed === 'object') {
    extractApiErrorFields(parsed, err, apiErr);
  } else if (typeof parsed === 'string') {
    handleParsedString(parsed, err, apiErr);
  } else {
    apiErr.raw = parsed;
    apiErr.message = err.message ?? apiErr.message;
  }

  extractHeaderCode(err, apiErr);
  return apiErr;
}

/**
 * Normaliza cualquier error posible (ApiError | HttpErrorResponse | string | ProgressEvent | unknown)
 * Devuelve Promise<ApiError>
 */
async function normalizeAnyError(err: any, requestUrl?: string): Promise<ApiError> {
  // si ya es ApiError (p.ej. porque otro interceptor lo normalizó)
  if (err && typeof err === 'object' && 'message' in err && ('status' in err || 'raw' in err || 'code' in err)) {
    const api = { ...(err as ApiError) } as ApiError;
    if (!api.url) api.url = requestUrl ?? null;
    return api;
  }

  // HttpErrorResponse -> usa normalizeHttpError
  if (err instanceof HttpErrorResponse) {
    const api = await normalizeHttpError(err);
    if (!api.url) api.url = requestUrl ?? err.url ?? null;
    return api;
  }

  // string
  if (typeof err === 'string') {
    return { message: err, raw: err, url: requestUrl ?? null };
  }

  // ProgressEvent
  if (err instanceof ProgressEvent) {
    return { message: 'Network error: request failed', raw: err, url: requestUrl ?? null };
  }

  // fallback
  try {
    return { message: err?.message ?? 'Unknown error', raw: err, url: requestUrl ?? null };
  } catch {
    return { message: 'Unknown error', raw: err, url: requestUrl ?? null };
  }
}

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly baseUrl = environment.apiUrl;
  private readonly http = inject(HttpClient);

 // --------------------------
  // LOGIN
  // --------------------------
  login(payload: LoginPayload, httpOptions?: { withCredentials?: boolean }): Observable<LoginResponse> {
    const url = `${this.baseUrl}/auth/login`;
    return this.http.post<ApiResponse<LoginResponse>>(url, payload, httpOptions).pipe(
      map(resp => this.unwrap<ApiResponse<LoginResponse>, LoginResponse>(resp, url)),
      // (opcional) validación mínima: debe venir accessToken y sessionType
      map(res => {
        if (!res?.accessToken || !res?.sessionType) {
          throw new Error('Login response malformed: missing accessToken or sessionType');
        }
        return res;
      }),
      catchError(err => this.handleErrorAsApiError(err, url))
    );
  }


  // --------------------------
  // REFRESH unificado
  // --------------------------
  refresh(refreshToken?: string, useCookie = false): Observable<RefreshResponse> {
    const url = `${this.baseUrl}/auth/refresh`;

    if (useCookie) {
      // WEB/API_CLIENT (cookie HttpOnly)
      return this.http.post<ApiResponse<RefreshResponseWeb>>(url, {}, { withCredentials: true }).pipe(
        map(resp => this.unwrap<ApiResponse<RefreshResponseWeb>, RefreshResponseWeb>(resp, url)),
        map(res => this.validateRefreshWebResponse(res, url)),
        catchError(err => this.handleErrorAsApiError(err, url))
      );
    }

    // MOBILE/API_CLIENT (refresh en body)
    if (!refreshToken) {
      return throwError(() => new Error('refreshToken requerido para refresh mobile'));
    }

    return this.http.post<ApiResponse<RefreshResponseMobile>>(url, { refreshToken }).pipe(
      map(resp => this.unwrap<ApiResponse<RefreshResponseMobile>, RefreshResponseMobile>(resp, url)),
      map(res => this.validateRefreshMobileResponse(res, url)),
      catchError(err => this.handleErrorAsApiError(err, url))
    );
  }

  //   refreshWeb(): Observable<RefreshResponseWeb> {
  //   const url = `${this.baseUrl}/auth/refresh`;
  //   return this.http.post<RefreshResponseWeb>(url, {}, { withCredentials: true }).pipe(
  //     map(res => {
  //       if (res?.accessToken === undefined) {
  //         throw new Error('Respuesta de refresh (web) malformada');
  //       }
  //       return res;
  //     }),
  //     catchError(err => this.handleErrorAsApiError(err, url))
  //   );
  // }

  // refreshMobile(refreshToken: string): Observable<RefreshResponseMobile> {
  //   const url = `${this.baseUrl}/auth/refresh`;
  //   return this.http.post<RefreshResponseMobile>(url, { refreshToken }).pipe(
  //     map(res => {
  //       if (!res || typeof res.accessToken !== 'string') {
  //         throw new Error('Respuesta de refresh (mobile) malformada');
  //       }
  //       if (typeof res.refreshToken !== 'string') {
  //         throw new Error('Refresh response mobile no contiene refreshToken');
  //       }
  //       return res;
  //     }),
  //     catchError(err => this.handleErrorAsApiError(err, url))
  //   );
  // }

 // --------- Logout (Web) ----------
   logoutWeb(): Observable<void> {
     const url = `${this.baseUrl}/auth/logout`;
     return this.http.post<void>(url, {}, { withCredentials: true }).pipe(
       catchError(err => this.handleErrorAsApiError(err, url))
     );
   }

   // --------- Logout (Mobile) ----------
   logoutMobile(refreshToken: string): Observable<void> {
     const url = `${this.baseUrl}/auth/logout`;
     return this.http.post<void>(url, { refreshToken }).pipe(
       catchError(err => this.handleErrorAsApiError(err, url))
     );
   }

me(useCookie: boolean = true): Observable<UserProfile> {
  const url = `${this.baseUrl}/users/profile`;
  const options = useCookie ? { withCredentials: true } : {};
  return this.http
    .get<{ success: boolean; message?: string; data?: UserProfile }>(url, options)
    .pipe(
      map(res => {
        if (!res || typeof res.data !== 'object' || res.data === null) {
          throw new Error('Profile response malformed');
        }
        return res.data as UserProfile;
      }),
      catchError(err => this.handleErrorAsApiError(err, url))
    );
}

  // ---------- Helpers / Validaciones ----------

   private unwrap<R extends { data: any }, T>(resp: R, url: string): T {
    if (!resp || typeof resp !== 'object' || !('data' in resp)) {
      throw new Error(`Unexpected response shape from ${url}`);
    }
    return resp.data as T;
  }

  private validateRefreshWebResponse(res: RefreshResponseWeb | null | undefined, requestUrl: string): RefreshResponseWeb {
    if (!res || typeof res.accessToken !== 'string') {
      // Devolvemos error consistente para que el interceptor/facade lo interprete como fallo de refresh
      throw new Error(`Respuesta de refresh (web) malformada: ${requestUrl}`);
    }
    // accessTokenExpiresAt siempre esperado (según backend)
    if (typeof (res as any).accessTokenExpiresAt !== 'number') {
      throw new Error(`Missing accessTokenExpiresAt in refresh (web): ${requestUrl}`);
    }
    return res;
  }

  private validateRefreshMobileResponse(res: RefreshResponseMobile | null | undefined, requestUrl: string): RefreshResponseMobile {
    if (!res || typeof res.accessToken !== 'string') {
      throw new Error(`Respuesta de refresh (mobile) malformada: ${requestUrl}`);
    }
    if (typeof res.refreshToken !== 'string') {
      throw new Error(`Refresh response (mobile) no contiene refreshToken: ${requestUrl}`);
    }
    if (typeof (res as any).accessTokenExpiresAt !== 'number') {
      throw new Error(`Missing accessTokenExpiresAt in refresh (mobile): ${requestUrl}`);
    }
    return res;
  }

  // wrap para usar en catchError: normaliza y re-lanza ApiError
  private handleErrorAsApiError(err: any, requestUrl?: string) {
    return from(normalizeAnyError(err, requestUrl)).pipe(
      mergeMap((apiErr: ApiError) => throwError(() => apiErr))
    );
  }
}
