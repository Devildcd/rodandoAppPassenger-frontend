import { UserStatus, UserType } from "./user.auxiliary";

/**
 * Para el perfil público o básico del usuario.
 * Basado en UserProfileDto.
 */
export interface UserProfile {
  id: string;
  name: string | null;
  email: string | null;
  phoneNumber?: string | null;
  profilePictureUrl?: string | null;
  userType: UserType;        
  currentLocation?: {
    type: 'Point';
    coordinates: [number, number]; 
  } | null;
  createdAt?: string;
}

/**
 * Para representar un usuario en una lista.
 * Es una versión más ligera del modelo de usuario completo.
 * Basado en UserListItemDto.
 */
export interface UserListItem {
  id: string;
  name: string;
  email: string;
  profilePictureUrl?: string;
  userType: UserType;
  status: UserStatus;
  phoneNumber?: string;
  createdAt: string;
}

/**
 * Modelo completo del usuario con todos sus detalles.
 * Ideal para una vista de "detalle de usuario" o para el perfil del usuario logueado.
 * Basado en UserResponseDto.
 */
export interface User {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  phoneNumber?: string;
  phoneNumberVerified: boolean;
  userType: UserType;
  profilePictureUrl?: string;
  currentLocation?: Geolocation;
  vehicles: string[];
  status: UserStatus;
  preferredLanguage?: string;
  termsAcceptedAt?: string;
  privacyPolicyAcceptedAt?: string;
  createdAt: string;
  deletedAt?: string;
}
