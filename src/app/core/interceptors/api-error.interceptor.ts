import {
  HttpErrorResponse,
  HttpInterceptorFn,
} from '@angular/common/http';
import { from, throwError } from 'rxjs';
import { catchError, mergeMap } from 'rxjs/operators';
import { ApiError } from '../models/api';


/**
 * Interceptor funcional que normaliza errores HTTP a ApiError.
 * - Convierte HttpErrorResponse -> ApiError
 * - Extrae code / validation si el body del backend los provee
 * - Re-lanza el ApiError para que services/facades lo manejen
 *
 * Si quieres manejar refresh-token o navegación en 401, usa `inject(...)`
 * para obtener servicios dentro del bloque marcado como ejemplo más abajo.
 */

/**
 * Intenta normalizar/parsear distintos tipos de body (JSON string, Blob, HTML, object)
 */
async function parseBodyMaybeAsync(body: any): Promise<any> {
  // 1) Si es Blob (p.ej. responseType: 'blob'), leer su texto y parsear JSON si es posible
  if (body instanceof Blob) {
    try {
      const text = await body.text();
      try {
        return JSON.parse(text);
      } catch {
        return text; // texto plano o HTML
      }
    } catch {
      return body;
    }
  }

  // 2) Si es string, intentar parsear JSON
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return body;
    }
  }

  // 3) Si ya es objeto, devolver tal cual
  if (body !== null && typeof body === 'object') {
    return body;
  }

  // 4) Otros (ProgressEvent, null, etc.)
  return body;
}

/** Normalize HttpErrorResponse -> ApiError (async) */
function extractApiErrorFields(parsed: any, err: HttpErrorResponse, apiErr: ApiError): void {
  // message
  apiErr.message =
    parsed.message ??
    parsed.error?.message ??
    parsed.detail ??
    parsed.title ??
    err.message ??
    apiErr.message;

  // code
  apiErr.code =
    parsed.code ??
    parsed.errorCode ??
    parsed.error?.code ??
    parsed.statusCode ??
    parsed.error?.status ??
    undefined;

  // validation errors
  apiErr.validation =
    parsed.validation ??
    parsed.errors ??
    parsed.error?.validation ??
    parsed.error?.errors ??
    undefined;

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
    /* ignore header parsing errors */
  }
}

async function normalizeHttpError(err: HttpErrorResponse): Promise<ApiError> {
  const apiErr: ApiError = {
    status: err.status ?? 0,
    message: 'Network error',
    raw: err.error ?? err,
    url: err.url ?? null,
  };

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

/** The HttpInterceptorFn */
export const apiErrorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      // Normalizamos asíncronamente y re-lanzamos como ApiError
      return from(normalizeHttpError(err)).pipe(
        mergeMap((apiErr: ApiError) => {
          // OPTIONAL: logging (descomenta si tienes un LoggerService)
          // const logger = inject(LoggerService, { optional: true });
          // logger?.error(apiErr);

          // OPTIONAL: manejo global 401/403 (no recomendado automatizar refresh aquí sin política)
          // if (apiErr.status === 401) {
          //   const router = inject(Router);
          //   router.navigate(['/auth/login']);
          // }

          return throwError(() => apiErr);
        })
      );
    })
  );
};
