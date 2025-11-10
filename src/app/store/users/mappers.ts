import { User, UserProfile } from "src/app/core/models/user/user.response";
import { BackendUserDto, RegisterUserResponseDto } from "../users/models";
import { CreateAuthCredentialsPayload, CreateUserPayload, RegisterUserPayload } from "src/app/core/models/user/user.payload";
import { ApiError } from "src/app/core/models/api";
import { pointToLatLng } from "@/app/core/utils/geo.utils";
import { UserStatus } from "@/app/core/models/user/user.auxiliary";

// Normaliza BackendUserDto -> User (frontend model)
export function backendUserDtoToUser(dto: BackendUserDto): User {
  return {
    id: dto.id,
    name: dto.name,
    email: dto.email,
    emailVerified: !!dto.email_verified,
    phoneNumber: dto.phone_number ?? undefined,
    phoneNumberVerified: !!dto.phone_number_verified,
    userType: dto.user_type as any, // si usas enums, mapear explícitamente si difieren
    profilePictureUrl: dto.profile_picture_url ?? undefined,
    // currentLocation: dto.current_location
    //   ? { latitude: dto.current_location.latitude, longitude: dto.current_location.longitude }
    //   : undefined,
    vehicles: dto.vehicles ?? [],
    status: (dto.status ?? 'active') as any,
    preferredLanguage: dto.preferred_language ?? undefined,
    termsAcceptedAt: dto.terms_accepted_at ?? undefined,
    privacyPolicyAcceptedAt: dto.privacy_policy_accepted_at ?? undefined,
    createdAt: dto.created_at ?? "",
    deletedAt: dto.deleted_at ?? undefined,
  };
}

export function mapProfileToUser(id: string, p: UserProfile): User {
  const ll = pointToLatLng(p.currentLocation ?? null);
  return {
    id,
    name: p.name ?? '',
    email: p.email ?? '',
    emailVerified: false,          // si lo necesitas real, tráelo en /profile
    phoneNumber: p.phoneNumber ?? undefined,
    phoneNumberVerified: false,    // idem
    userType: p.userType,
    profilePictureUrl: p.profilePictureUrl ?? undefined,
    currentLocation: ll ? ({ lat: ll.lat, lng: ll.lng } as any) : undefined, // tu User.currentLocation es Geolocation|any
    vehicles: [],
    status: UserStatus.Active,
    preferredLanguage: undefined,
    termsAcceptedAt: undefined,
    privacyPolicyAcceptedAt: undefined,
    createdAt: p.createdAt ?? new Date().toISOString(),
    deletedAt: undefined,
  };
}


// Construye payload para enviar a backend.
export function buildRegisterPayload(
  user: CreateUserPayload,
  credentials: CreateAuthCredentialsPayload
): RegisterUserPayload {
  const userPart: CreateUserPayload = { ...user };
  const credPart: CreateAuthCredentialsPayload = { ...credentials };

  // Ensure we don't send userId (backend will set it)
  delete (credPart as Partial<CreateAuthCredentialsPayload>).userId;

  return {
    user: userPart,
    credentials: credPart,
  };
}


// Helper to purge sensitive info from in-scope objects (best-effort)
export function purgeSensitiveCredentials(payload?: { credentials?: CreateAuthCredentialsPayload }) {
  if (!payload?.credentials) return;
  if ('password' in payload.credentials) {
    // overwrite then delete to help GC
    payload.credentials.password = '';
    delete payload.credentials.password;
  }
}

// Map backend ApiResponse -> either user model or ApiError
export function parseRegisterResponse(resp: RegisterUserResponseDto): { user?: User; error?: ApiError } {
  if (resp.success && resp.data) {
    return { user: backendUserDtoToUser(resp.data) };
  }

  // fallback error mapping
  return {
    error: {
      code: typeof resp.error === 'string' ? resp.error : resp.error?.code ?? 'unknown_error',
      message: resp.message ?? 'Unknown error',
      raw: resp,
    },
  };
}
