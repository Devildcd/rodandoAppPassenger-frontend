import { DebugLogger } from "@/app/core/debug/logger.service";
import { LocationProvider } from "@/app/core/providers/location.provider";
import { PassengerLocationApiService } from "@/app/core/services/http/passenger-location-api.service";
import { haversineMeters } from "@/app/core/utils/distancia-haversine";
import { pointToLatLng } from "@/app/core/utils/geo.utils";
import { AuthStore } from "@/app/store/auth/auth.store";
import { UsersStore } from "@/app/store/users/users.store";
import { effect, inject, Injectable } from "@angular/core";
import { catchError, debounceTime, distinctUntilChanged, EMPTY, filter, firstValueFrom, interval, map, merge, shareReplay, Subject, Subscription, switchMap, take, takeUntil, tap, throttleTime } from "rxjs";

@Injectable({ providedIn: 'root' })
export class PassengerLocationReporter {
  private loc = inject(LocationProvider);
  private api = inject(PassengerLocationApiService);
  private usersStore = inject(UsersStore);
  private authStore = inject(AuthStore);

  private MOVE_THRESHOLD_M = 75;
  private HEARTBEAT_SEC = 60;          // un poco más laxo para passenger
  private MIN_CLIENT_INTERVAL_MS = 3000;

  private stop$ = new Subject<void>();
  private lastSentAt = 0;
  private lastSentPos: { lat: number; lng: number } | null = null;
  private _firstSub?: Subscription;
  private _streamSub?: Subscription;

  /** ====== PUBLIC API ====== */
  async bootstrapOnLogin(): Promise<void> {
    // 1) intentar 1 fix y enviarlo (best-effort)
    try {
      const once = await this.loc.getOnceBalanced();
      if (once) await firstValueFrom(this.api.pingLocation({
        lat: once.lat, lng: once.lng, accuracyMeters: once.accuracyMeters ?? undefined, reportedAt: once.reportedAt
      }));
      this.lastSentAt = Date.now();
      if (once) this.lastSentPos = { lat: once.lat, lng: once.lng };
    } catch (e) {
      console.warn('[PAX] bootstrapOnLogin - first ping failed', e);
    }

    // 2) arrancar heartbeat-only (sin watch)
    this.startHeartbeatOnly();
  }

  /** Modo “ligero”: mantiene presencia sin enviar lat/lng continuamente */
  startHeartbeatOnly() {
    this.stop(); // limpia previo
    console.log('[PAX] reporter START (heartbeat-only)');

    this._streamSub = interval(1000).pipe(
      filter(() => (Date.now() - this.lastSentAt) / 1000 >= this.HEARTBEAT_SEC),
      throttleTime(this.MIN_CLIENT_INTERVAL_MS, undefined, { leading: true, trailing: true }),
      switchMap(() => {
        const payload = { reportedAt: new Date().toISOString() };
        console.log('[HTTP] ping → (heartbeat-only)', payload);
        return this.api.pingLocation(payload).pipe(
          tap(() => { this.lastSentAt = Date.now(); }),
          catchError(err => { console.warn('[PAX] ping error (heartbeat-only)', err); return EMPTY; })
        );
      }),
      takeUntil(this.stop$),
    ).subscribe();
  }

  /** Modo “activo”: igual al driver (watch + move + heartbeat) */
  startActive() {
    this.stop(); // limpia previo
    console.log('[PAX] reporter START (active)');

    const me = this.authStore.user?.();
    const userId = (me as any)?.id;
    if (!userId) { console.warn('[PAX] no userId; reporter no arranca'); return; }

    const location$ = this.loc.watchBalanced().pipe(
      tap(s => console.log('[LOC] sample', s)),
      debounceTime(500),
      distinctUntilChanged((a, b) => haversineMeters(a, b) < 5),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    // first ping forzado
    this._firstSub = location$.pipe(
      take(1),
      switchMap(p => {
        console.log('[HTTP] first ping → (move)', p);
        return this.api.pingLocation({
          lat: p.lat, lng: p.lng, accuracyMeters: p.accuracyMeters ?? undefined, reportedAt: p.reportedAt
        }).pipe(
          tap(profile => {
            this.lastSentAt = Date.now();
            this.lastSentPos = { lat: p.lat, lng: p.lng };
            const pt = profile?.currentLocation;
            if (pt?.type === 'Point' && Array.isArray(pt.coordinates)) {
              const [lng, lat] = pt.coordinates;
              this.usersStore.updateCurrentLocation(userId, lat, lng, p.reportedAt);
            }
          }),
          catchError(err => { console.warn('[PAX] first ping error', err); return EMPTY; })
        );
      })
    ).subscribe();

    const move$ = location$.pipe(
      filter(pos => {
        if (!this.lastSentPos) return false;
        const dist = haversineMeters(this.lastSentPos, pos);
        return dist >= this.MOVE_THRESHOLD_M;
      }),
      map(pos => ({ type: 'move' as const, pos }))
    );

    const tick$ = interval(1000).pipe(
      filter(() => this.lastSentPos !== null),
      filter(() => (Date.now() - this.lastSentAt) / 1000 >= this.HEARTBEAT_SEC),
      map(() => ({ type: 'heartbeat' as const }))
    );

    this._streamSub = merge(move$, tick$).pipe(
      throttleTime(this.MIN_CLIENT_INTERVAL_MS, undefined, { leading: true, trailing: true }),
      switchMap(evt => {
        if (evt.type === 'move') {
          const p = (evt as any).pos;
          return this.api.pingLocation({
            lat: p.lat, lng: p.lng, accuracyMeters: p.accuracyMeters ?? undefined, reportedAt: p.reportedAt
          }).pipe(
            tap(profile => {
              this.lastSentAt = Date.now();
              this.lastSentPos = { lat: p.lat, lng: p.lng };
              const pt = profile?.currentLocation;
              if (pt?.type === 'Point' && Array.isArray(pt.coordinates)) {
                const [lng, lat] = pt.coordinates;
                this.usersStore.updateCurrentLocation(userId, lat, lng, p.reportedAt);
              }
            }),
            catchError(err => { console.warn('[PAX] ping error (move)', err); return EMPTY; })
          );
        } else {
          const payload = { reportedAt: new Date().toISOString() };
          return this.api.pingLocation(payload).pipe(
            tap(() => { this.lastSentAt = Date.now(); }),
            catchError(err => { console.warn('[PAX] ping error (heartbeat)', err); return EMPTY; })
          );
        }
      }),
      takeUntil(this.stop$),
    ).subscribe();
  }

  /** Llamar al cerrar el flujo de selección de pickup */
  backToHeartbeatOnly() {
    this.startHeartbeatOnly();
  }

  stop() {
    this.stop$.next();
    this._firstSub?.unsubscribe();
    this._streamSub?.unsubscribe();
    this.stop$ = new Subject<void>();
    this.lastSentAt = 0;
    this.lastSentPos = null;
    console.log('[PAX] reporter STOP');
  }
}
