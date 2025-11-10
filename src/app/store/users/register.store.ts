import { computed, Injectable, Signal, signal } from "@angular/core";
import { ApiError } from "src/app/core/models/api";

export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';

interface RegisterState {
  status: AsyncStatus;
  loading: boolean;
  error?: ApiError | null;
  formErrors?: Record<string, string[]> | null;
  lastRegisteredUserId?: string | null;
  successMessage?: string | null;
}

const initialRegisterState: RegisterState = {
  status: 'idle',
  loading: false,
  error: null,
  formErrors: null,
  lastRegisteredUserId: null,
  successMessage: null,
};

@Injectable({ providedIn: 'root' })
export class RegisterStore {
  private _state = signal<RegisterState>({ ...initialRegisterState });

  readonly status: Signal<AsyncStatus> = computed(() => this._state().status);
  readonly loading: Signal<boolean> = computed(() => this._state().loading);
  readonly error: Signal<ApiError | null | undefined> = computed(() => this._state().error);
  readonly formErrors: Signal<Record<string, string[]> | null | undefined> = computed(() => this._state().formErrors);
  readonly lastRegisteredUserId: Signal<string | null | undefined> = computed(() => this._state().lastRegisteredUserId);

  start(): void {
    this._state.update(s => ({ ...s, status: 'loading', loading: true, error: null, formErrors: null, successMessage: null }));
  }

  success(userId: string, message?: string): void {
    this._state.update(s => ({ ...s, status: 'success', loading: false, lastRegisteredUserId: userId, successMessage: message ?? 'User registered' }));
  }

  setError(apiError: ApiError, formErrors?: Record<string, string[]>): void {
    this._state.update(s => ({ ...s, status: 'error', loading: false, error: apiError, formErrors: formErrors ?? s.formErrors }));
  }

  clear(): void {
    this._state.set({ ...initialRegisterState });
  }
}
