export interface PaginationMeta {
  page?: number;      // 1-based
  limit?: number;
  total?: number;     // total items (opcional)
  totalPages?: number;// opcional
}

// ---------- API / Error ----------
/** Tu tipo ApiError (ajusta según tu proyecto) */
export interface ApiError {
  status?: number;
  message: string;
  code?: string;
  validation?: Record<string, string[]>;
  raw?: any;
  url?: string | null;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  error?: ApiError;
  meta?: PaginationMeta;
}

/** Convenience: respuesta paginada donde data es array */
export type ApiPaginatedResponse<T> = ApiResponse<T[]>;
