import { UserType } from "../user/user.auxiliary";

export type AppAudience = 'driver_app' | 'passenger_app' | 'admin_panel' | 'api_client';
/**
 * Payload para la solicitud de inicio de sesión.
 * Requiere 'email' o 'phoneNumber', y 'password'.
 */
export interface LoginPayload {
  id?: string;
  email?: string;
  phoneNumber?: string;
  password: string;
  location?: Location;
  appAudience: AppAudience;         
  expectedUserType: UserType; 
}
