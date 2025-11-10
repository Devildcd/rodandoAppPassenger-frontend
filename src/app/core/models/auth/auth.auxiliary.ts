/**
 * Tipos de sesión disponibles para el login.
 */
export enum SessionType {
  WEB = 'web',
  MOBILE_APP = 'mobile_app',
  ADMIN_PANEL = 'admin_panel',
  API_CLIENT = 'api_client',
}

/**
 * Información sobre el dispositivo del cliente que inicia sesión.
 */
export interface DeviceInfo {
  os?: string;
  browser?: string;
  model?: string;
  appVersion?: string;
}

/**
 * Ubicación geográfica del cliente.
 */
export interface Location {
  latitude: number;
  longitude: number;
  city?: string;
  country?: string;
}
