export interface VehicleCategoryDto {
  id: string;
  name: string;
  description?: string;
  iconUrl?: string;
  isActive?: boolean;
}

export interface ServiceClassDto {
  id: string;
  name: string;
  description?: string;
  baseFareMultiplier?: string;
  costPerKmMultiplier?: string;
  costPerMinuteMultiplier?: string;
  minFareMultiplier?: string;
  minCapacity?: number;
  maxCapacity?: number;
  iconUrl?: string;
  isActive?: boolean;
}

// === Modelos internos (los que usa tu app) ===
export interface VehicleCategory {
  id: string;
  label: string;
  icon?: string; // opcional, genérico por nombre
}

export interface ServiceClass {
  id: string;
  label: string;
  icon?: string; // opcional, genérico por nombre
  // campos futuros: etaPickupMin, pricePreview...
}
