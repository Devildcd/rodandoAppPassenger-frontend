import { AuthMethod, OAuthProviders, UserStatus, UserType } from "./user.auxiliary";

/**
 * Datos para crear las credenciales de un usuario.
 * Basado en CreateAuthCredentialsDto.
 */
export interface CreateAuthCredentialsPayload {
  authenticationMethod: AuthMethod;
  userId?: string;
  password?: string;
  oauthProviders?: OAuthProviders;
  // Se incluyen otras propiedades opcionales del DTO por si se necesitaran en el frontend
  mfaEnabled?: boolean;
  lastPasswordChangeAt?: string;
}

/**
 * Datos para actualizar las credenciales. Es un subconjunto opcional de la creación.
 * Usamos Partial<T> para hacer que todas las propiedades sean opcionales.
 */
export type UpdateAuthCredentialsPayload = Partial<CreateAuthCredentialsPayload>;

/**
 * Datos para crear el perfil de un usuario.
 * Basado en CreateUserDto.
 */
export interface CreateUserPayload {
  name: string;
  email: string;
  userType: UserType;
  phoneNumber?: string;
  status?: UserStatus;
  profilePictureUrl?: string;
  currentLocation?: Location;
  vehicleId?: string;
  preferredLanguage?: string;
  // Se usa 'string' para fechas en formato ISO que se envían a la API
  termsAcceptedAt?: string;
  privacyPolicyAcceptedAt?: string;
}

/**
 * Datos para actualizar el perfil de un usuario.
 * Todas las propiedades son opcionales.
 */
export type UpdateUserPayload = Partial<CreateUserPayload>;

/**
 * Payload completo para el endpoint de registro de un nuevo usuario.
 * Combina el perfil del usuario y sus credenciales.
 * Basado en RegisterUserDto.
 */
export interface RegisterUserPayload {
  user: CreateUserPayload;
  credentials: CreateAuthCredentialsPayload;
}

/**
   * La nueva contraseña del usuario.
   * @example 'MiNuevaContrasenaSegura123!'
   */
  /**
   * Confirmación de la nueva contraseña, debe coincidir con `newPassword`.
   * @example 'MiNuevaContrasenaSegura123!'
   */
export interface ChangePasswordPayload {
  newPassword: string;
  confirmPassword: string;
}

