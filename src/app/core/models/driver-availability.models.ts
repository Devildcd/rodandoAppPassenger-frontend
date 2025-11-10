export type UUID = string;

export enum AvailabilityReason {
  OFFLINE = 'OFFLINE',
  ON_TRIP = 'ON_TRIP',
  UNAVAILABLE = 'UNAVAILABLE',
}

/** Coincide con tu ResponseDto del backend (toDriverAvailabilityResponseDto) */
export interface DriverAvailabilitySnapshot {
  id: UUID;
  driverId: UUID;

  isOnline: boolean;
  isAvailableForTrips: boolean;

  lastLocation: { lat: number; lng: number } | null;
  lastLocationTimestamp: string | null;       // ISO

  currentTripId: UUID | null;
  currentVehicleId: UUID | null;

  lastOnlineTimestamp: string | null;         // ISO
  availabilityReason: AvailabilityReason | null;

  updatedAt: string;                          // ISO
  deletedAt: string | null;                   // ISO
}

/** Para pings compactos (REST) */
export interface DriverAvailabilityPing {
  lat?: number;
  lng?: number;
  accuracyMeters?: number;
  reportedAt?: string;   // ISO
  forceSave?: boolean;
}

/** Toggle de disponibilidad (desde UI) */
export interface UpdateDriverAvailabilityStatus {
  isAvailableForTrips?: boolean;
}

/** Estado derivado útil para UI/decisiones */
export interface DriverAvailabilityDerived {
  /** “matchable”: online + available + reason NULL + sin trip */
  isMatchable: boolean;
  isOnTrip: boolean;
  isOffline: boolean;
  isUnavailableExplicit: boolean;
}
