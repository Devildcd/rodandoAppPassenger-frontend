export type PaymentMode = 'cash' | 'card' | 'wallet';

export interface GeoPointDto {
  lat: number;
  lng: number;
}

export interface TripStopCreateDto {
  point: GeoPointDto;
  address?: string;
  placeId?: string;
  notes?: string;
  seq?: number;
  plannedArrivalAt?: string;
}

export interface CreateTripRequest {
  passengerId: string;
  paymentMode: PaymentMode;

  pickupPoint: GeoPointDto;
  pickupAddress?: string | null;

  stops?: TripStopCreateDto[];

  vehicleCategoryId: string;
  serviceClassId: string;

  idempotencyKey?: string; // opcional
}

// Respuesta canónica de tu backend
export interface TripResponseDto {
  // --- Identificadores y Relaciones ---
  id: string;

  passengerId: string;
  paymentMode: PaymentMode | string; // O el tipo de enum/string que uses

  requestedVehicleCategoryId: string;
  requestedServiceClassId: string;

  // --- Puntos Geográficos y Direcciones ---
  pickupPoint: GeoPointDto;
  pickupAddress: string | null;
}
