import { DebugLogger } from "@/app/core/debug/logger.service";
import { LocationProvider } from "@/app/core/providers/location.provider";
import { DriverAvailabilityApiService } from "@/app/core/services/http/driver-availability-api.service";
import { haversineMeters } from "@/app/core/utils/distancia-haversine";
import { DriverAvailabilityStore } from "@/app/store/driver-availability/driver.store";
import { effect, inject, Injectable } from "@angular/core";
import { catchError, debounceTime, distinctUntilChanged, EMPTY, filter, interval, map, merge, Subject, switchMap, takeUntil, tap, throttleTime } from "rxjs";

@Injectable({ providedIn: 'root' })
export class DriverAvailabilityReporter {
  private api = inject(DriverAvailabilityApiService);
  private loc = inject(LocationProvider);
  private store = inject(DriverAvailabilityStore);
  private dbg = inject(DebugLogger);

  // parámetros (ajusta a tu estrategia)
  private MOVE_THRESHOLD_M = 75;      // disparo por movimiento
  private HEARTBEAT_SEC = 45;         // heartbeat si no hubo movimiento
  private MIN_CLIENT_INTERVAL_MS = 3000; // seguridad contra flood local

  private stop$ = new Subject<void>();
  private lastSentAt = 0;
  private lastSentPos: { lat: number; lng: number } | null = null;

  /** Arranca reporter (idempotente) */
 start() {
  this.stop(); // asegurar limpio
  this.store.setReporterRunning(true);
  console.log('[DA] reporter START');

  const location$ = this.loc.watchBalanced().pipe(
    // log de cada muestra cruda
    tap(sample => console.log('[LOC] sample', sample)),
    debounceTime(500),
    // evita micro-ruido (<5m)
    distinctUntilChanged((a, b) => haversineMeters(a, b) < 5)
  );

  // Movimiento significativo
  const move$ = location$.pipe(
    filter((pos) => {
      if (!this.lastSentPos) {
        console.log('[DA] first MOVE (no lastSentPos)');
        return true;
      }
      const dist = haversineMeters(this.lastSentPos, pos);
      console.log('[DA] distance check', { dist: dist.toFixed(1), threshold: this.MOVE_THRESHOLD_M });
      return dist >= this.MOVE_THRESHOLD_M;
    }),
    map((pos) => ({ type: 'move' as const, pos }))
  );

  // Heartbeat por tiempo
  const tick$ = interval(1000).pipe(
    filter(() => (Date.now() - this.lastSentAt) / 1000 >= this.HEARTBEAT_SEC),
    map(() => ({ type: 'heartbeat' as const }))
  );

  // Orquestación
  merge(move$, tick$).pipe(
    // evita flood local (tu backend igual tiene throttle)
    throttleTime(this.MIN_CLIENT_INTERVAL_MS, undefined, { leading: true, trailing: false }),

    tap((evt) => {
      if (evt.type === 'move') {
        const p = (evt as any).pos;
        const dist = this.lastSentPos ? haversineMeters(this.lastSentPos, p) : 0;
        console.log('[DA] MOVE trigger', { dist: dist.toFixed(1), pos: p });
      } else {
        console.log('[DA] HEARTBEAT trigger');
      }
    }),

    switchMap((evt) => {
      if (evt.type === 'move') {
        const p = (evt as any).pos;
        const payload = {
          lat: p.lat,
          lng: p.lng,
          accuracyMeters: p.accuracyMeters ?? undefined,
          reportedAt: p.reportedAt,
        };
        console.log('[DA] ping → (move)', payload);
        return this.api.ping(payload).pipe(
          tap((snap) => {
            this.lastSentAt = Date.now();
            this.lastSentPos = { lat: p.lat, lng: p.lng };
            this.store.markLocationSent(this.lastSentAt);
            console.log('[DA] ping ← (move)', {
              hasLocation: !!snap.lastLocation,
              lastLocationTimestamp: snap.lastLocationTimestamp,
              reason: snap.availabilityReason,
            });
          }),
          // si falla el ping, log y seguimos (no matamos el stream)
          catchError((err) => {
            console.warn('[DA] ping error (move)', err);
            return EMPTY;
          })
        );
      } else {
        const payload = { reportedAt: new Date().toISOString() };
        console.log('[DA] ping → (heartbeat)', payload);
        return this.api.ping(payload).pipe(
          tap((snap) => {
            this.lastSentAt = Date.now();
            this.store.markPing(this.lastSentAt);
            console.log('[DA] ping ← (heartbeat)', {
              hasLocation: !!snap.lastLocation,
              lastLocationTimestamp: snap.lastLocationTimestamp,
              reason: snap.availabilityReason,
            });
          }),
          catchError((err) => {
            console.warn('[DA] ping error (heartbeat)', err);
            return EMPTY;
          })
        );
      }
    }),

    takeUntil(this.stop$),
  ).subscribe({
    next: (snap) => {
      // si quieres ver el snapshot completo:
      // console.log('[DA] snapshot after ping', snap);
      this.store.setSnapshot(snap);
    },
    error: (err) => console.warn('[DA] stream error', err),
    complete: () => console.log('[DA] reporter stream complete'),
  });
}

stop() {
  this.stop$.next();
  this.lastSentAt = 0;
  this.lastSentPos = null;
  this.store.setReporterRunning(false);
  console.log('[DA] reporter STOP');
}


  /** Hook: recalcula arranque/parada según snapshot */
  attachAutoLifecycle() {
  effect(() => {
    const s = this.store.snapshot();
    const matchable =
      !!s && s.isOnline === true &&
      s.isAvailableForTrips === true &&
      s.availabilityReason === null &&
      !s.currentTripId;

    // Aquí se escriben señales (start/stop → setReporterRunning), por eso:
    if (matchable) this.start();
    else this.stop();
  }, { allowSignalWrites: true }); // 👈 clave
}
}