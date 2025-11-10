// --- ENUMS ---
// Definen un conjunto de constantes nombradas para mejorar la legibilidad y evitar errores.

export enum UserType {
  Passenger = 'passenger',
  Driver = 'driver',
  Admin = 'admin',
}

export type AppAudience = 'driver_app' | 'passenger_app' | 'admin_panel' | 'api_client';

export enum UserStatus {
  Active = 'active',
  Inactive = 'inactive',
  Banned = 'banned',
}

// Este enum se infiere del DTO CreateAuthCredentialsDto
export enum AuthMethod {
  LOCAL = 'local',
  GOOGLE = 'google',
  FACEBOOK = 'facebook',
  APPLE = 'apple',
}


// --- INTERFACES AUXILIARES ---

/**
 * Coordenadas geográficas.
 * Basado en LocationDto.
 */
export interface Location {
  latitude: number;
  longitude: number;
}

/**
 * IDs de proveedores de autenticación OAuth.
 * Basado en OAuthProvidersDto.
 */
export interface OAuthProviders {
  googleId?: string;
  facebookId?: string;
  appleId?: string;
}

export interface PassengerPingDto {
  lat?: number;
  lng?: number;
  accuracyMeters?: number;
  reportedAt?: string;
  forceSave?: boolean;
}
