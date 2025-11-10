import { Injectable, signal, computed, Signal } from '@angular/core';
import { ApiError } from 'src/app/core/models/api';

export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';

interface LoginState {
  status: AsyncStatus;
  loading: boolean;
  error?: ApiError | null;
  formErrors?: Record<string, string[]> | null;
}

const initialLoginState: LoginState = {
  status: 'idle',
  loading: false,
  error: null,
  formErrors: null,
};

@Injectable({ providedIn: 'root' })
export class LoginStore {
  private readonly _state = signal<LoginState>({ ...initialLoginState });

  // Selectors / computed signals que consume el componente
  readonly status: Signal<AsyncStatus> = computed(() => this._state().status);
  readonly loading: Signal<boolean> = computed(() => this._state().loading);
  readonly error: Signal<ApiError | null | undefined> = computed(() => this._state().error);
  readonly formErrors: Signal<Record<string, string[]> | null | undefined> = computed(() => this._state().formErrors);

  // --- Mutaciones públicas (API del store) ---

  // Marcar inicio del flujo de login
  start(): void {
    this._state.update(s => ({ ...s, status: 'loading', loading: true, error: null, formErrors: null }));
  }

  // Marcar éxito (puedes enviar mensaje u otro dato si lo deseas)
  success(): void {
    this._state.update(s => ({ ...s, status: 'success', loading: false, error: null, formErrors: null }));
  }

  // Establecer error genérico + opcional formErrors
  setError(apiError: ApiError, formErrors?: Record<string, string[]> | null): void {
    this._state.update(s => ({ ...s, status: 'error', loading: false, error: apiError, formErrors: formErrors ?? null }));
  }

  // Solo setear formErrors (útil si quieres mostrar errores de validación sin tocar error.message)
  setFormErrors(formErrors: Record<string, string[]> | null): void {
    this._state.update(s => ({ ...s, formErrors, status: formErrors ? 'error' : s.status, loading: false }));
  }

  // Limpia el estado (volver al inicial)
  clear(): void {
    this._state.set({ ...initialLoginState });
  }

  // --- Helper: normalizar/parsear respuesta de error del backend ---
  // Entrada: cualquier objeto de error que venga del HttpClient.
  // Resultado: actualiza el store llamando a setError + setFormErrors según aplique.
  handleApiError(err: any): void {
    const apiError: ApiError = { message: 'Error desconocido', code: undefined, status: undefined, raw: err };

    try {
      if (!err) {
        this.setError(apiError, null);
        return;
      }

      // HttpErrorResponse típico: err.error may contain body
      if (err.error && typeof err.error === 'object') {
        const body = err.error;
        apiError.message = body.message ?? err.message ?? apiError.message;
        apiError.code = body.code ?? apiError.code;
        apiError.status = err.status ?? apiError.status;
        apiError.raw = body;

        // Normalizar errores de validación en body.errors (forma común)
        if (body.errors && typeof body.errors === 'object') {
          // body.errors expected: { fieldName: [msg1, msg2], ... }
          this.setError(apiError, body.errors as Record<string, string[]>);
          return;
        }

        // fallback: some backends return { errors: [{ field, message }, ...] }
        if (Array.isArray(body.errors)) {
          const map: Record<string, string[]> = {};
          for (const e of body.errors) {
            const key = e.field ?? 'global';
            const msg = e.message ?? String(e);
            map[key] = map[key] ?? [];
            map[key].push(msg);
          }
          this.setError(apiError, map);
          return;
        }
      }

      // Si body es string
      if (typeof err.error === 'string') {
        apiError.message = err.error;
        apiError.status = err.status ?? null;
        this.setError(apiError, null);
        return;
      }

      // Fallback para mensajes simples
      if (err.message) {
        apiError.message = err.message;
        apiError.status = err.status ?? null;
      } else {
        apiError.message = 'Error de red';
      }

    } catch (e) {
      apiError.message = apiError.message ?? 'Error desconocido';
      apiError.raw = err;
    }

    this.setError(apiError, null);
  }
}
