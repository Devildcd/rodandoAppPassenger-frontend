import { ServiceClass, VehicleCategory } from "@/app/core/models/trip/catalog.models";
import { FareQuote } from "@/app/core/models/trip/estimate-for-trip.models";
import { PlaceSuggestion } from "@/app/core/models/trip/place-suggestion.model";
import { LatLng } from "@/app/core/utils/geo.utils";
import { computed, Injectable, signal } from "@angular/core";

const fmtCoord = (p: LatLng) => `${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`;

export interface RouteSummary {
  origin: LatLng;
  destination: LatLng;
  originLabel?: string | null;
  destinationLabel?: string | null;
  distanceKm: number;          // p.ej. 12.3
  durationMin: number;         // p.ej. 24
  geometry?: GeoJSON.FeatureCollection<GeoJSON.LineString>;
}

interface TripPlannerState {
  // Origen (autofijado al iniciar la app)
  originPoint: LatLng | null;
  originText: string | null;

  // Destino (texto + coordenada confirmada)
  destinationText: string;
  destinationPoint: LatLng | null;

  // UI
  suggestions: PlaceSuggestion[];
  loading: boolean;
  error: string | null;

  // Resumen de ruta actual
  routeSummary: RouteSummary | null;

  vehicleCategories: VehicleCategory[];
  serviceClasses: ServiceClass[];
  selectedVehicleId: string | null;
  selectedServiceClassId: string | null;

  fareQuote: FareQuote | null;
}

const initialState: TripPlannerState = {
  originPoint: null,
  originText: null,

  destinationText: '',
  destinationPoint: null,

  suggestions: [],
  loading: false,
  error: null,

  routeSummary: null,

  vehicleCategories: [],
  serviceClasses: [],
  selectedVehicleId: null,
  selectedServiceClassId: null,

  fareQuote: null,
};

@Injectable({ providedIn: 'root' })
export class TripPlannerStore {
  private _state = signal<TripPlannerState>({ ...initialState });

  // -------- Selectores
  readonly state = computed(() => this._state());
  readonly originPoint = computed(() => this._state().originPoint);
  readonly originText = computed(() => this._state().originText);
  readonly destinationText = computed(() => this._state().destinationText);
  readonly destinationPoint = computed(() => this._state().destinationPoint);
  readonly suggestions = computed(() => this._state().suggestions);
  readonly loading = computed(() => this._state().loading);
  readonly routeSummary = computed(() => this._state().routeSummary);
  readonly vehicleCategories = computed(() => this._state().vehicleCategories);
  readonly serviceClasses = computed(() => this._state().serviceClasses);
  readonly selectedVehicleId = computed(() => this._state().selectedVehicleId);
  readonly selectedServiceClassId = computed(() => this._state().selectedServiceClassId);
  readonly fareQuote = computed(() => this._state().fareQuote);

  readonly readyToRoute = computed(() =>
    !!(this._state().originPoint && this._state().destinationPoint)
  );

  // -------- Mutaciones

  setOriginPoint(p: LatLng | null, opts: { invalidate?: boolean } = { invalidate: true }) {
  this._state.update(s => ({
    ...s,
    originPoint: p,
    ...(opts.invalidate ? { routeSummary: null, fareQuote: null } : {}),
  }));
}
  setOriginText(label: string | null) {
    this._state.update(s => ({ ...s, originText: label }));
  }

  setDestinationText(t: string) {
    this._state.update(s => ({ ...s, destinationText: t, error: null }));
  }

  setSuggestions(items: PlaceSuggestion[]) {
    this._state.update(s => ({ ...s, suggestions: items }));
  }
  clearSuggestions() {
    this._state.update(s => ({ ...s, suggestions: [] }));
  }

  // ⇣⇣ IMPORTANTE: invalidar cotización al cambiar destino
  setDestinationFromSuggestion(sel: PlaceSuggestion) {
    this._state.update(s => ({
      ...s,
      destinationPoint: sel.coords,
      destinationText: sel.placeName,
      suggestions: [],
      routeSummary: null,
      fareQuote: null,                        // <-- invalida estimado
    }));
  }
  setDestinationPoint(point: LatLng, label?: string | null) {
  this._state.update(s => ({
    ...s,
    destinationPoint: point,
    // ⚠️ si no me das label, borro el texto para forzar reverse y refrescar
    destinationText: (label ?? '').trim(),
    routeSummary: null,
    fareQuote: null,
  }));
}

  setVehicleCategories(list: VehicleCategory[]) {
    this._state.update(s => ({
      ...s,
      vehicleCategories: list,
      selectedVehicleId: s.selectedVehicleId ?? list[0]?.id ?? null,
      // no limpies fare aquí; se limpia al seleccionar categoría
    }));
  }
  setServiceClasses(list: ServiceClass[]) {
    this._state.update(s => ({
      ...s,
      serviceClasses: list,
      selectedServiceClassId: list.length ? list[0].id : null,
      // no limpies fare aquí; se limpia al seleccionar clase
    }));
  }

  // ⇣⇣ INVALIDAN COTIZACIÓN
  selectVehicle(id: string) {
    this._state.update(s => ({
      ...s,
      selectedVehicleId: id,
      fareQuote: null,                        // <-- invalida estimado
    }));
  }
  selectServiceClass(id: string) {
    this._state.update(s => ({
      ...s,
      selectedServiceClassId: id,
      fareQuote: null,                        // <-- invalida estimado
    }));
  }

  setFareQuote(q: FareQuote | null) {
    this._state.update(s => ({ ...s, fareQuote: q }));
  }

  resetPlanningLight() {
  this._state.update(s => ({
    ...s,
    destinationText: '',
    destinationPoint: null,
    suggestions: [],
    routeSummary: null,
    fareQuote: null,
  }));
}

// ✅ si quieres una API “semántica” que use el light-reset
resetKeepOrigin() { this.resetPlanningLight(); }

  clearDestination() {
    this._state.update(s => ({
      ...s,
      destinationPoint: null,
      destinationText: '',
      suggestions: [],
      routeSummary: null,
      fareQuote: null,                        // <-- invalida estimado
    }));
  }

  setLoading(v: boolean) { this._state.update(s => ({ ...s, loading: v })); }
  setError(msg: string | null) { this._state.update(s => ({ ...s, error: msg })); }

  // Si actualizas la ruta (después de Directions), no toco fare aquí,
  // pero si tu flujo recalcula la polyline sin cambiar puntos,
  // puedes decidir invalidarlo:
  setRouteSummary(v: RouteSummary | null) {
    this._state.update(s => ({ ...s, routeSummary: v }));
  }

  clearRoute() {
    this._state.update(s => ({ ...s, routeSummary: null, fareQuote: null }));
  }

  reset() { this._state.set({ ...initialState }); }
}
