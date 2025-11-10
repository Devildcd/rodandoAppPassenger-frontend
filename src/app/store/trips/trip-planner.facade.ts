import { computed, effect, inject, Injectable, Injector, signal } from "@angular/core";
import { RouteSummary, TripPlannerStore } from "./trip-planner.store";
import { MapboxPlacesService } from "@/app/core/services/http/mapbox-places.service";
import { AuthStore } from "../auth/auth.store";
import { LocationProvider } from "@/app/core/providers/location.provider";
import { catchError, debounceTime, defer, distinctUntilChanged, finalize, map, of, sampleTime, Subject, Subscription, switchMap, take, tap } from "rxjs";
import { PlaceSuggestion } from "@/app/core/models/trip/place-suggestion.model";
import { fromGeoPoint, LatLng } from "@/app/core/utils/geo.utils";
import { UsersStore } from "../users/users.store";
import { Router } from "@angular/router";
import { MapboxDirectionsService } from "@/app/core/services/http/mapbox-directions.service";
import { CatalogVehiclesService } from "@/app/core/services/http/catalog-vehicles.service";
import { TripsApiService } from "@/app/core/services/http/trips-api.service";
import { EstimateTripRequest, FareQuote } from "@/app/core/models/trip/estimate-for-trip.models";
import { GeoSample } from "@/app/core/models/location/location-provider.interface";

const include = <T extends object>(cond: any, obj: T) => (cond ? obj : {});
const ORIGIN_CACHE_KEY = 'trip.origin';
const DEST_CACHE_KEY   = 'trip.dest';

@Injectable({ providedIn: 'root' })
export class TripPlannerFacade {
  // ────────────────────────────────────────────────────────────────────────────
  //  DI (servicios externos)
  // ────────────────────────────────────────────────────────────────────────────
  private store    = inject(TripPlannerStore);
  private mapbox   = inject(MapboxPlacesService);
  private dir      = inject(MapboxDirectionsService);
  private auth     = inject(AuthStore);
  private users    = inject(UsersStore);
  private loc      = inject(LocationProvider);
  private router   = inject(Router);
  private injector = inject(Injector);
  private catalog  = inject(CatalogVehiclesService);
  private tripsApi = inject(TripsApiService);

  // ────────────────────────────────────────────────────────────────────────────
  //  Estado interno / helpers
  // ────────────────────────────────────────────────────────────────────────────
  // input de destino (para autocomplete)
  private destInput$ = new Subject<string>();
  private sub?: Subscription;

  // cache simple para reverse-geocoding
  private revCache = new Map<string, string>();
  private keyOf = (lng: number, lat: number) => `${lng.toFixed(5)}|${lat.toFixed(5)}`;

  // flags de estimación (evitar llamadas repetidas)
  private quoteInFlight = false;
  private lastEstimateKey: string | null = null;

  // detectar si un label parece “lat,lng”
  private isCoordLike = (s?: string | null) =>
    !!s && /^\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*$/.test(s.trim());

  private originFollowSub?: Subscription;

  // ────────────────────────────────────────────────────────────────────────────
  //  Efectos (reactivos)
  // ────────────────────────────────────────────────────────────────────────────
  // Si ya hay origen+destino y no hay ruta, calcúlala automáticamente
 private autoRouteEffect = effect(() => {
  const ready    = this.store.readyToRoute();
  const hasRoute = !!this.store.routeSummary();
  const loading  = this.store.loading();

  if (ready && !hasRoute && !loading) {
    queueMicrotask(() => {
      // re-chequeo por si algo cambió
      if (this.store.readyToRoute() && !this.store.routeSummary() && !this.store.loading()) {
        this.computeRouteAndStore().pipe(take(1)).subscribe();
      }
    });
  }
}, { injector: this.injector, allowSignalWrites: true });

  // Estimar precio cuando hay ruta + categoría + clase seleccionadas
 private estimateFx = effect(() => {
  const rsReady = !!this.store.routeSummary();
  const vid     = this.store.selectedVehicleId();
  const sid     = this.store.selectedServiceClassId();
  if (!rsReady || !vid || !sid) return;

  const req = this.buildEstimateRequest();
  if (!req) return;

  const key = JSON.stringify({ v: vid, s: sid, o: req.pickup, d: req.stops, c: req.currency });
  if (this.lastEstimateKey === key || this.quoteInFlight) return;

  this.lastEstimateKey = key;
  this.quoteInFlight   = true;

  queueMicrotask(() => {
    this.tripsApi.estimateTrip(req)
      .pipe(take(1), finalize(() => (this.quoteInFlight = false)))
      .subscribe({
        next: q => this.store.setFareQuote(q),
        error: () => this.store.setFareQuote(null),
      });
  });
}, { injector: this.injector, allowSignalWrites: true });

  // Efecto: persistir cuando cambien origen/dest/labels
private persistFx = effect(() => {
  const o  = this.store.originPoint();
  const ol = this.store.originText();
  if (o) this.persistOrigin(o, ol); else this.clearOriginCache();

  const d  = this.store.destinationPoint();
  const dl = this.store.destinationText();
  if (d) this.persistDest(d, dl); else this.clearDestCache();
}, { injector: this.injector });

hardResetPlanning() {
  // limpia store (conserva solo origen si quieres)
  this.store.resetKeepOrigin();
  // flags internos
  this.lastEstimateKey = null;
  this.quoteInFlight   = false;
  // limpia cache de destino para que hydrateFromCache NO lo re-poble
  this.clearDestCache();
}

// Seguir ubicación: refresca origen sin recargar (post-login o en runtime)
private distanceMeters(a: LatLng, b: LatLng) {
  const R = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI/180;
  const dLng = (b.lng - a.lng) * Math.PI/180;
  const s1 = Math.sin(dLat/2)**2;
  const s2 = Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.sqrt(s1+s2));
}

  // ────────────────────────────────────────────────────────────────────────────
  //  Selectores expuestos (para componentes)
  // ────────────────────────────────────────────────────────────────────────────
  getOrigin(): LatLng | null       { return this.store.originPoint(); }
  getDestination(): LatLng | null  { return this.store.destinationPoint(); }
  readyToRoute = computed(() => this.store.readyToRoute());

  // ViewModel para la hoja “Detalles del viaje”
  tripDetailsVm = computed(() => {
    const rs = this.store.routeSummary();
    const fq = this.store.fareQuote();
    return {
      hasRoute: !!rs,
      distanceText: rs ? `${rs.distanceKm.toFixed(1)} km` : '—',
      durationText: rs ? `${rs.durationMin} min` : '—',
      originLabel: this.store.originText() ?? '',
      destinationLabel: this.store.destinationText() ?? '',
      raw: rs ?? null,
      totalEstimated: fq?.totalEstimated ?? null,
      currency: fq?.currency ?? null,
    };
  });

  // Listas para UI (chips y tiles)
  selectedVehicleId      = computed(() => this.store.selectedVehicleId());
  selectedServiceClassId = computed(() => this.store.selectedServiceClassId());
  vehicleTypesVm = computed(() => {
    const cats = this.store.vehicleCategories();
    const sel  = this.store.selectedVehicleId();
    return cats.map(c => ({ value: c.id, label: c.label, selected: c.id === sel }));
  });
  serviceTypesVm = computed(() => {
    const list = this.store.serviceClasses();
    const sel  = this.store.selectedServiceClassId();
    return list.map(s => ({ value: s.id, label: s.label, selected: s.id === sel }));
  });

  // ────────────────────────────────────────────────────────────────────────────
  //  Ciclo de vida / bootstrap
  // ────────────────────────────────────────────────────────────────────────────
  async init(): Promise<void> {
  // 0) Hidratar desde cache (si no hay estado)
  this.hydrateFromCache();

  // Helper: distancia en metros
  const dist = (a: LatLng, b: LatLng) => this.distanceMeters(a, b);
  const inCuba = (lat: number, lng: number) =>
    lat >= 19.5 && lat <= 23.6 && lng >= -85.6 && lng <= -73.4;

  // 1) Seed de origen (perfil o GPS) con reemplazo si cambió “suficiente”
  const current = this.store.originPoint();
  const profile = this.auth.user?.();
  const p = fromGeoPoint((profile as any)?.currentLocation ?? null);

  if (p && inCuba(p.lat, p.lng)) {
    const shouldReplace = !current || dist(current, p) > 40;
    if (shouldReplace) this.setOriginAndLabel({ lat: p.lat, lng: p.lng }); // invalida ruta/fare
  } else if (!current) {
    try {
      const one: GeoSample | null = await this.loc.getOnceBalanced();
      if (one && inCuba(one.lat, one.lng)) {
        const seed = { lat: one.lat, lng: one.lng };
        const shouldReplace = !current || dist(current, seed) > 40;
        if (shouldReplace) this.setOriginAndLabel(seed);
      }
    } catch { /* noop */ }
  }

  // 2) Autocomplete de destino (con clamp por defecto y fallback con proximity)
  this.sub?.unsubscribe();
  this.sub = this.destInput$.pipe(
    debounceTime(250),
    map(v => v.trim()),
    distinctUntilChanged(),
    tap(() => this.store.setLoading(true)),
    switchMap((text) => {
      if (!text || text.length < 3) {
        this.store.setSuggestions([]);
        this.store.setLoading(false);
        return of<PlaceSuggestion[]>([]);
      }

      const baseOpts: Parameters<MapboxPlacesService['search']>[1] = {
        clampToSantiagoProvince: true,
        country: 'cu',
        language: 'es',
        limit: 10,
        types: 'poi,poi.landmark,address,street,place,locality,neighborhood',
        proximity: undefined,
      };

      return this.mapbox.search(text, baseOpts).pipe(
        switchMap(res => {
          if (res.length > 0) return of(res);
          const origin = this.store.originPoint();
          const withProx = {
            ...baseOpts,
            proximity: origin ? { lng: origin.lng, lat: origin.lat } : undefined,
          };
          return this.mapbox.search(text, withProx);
        }),
        // último intento sin clamp (por si el POI quedó fuera del clamp)
        switchMap(res => res.length ? of(res)
                                    : this.mapbox.search(text, { ...baseOpts, clampToSantiagoProvince: false })),
        catchError(() => {
          this.store.setError('No se pudo autocompletar');
          return of<PlaceSuggestion[]>([]);
        }),
        tap(() => this.store.setLoading(false)),
      );
    }),
  ).subscribe(items => this.store.setSuggestions(items));

  // 3) Follow de ubicación en vivo (actualiza origen sin recargar)
  this.originFollowSub?.unsubscribe();
  let last = this.store.originPoint() ?? null;

  this.originFollowSub = this.loc.watchBalanced()
    .pipe(sampleTime(4000)) // cada ~4s
    .subscribe(s => {
      const next = { lat: s.lat, lng: s.lng };
      if (!inCuba(next.lat, next.lng)) return;

      const shouldUpdate = !last || dist(last, next) > 40;
      if (shouldUpdate) {
        this.store.setOriginPoint(next, { invalidate: true }); // trigger autoRouteEffect si ya hay destino
        this.ensureLabelForPoint(next, this.store.originText(), lbl => this.store.setOriginText(lbl));
        last = next;
      }
    });
}

private clearOriginCache() { try { localStorage.removeItem(ORIGIN_CACHE_KEY); } catch {} }
private clearDestCache()   { try { localStorage.removeItem(DEST_CACHE_KEY);   } catch {} }

  destroy(): void {
    this.sub?.unsubscribe();
    this.originFollowSub?.unsubscribe();
  }

  // ────────────────────────────────────────────────────────────────────────────
  //  UI bindings (inputs/selecciones del usuario)
  // ────────────────────────────────────────────────────────────────────────────
  onDestinationInput(text: string) {
    this.store.setDestinationText(text);
    this.destInput$.next(text);
  }

  /** User eligió una sugerencia: fijamos destino preciso, calculamos y navegamos */
  pickSuggestion(item: PlaceSuggestion) {
    this.store.setDestinationFromSuggestion(item);
    this.computeRouteAndStore().pipe(take(1)).subscribe((ok: any) => {
      if (ok) this.router.navigate(['/map']);
    });
  }

  /** Atajo: si pulsa Enter y hay sugerencias */
  confirmDestinationFromFirstSuggestion(): boolean {
    const list = this.store.suggestions();
    if (!list?.length) return false;
    this.pickSuggestion(list[0]);
    return true;
  }

  //Acomodar esto luego
  private persistOrigin(p: LatLng, label?: string | null) {
  try { localStorage.setItem(ORIGIN_CACHE_KEY, JSON.stringify({ lat: p.lat, lng: p.lng, label: label ?? null, ts: Date.now() })); } catch {}
}

private persistDest(p: LatLng, label?: string | null) {
  try { localStorage.setItem(DEST_CACHE_KEY, JSON.stringify({ lat: p.lat, lng: p.lng, label: label ?? null, ts: Date.now() })); } catch {}
}
private hydrateFromCache() {
  try {
    if (!this.store.originPoint()) {
      const raw = localStorage.getItem(ORIGIN_CACHE_KEY);
      if (raw) {
        const v = JSON.parse(raw);
        // TTL 24h y dentro de Cuba
        const fresh = Date.now() - (v.ts ?? 0) < 24 * 3600_000;
        const inCuba = v.lat >= 19.5 && v.lat <= 23.6 && v.lng >= -85.6 && v.lng <= -73.4;
        if (fresh && inCuba) {
          this.store.setOriginPoint({ lat: v.lat, lng: v.lng }, { invalidate: true });
          this.store.setOriginText(v.label ?? null);
        }
      }
    }
    if (!this.store.destinationPoint()) {
      const raw = localStorage.getItem(DEST_CACHE_KEY);
      if (raw) {
        const v = JSON.parse(raw);
        const inCuba = v.lat >= 19.5 && v.lat <= 23.6 && v.lng >= -85.6 && v.lng <= -73.4;
        if (inCuba) {
          this.store.setDestinationPoint({ lat: v.lat, lng: v.lng }, v.label ?? null);
        }
      }
    }
  } catch {}
}

  /** Mueve el pin para corregir destino -> re-calcula ruta */
  recalcRouteAfterAdjust(point: LatLng, label?: string | null) {
    this.store.setDestinationPoint(point, label); // si label = null, forzamos reverse
    this.computeRouteAndStore().pipe(take(1)).subscribe();
  }

  /** Selecciones */
  selectVehicle     = (id: string) => this.store.selectVehicle(id);
  selectServiceType = (id: string) => this.store.selectServiceClass(id);

  // ────────────────────────────────────────────────────────────────────────────
  //  Catálogo (categorías / clases) – carga idempotente
  // ────────────────────────────────────────────────────────────────────────────
  private catsLoading = false;
  private classesLoading = false;

  ensureCatalogLoaded = () => {
    // 1) Categorías
    if (this.store.vehicleCategories().length === 0 && !this.catsLoading) {
      this.catsLoading = true;
      this.catalog.fetchVehicleCategories().pipe(take(1)).subscribe({
        next: list => {
          this.store.setVehicleCategories(list ?? []);
          this.catsLoading = false;
          // 2) Clases (independientes de la categoría)
          this.loadServiceClasses();
        },
        error: () => {
          this.store.setVehicleCategories([]);
          this.catsLoading = false;
        },
      });
      return; // la carga de clases se encadenó arriba
    }
    // Si ya había categorías pero aún no hay clases
    this.loadServiceClasses();
  };

  private loadServiceClasses() {
    if (this.classesLoading || this.store.serviceClasses().length > 0) return;
    this.classesLoading = true;
    this.catalog.fetchServiceClasses()  // ← sin args: backend devuelve todas
      .pipe(take(1))
      .subscribe({
        next: list => { this.store.setServiceClasses(list ?? []); this.classesLoading = false; },
        error: ()   => { this.store.setServiceClasses([]);        this.classesLoading = false; },
      });
  }

  // ────────────────────────────────────────────────────────────────────────────
  //  Routing (directions) + reverse labels + persistencia en store
  // ────────────────────────────────────────────────────────────────────────────
  private setOriginAndLabel(point: LatLng) {
    this.store.setOriginPoint(point);
    const key = this.keyOf(point.lng, point.lat);
    const cached = this.revCache.get(key);
    if (cached) { this.store.setOriginText(cached); return; }

    this.mapbox.reverse(point.lng, point.lat, { clampToSantiagoProvince: true, language: 'es' })
      .pipe(take(1), catchError(() => of(null)))
      .subscribe(res => {
        const label = res?.label ?? `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`;
        this.revCache.set(key, label);
        this.store.setOriginText(label);
      });
  }

  // Garantiza que, si el label está ausente o es coord-like, se haga reverse y se guarde
  private ensureLabelForPoint(
    point: LatLng | null | undefined,
    current: string | null,
    setLabel: (label: string) => void
  ) {
    if (!point) return;
    const hasDecent = !!(current && current.trim().length >= 3);
    if (hasDecent) return;

    const key = this.keyOf(point.lng, point.lat);
    const cached = this.revCache.get(key);
    if (cached) { setLabel(cached); return; }

    this.mapbox.reverse(point.lng, point.lat, { clampToSantiagoProvince: true, language: 'es' })
      .pipe(take(1), catchError(() => of(null)))
      .subscribe(res => {
        const label = res?.label ?? `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`;
        this.revCache.set(key, label);
        setLabel(label);
      });
  }

  // Cálculo de ruta + fijar labels “bonitos” en background
  computeRouteAndStore() {
  const origin = this.store.originPoint();
  const dest   = this.store.destinationPoint();
  if (!origin || !dest) return of(false);

  const originLabelRaw      = this.store.originText();
  const destinationLabelRaw = this.store.destinationText();
  const originLabelSafe      = this.isCoordLike(originLabelRaw) ? null : (originLabelRaw ?? null);
  const destinationLabelSafe = this.isCoordLike(destinationLabelRaw) ? null : (destinationLabelRaw ?? null);

  // ⬇️ todo lo que escribe señales se difiere a la suscripción
  return defer(() => {
    this.store.setLoading(true);

    return this.dir.getRoute(origin, dest).pipe(
      map(res => {
        const summary: RouteSummary = {
          origin,
          destination: dest,
          originLabel:      originLabelSafe ?? undefined,
          destinationLabel: destinationLabelSafe ?? undefined,
          distanceKm:  Number(res.distanceKm.toFixed(1)),
          durationMin: Math.round(res.durationMin),
          geometry:    res.feature,
        };
        this.store.setRouteSummary(summary);

        this.ensureLabelForPoint(summary.origin,      summary.originLabel ?? null,      lbl => this.store.setOriginText(lbl));
        this.ensureLabelForPoint(summary.destination, summary.destinationLabel ?? null, lbl => this.store.setDestinationText(lbl));
        return true;
      }),
      catchError(() => {
        this.store.setError('No se pudo calcular la ruta');
        this.store.setRouteSummary(null);
        return of(false);
      }),
      finalize(() => this.store.setLoading(false)),
    );
  });
}

  // Reinicio “suave” al salir del mapa (conserva origen y catálogo)
  resetPlanning() {
    this.store.resetKeepOrigin();
    this.lastEstimateKey = null;
    this.quoteInFlight   = false;
  }

  // ────────────────────────────────────────────────────────────────────────────
  //  Estimación (payload y refresh)
  // ────────────────────────────────────────────────────────────────────────────
  private buildEstimateRequest(): EstimateTripRequest | null {
    const origin = this.store.originPoint();
    const dest   = this.store.destinationPoint();
    const vid    = this.store.selectedVehicleId();
    const sid    = this.store.selectedServiceClassId();
    if (!origin || !dest || !vid || !sid) return null;

    return {
      vehicleCategoryId: vid,
      serviceClassId: sid,
      pickup: { lat: origin.lat, lng: origin.lng },
      stops:  [{ lat: dest.lat, lng: dest.lng }],
      currency: 'CUP',
    };
  }

  // Permite “forzar” el re-cálculo manualmente
  refreshEstimate = () => {
    this.lastEstimateKey = null;
    (this as any).estimateFx.run?.();
  };

  // ────────────────────────────────────────────────────────────────────────────
  //  Payload final para crear el viaje
  // ────────────────────────────────────────────────────────────────────────────
 buildCreateTripPayload(base: {
  passengerId: string;
  paymentMode: 'cash' | 'card' | 'wallet';
  vehicleCategoryId: string;
  serviceClassId: string;
  pickupAddress?: string | null;
  idempotencyKey?: string;
}) {
  const origin = this.store.originPoint();
  const dest   = this.store.destinationPoint();
  if (!origin || !dest) throw new Error('Origen y destino son obligatorios');

  const originLabelRaw = this.store.originText();
  const destLabelRaw   = this.store.destinationText();

  // si parecen coords, los tratamos como “sin label”
  const pickupAddr = this.isCoordLike(originLabelRaw) ? undefined
                   : (originLabelRaw?.trim() ? originLabelRaw.trim() : undefined);

  const destAddr   = this.isCoordLike(destLabelRaw) ? undefined
                   : (destLabelRaw?.trim() ? destLabelRaw.trim() : undefined);

  const stop = {
    point: { lat: dest.lat, lng: dest.lng },
    ...include(destAddr, { address: destAddr! }),   // ⬅️ sólo si hay string
  };

  return {
    passengerId:      base.passengerId,
    paymentMode:      base.paymentMode,
    pickupPoint:      { lat: origin.lat, lng: origin.lng },
    ...include(pickupAddr, { pickupAddress: pickupAddr! }),   // ⬅️ sólo si hay string
    stops:            [stop],
    vehicleCategoryId: base.vehicleCategoryId,
    serviceClassId:    base.serviceClassId,
    ...include(base.idempotencyKey, { idempotencyKey: base.idempotencyKey! }), // opcional
  };
}

// Acción: enviar solicitud de viaje
requestTrip = (opts?: { payment?: 'cash'|'card'|'wallet'; pickupAddress?: string | null }) => {
  // 1) Recolectar selección actual desde el store/auth
  const userId  = this.auth.user?.()?.id as string; // Ajusta según tu AuthStore
  const vid     = this.store.selectedVehicleId();
  const sid     = this.store.selectedServiceClassId();
  const address = opts?.pickupAddress ?? (this.store.originText() ?? null);

  if (!userId || !vid || !sid) {
    this.store.setError('Faltan datos para solicitar el viaje');
    return;
  }

   const originLabelRaw = this.store.originText();
  const pickupAddr =
  this.isCoordLike(originLabelRaw) ? undefined
  : (originLabelRaw?.trim() || undefined);

  const payload = this.buildCreateTripPayload({
    passengerId: userId,
    paymentMode: opts?.payment ?? 'cash',
    vehicleCategoryId: vid!,
    serviceClassId: sid!,
    pickupAddress: pickupAddr,
    idempotencyKey: this.uuid4(),
  });
  console.log(payload)

  // 3) Llamar API
  this.store.setLoading(true);
  this.tripsApi.createTrip(payload).pipe(
    take(1),
    finalize(() => this.store.setLoading(false)),
  ).subscribe(res => {
    if (!res) {
      this.store.setError('No se pudo crear el viaje');
      return;
    }

    // ✅ Exitoso: navega al flujo de progreso
    // (si quieres persistir ID en un store de “viaje activo”, hazlo aquí)
    // e.g. this.activeTripStore.set(res);

    this.router.navigate(['/trip-progress/driver-arriving']);
    // Nota: no resetees el planning ahora; en esta fase quieres conservar estado
    // para re-mostrar detalles del viaje activo más adelante.
  });
};

  // ────────────────────────────────────────────────────────────────────────────
  //  Utils de formateo (por si los usas en otros VMs)
  // ────────────────────────────────────────────────────────────────────────────
  private fmtKm  = (km: number | null | undefined)  =>
    (typeof km === 'number' && isFinite(km)) ? `${km.toFixed(km < 10 ? 1 : 0)} km` : '—';

  private fmtMin = (min: number | null | undefined) =>
    (typeof min === 'number' && isFinite(min)) ? `≈ ${min} min` : '—';

  // Utils: idempotency key (simple v4-like)
private uuid4(): string {
  // si luego agregas 'uuid' lib, reemplaza esto
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (crypto.getRandomValues(new Uint8Array(1))[0] & 0xf) >> 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
}
