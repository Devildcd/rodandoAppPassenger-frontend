import { Injectable } from '@angular/core';
import { Observable, firstValueFrom, of } from 'rxjs';
import { take, catchError, timeout as rxTimeout } from 'rxjs/operators';

import { Capacitor, PermissionState } from '@capacitor/core';
import { Geolocation as CapGeoloc } from '@capacitor/geolocation';

// TIPOS del plugin con alias para evitar choques con DOM
import type {
  PermissionStatus as GeoPermissionStatus,
  Position as CapPosition,
  CallbackID as GeoCallbackID,
} from '@capacitor/geolocation';

import { GeoSample } from '../models/location/location-provider.interface';

@Injectable({ providedIn: 'root' })
export class LocationProvider {
  private watchId: number | null = null;   // id del watch web
  private backoffTimerId: any = null;
  private watchdogTimerId: any = null;
  private lastFixAt = 0;

  // Cuba (con pequeño margen)
  private static readonly CUBA_BBOX = { minLat: 19.5, maxLat: 23.6, minLng: -85.6, maxLng: -73.4 };

  // Detectar Chrome (para ajustar opciones web y evitar proveedor de red)
  private get isChrome(): boolean {
    try {
      return /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
    } catch { return false; }
  }

  private isInsideCuba(lat: number, lng: number): boolean {
    const b = LocationProvider.CUBA_BBOX;
    return lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng;
  }

  private filterCuba(sample: GeoSample | null): GeoSample | null {
    if (!sample) return null;
    return this.isInsideCuba(sample.lat, sample.lng) ? sample : null;
  }

  // -------- one-shot helpers (native -> web) ----------
  private async nativeOnce(high = true, ms = 10_000): Promise<GeoSample | null> {
    if (!Capacitor.isNativePlatform()) return null;
    try {
      let perm: GeoPermissionStatus | null = null;
      try { perm = await CapGeoloc.checkPermissions(); } catch {}
      const state: PermissionState | undefined = perm?.location as PermissionState | undefined;
      if (!state || state === 'denied' || state === 'prompt') {
        try { await CapGeoloc.requestPermissions(); } catch {}
      }
      const pos = await CapGeoloc.getCurrentPosition({ enableHighAccuracy: high, timeout: ms });
      return this.filterCuba({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracyMeters: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
        reportedAt: new Date((pos as any).timestamp ?? Date.now()).toISOString(),
      });
    } catch {
      return null;
    }
  }

  private async webOnce(high = false, ms = 8000): Promise<GeoSample | null> {
    if (!('geolocation' in navigator)) return null;
    // En Chrome forzamos GPS (alta precisión) y evitamos caché para no depender del proveedor de red de Google
    const preferHigh = this.isChrome ? true : high;
    const preferMaxAge = this.isChrome ? 0 : 10_000;

    return await new Promise<GeoSample | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const s = this.filterCuba({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracyMeters: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
            reportedAt: new Date(pos.timestamp || Date.now()).toISOString(),
          });
          resolve(s);
        },
        () => resolve(null),
        { enableHighAccuracy: preferHigh, timeout: ms, maximumAge: preferMaxAge }
      );
    });
  }

  /** Una sola lectura balanceada (prioriza nativo) */
  async getOnceBalanced(): Promise<GeoSample | null> {
    let s = await this.nativeOnce(true, 10_000);
    if (s) return s;
    s = await this.webOnce(false, 8_000);
    if (s) return s;
    return await this.webOnce(true, 10_000);
  }

  /** Espera primer fix válido (solo Cuba). Úsalo tras login. */
  async waitForValidFix(opts: { timeoutMs?: number } = {}): Promise<GeoSample | null> {
    const timeoutMs = opts.timeoutMs ?? 20_000;
    const seed = await this.getOnceBalanced();
    if (seed) return seed;
    return await firstValueFrom(
      this.watchBalanced().pipe(take(1), rxTimeout({ first: timeoutMs }), catchError(() => of(null)))
    );
  }

  // ---------------- watch balanceado + filtro Cuba ----------------
  watchBalanced(): Observable<GeoSample> {
    return new Observable<GeoSample>((observer) => {
      if (!('geolocation' in navigator) && !Capacitor.isNativePlatform()) {
        console.error('[LOC] Geolocation not available');
        return;
      }

      let stopped = false;
      let backoffMs = 1000;

      const nextBackoff = () => {
        if (backoffMs < 2000) backoffMs = 2000;
        else if (backoffMs < 5000) backoffMs = 5000;
        else if (backoffMs < 10000) backoffMs = 10000;
        else backoffMs = 30000;
        return backoffMs;
      };

      const clearBackoffTimer = () => {
        if (this.backoffTimerId) { clearTimeout(this.backoffTimerId); this.backoffTimerId = null; }
      };

      const cleanupWatchWeb = () => {
        if (this.watchId !== null) { navigator.geolocation.clearWatch(this.watchId); this.watchId = null; }
      };

      const armWatchdog = (ms = 60_000) => {
        if (this.watchdogTimerId) clearTimeout(this.watchdogTimerId);
        this.watchdogTimerId = setTimeout(() => {
          if (stopped) return;
          const since = Date.now() - this.lastFixAt;
          console.warn('[LOC] watchdog: no fixes for', since, 'ms → restarting watch');
          cleanupWatchWeb();
          startWatch();
        }, ms);
      };

      const emitIfCuba = (lat: number, lng: number, accuracy: number | null, timestamp?: number) => {
        const sample = this.filterCuba({
          lat, lng, accuracyMeters: accuracy, reportedAt: new Date(timestamp ?? Date.now()).toISOString(),
        });
        if (!sample) return;
        this.lastFixAt = Date.now();
        backoffMs = 1000;
        armWatchdog(60_000);
        observer.next(sample);
      };

      const startWatchWeb = () => {
        // En Chrome, fuerza GPS (alta precisión) y evita maximumAge
        const options: PositionOptions = this.isChrome
          ? { enableHighAccuracy: true, maximumAge: 0 }
          : { enableHighAccuracy: false, maximumAge: 10_000 };

        this.watchId = navigator.geolocation.watchPosition(
          (pos) =>
            emitIfCuba(
              pos.coords.latitude,
              pos.coords.longitude,
              Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
              pos.timestamp
            ),
          (err) => {
            console.warn('[LOC] web watch error', { code: err.code, msg: err.message });
            cleanupWatchWeb();
            clearBackoffTimer();
            if (!stopped) {
              const delay = nextBackoff();
              this.backoffTimerId = setTimeout(() => !stopped && startWatch(), delay);
            }
          },
          options
        );
      };

      let nativeWatcherId: GeoCallbackID | null = null;
      const stopNativeWatch = async () => {
        if (nativeWatcherId) {
          try { await CapGeoloc.clearWatch({ id: nativeWatcherId }); } catch {}
          nativeWatcherId = null;
        }
      };

      const startWatchNative = async () => {
        try {
          nativeWatcherId = await CapGeoloc.watchPosition(
            { enableHighAccuracy: false, timeout: 0 },
            (pos: CapPosition | null, err?: any) => {
              if (err) {
                console.warn('[LOC] native watch error', err);
                stopNativeWatch();
                const delay = nextBackoff();
                this.backoffTimerId = setTimeout(() => !stopped && startWatch(), delay);
                return;
              }
              if (!pos) return;
              emitIfCuba(
                pos.coords.latitude,
                pos.coords.longitude,
                Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
                (pos as any).timestamp
              );
            }
          );
        } catch (e) {
          console.warn('[LOC] native watch start error', e);
          const delay = nextBackoff();
          this.backoffTimerId = setTimeout(() => !stopped && startWatch(), delay);
        }
      };

      const startWatch = () => {
        cleanupWatchWeb();
        clearBackoffTimer();
        armWatchdog(60_000);
        if (Capacitor.isNativePlatform()) startWatchNative();
        else startWatchWeb();
      };

      // Semilla inicial y arranque
      (async () => {
        const seed = await this.getOnceBalanced();
        if (seed) observer.next(seed);
        startWatch();
      })();

      return () => {
        stopped = true;
        cleanupWatchWeb();
        clearBackoffTimer();
        if (this.watchdogTimerId) { clearTimeout(this.watchdogTimerId); this.watchdogTimerId = null; }
        stopNativeWatch();
      };
    });
  }
}
