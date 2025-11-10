export type LatLngDto = { lat: number; lng: number };

export interface EstimateTripRequest {
  vehicleCategoryId: string;
  serviceClassId: string;
  pickup: { lat: number; lng: number };                 // 👈 pickup (NO pickupPoint)
  stops: Array<{ lat: number; lng: number }>;
  currency?: string;
}

export interface FareBreakdown {
  // usa lo mismo que devuelve tu backend
  distance_km_est: number;
  duration_min_est: number;
  base_fare: number;
  min_fare: number;
  cost_per_km: number;
  cost_per_minute: number;
  subtotal: number;
  total: number;
  surge_multiplier: number;
  // ...otros campos que ya devuelves
}

export interface FareQuote {
  currency: string;
  surgeMultiplier: number;
  totalEstimated: number;
  breakdown: FareBreakdown;
}
