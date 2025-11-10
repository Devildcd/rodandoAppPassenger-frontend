import { ApiError, ApiResponse } from "src/app/core/models/api";
import { User } from "src/app/core/models/user/user.response";

// ---------- Helpers generales ----------
export type ID = string;

export type ISODateString = string; // ej. '2025-08-13T12:34:56.000Z'

// ---------- Users state (normalizado minimal) ----------
export interface EntityState<T extends { id: string }> {
  ids: string[];
  entities: Record<string, T>;
  loading?: boolean;
  error?: ApiError | null;
  meta?: Record<string, unknown>;
}

export type UsersState = EntityState<User> & {
  currentUserId?: string | null; // si en el futuro autologin
  lastCreatedUserId?: string | null; // útil para flows de register
};

// ---------- Register operation state (auth slice or ui slice) ----------
export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';

export interface RegisterState {
  status: AsyncStatus;
  loading: boolean;
  error?: ApiError | null;
  // opcional: información contextual
  lastRegisteredUserId?: string | null;
  successMessage?: string | null;
  // formErrors provisto a partir de ApiError.validation (si aplica)
  formErrors?: Record<string, string[]>;
}

// Backend DTO minimal (lo que el backend devuelve dentro de data)
export interface BackendUserDto {
  id: string;
  name: string;
  email: string;
  email_verified?: boolean;
  phone_number?: string | null;
  phone_number_verified?: boolean;
  user_type?: string;
  profile_picture_url?: string | null;
  current_location?: { latitude: number; longitude: number } | null;
  vehicles?: string[] | null;
  status?: string;
  preferred_language?: string | null;
  terms_accepted_at?: string | null;
  privacy_policy_accepted_at?: string | null;
  created_at?: string;
  deleted_at?: string | null;
}

// Respuesta del register endpoint (según tu backend)
export type RegisterUserResponseDto = ApiResponse<BackendUserDto>;

/** Estado de autenticación en memoria (transitorio) */
export interface AuthState {
  status: AsyncStatus;
  // RECOMENDACIÓN: preferible no almacenar accessToken en store persistente.
  // token?: TokenPayload | null;
  // id del usuario autenticado (sin duplicar toda la entidad)
  currentUserId?: ID | null;
  loading?: boolean;
  error?: ApiError | null;
  lastAuthAt?: ISODateString | null;
}
