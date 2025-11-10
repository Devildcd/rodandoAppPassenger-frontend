import { SessionType } from "./auth.auxiliary";

/** Campos comunes que devuelve el backend en login/refresh */
export interface BaseAuthResponse {
  accessToken: string;                    // nuevo access token (siempre)
  accessTokenExpiresAt: number;           // epoch ms
  refreshTokenExpiresAt?: number;         // epoch ms (puede venir en login/refresh)
  sid?: string;                           // jti (presente en refresh principalmente)
  sessionType: SessionType;
}

/** Respuesta que el backend devuelve en login para mobile (devuelve refreshToken en body) */
export interface LoginResponseMobile extends BaseAuthResponse {
  refreshToken: string;
}

/** Respuesta que el backend devuelve en login para web (refresh en cookie) */
export interface LoginResponseWeb extends BaseAuthResponse {
  // No incluir refreshToken en body; para mayor claridad lo marcamos como ausente
  refreshToken?: never;
}

/** Respuesta unificada para login */
export type LoginResponse = LoginResponseMobile | LoginResponseWeb;

/** Respuesta que el backend devuelve al refrescar (mobile: incluye refreshToken; web: no) */
export interface RefreshResponseMobile extends BaseAuthResponse {
  refreshToken: string;
}

export interface RefreshResponseWeb extends BaseAuthResponse {
  refreshToken?: never;
}

export type RefreshResponse = RefreshResponseMobile | RefreshResponseWeb;

/**
 * Respuesta del servidor después de un inicio de sesión exitoso.
 */
// export interface LoginResponseMobile {
//   accessToken: string;
//   refreshToken: string;
//   sessionType : SessionType;
// }

// export interface LoginResponseWeb {
//   accessToken: string | null;
//   sessionType : SessionType;
// }

/**
 * Respuesta del servidor después de refrescar un token de acceso.
 */
// export interface RefreshResponseMobile {
//   accessToken: string;
//   refreshToken: string;
//   sessionType : SessionType;
// }

// export interface RefreshResponseWeb {
//   accessToken: string;
//   sessionType : SessionType;
// }

// export type LoginResponse = LoginResponseMobile | LoginResponseWeb;
// export type RefreshResponse = RefreshResponseMobile | RefreshResponseWeb;
