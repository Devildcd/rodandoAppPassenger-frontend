import { environment } from '@/environments/environment';
import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';
import { LatLng, PlaceSuggestion } from '../../models/trip/place-suggestion.model';

type MbContext = { id: string; text: string };
const REV_TYPES = 'poi,address,place,locality,neighborhood';

export interface ReverseResult {
  label: string;                 // Texto bonito para UI
  coords: { lat: number; lng: number }; // Centro del feature elegido
}

type MbFeature = {
  id: string;
  text: string;
  place_name: string;
  center: [number, number]; // [lng, lat]
  context?: MbContext[];
};
type MbResponse = { type: 'FeatureCollection'; features: MbFeature[] };

export type BBox = [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
export interface SearchOpts {
  proximity?: LatLng;
  bbox?: BBox;
  country?: string;   // 'cu'
  limit?: number;     // <= 10 (Mapbox tope)
  types?: string;     // válidos: poi,poi.landmark,address,place,locality,neighborhood,region,district,postcode,country
  language?: string;  // 'es'
  clampToSantiagoProvince?: boolean;
}

@Injectable({ providedIn: 'root' })
export class MapboxPlacesService {
  private http = inject(HttpClient);
  private token = environment.mapbox.accessToken;

  // BBOX aproximado para la provincia de Santiago de Cuba
  private SCU_PROV_BBOX: BBox = [-76.30, 19.60, -75.10, 20.60];
  private SCU_PROV_CENTER: LatLng = { lng: -75.82, lat: 20.02 };

  private isInSantiagoProvince(f: MbFeature): boolean {
    const ctx = f.context ?? [];
    const tail = (f.place_name || '').toLowerCase();
    const texts = ctx.map(c => (c?.text || '').toLowerCase());
    return tail.includes('santiago de cuba') || texts.some(t => t.includes('santiago de cuba'));
  }

  private stripSantiagoTail(label: string): string {
    return label
      .replace(/,\s*Santiago de Cuba(?:,\s*Cuba)?$/i, '')
      .replace(/,\s*Cuba$/i, '');
  }

  search(query: string, opts: SearchOpts = {}): Observable<PlaceSuggestion[]> {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`;

    const clamp = opts.clampToSantiagoProvince !== false;
    const bbox = clamp ? (opts.bbox ?? this.SCU_PROV_BBOX) : opts.bbox;
    const proximity = clamp ? (opts.proximity ?? this.SCU_PROV_CENTER) : opts.proximity;

    const types = opts.types ?? 'poi,poi.landmark,address,place,locality,neighborhood';

    let params = new HttpParams()
      .set('access_token', this.token)
      // .set('autocomplete', 'true')
      // .set('fuzzyMatch', 'true')
      // .set('limit', String(Math.min(opts.limit ?? 10, 10)))
      // .set('language', opts.language ?? 'es')
      // .set('types', types)
      // .set('country', opts.country ?? 'cu');

    if (proximity) params = params.set('proximity', `${proximity.lng},${proximity.lat}`);
    if (bbox) params = params.set('bbox', bbox.join(','));

    return this.http.get<MbResponse>(url, { params }).pipe(
      map(res => res?.features ?? []),
      map(fs => clamp ? fs.filter(f => this.isInSantiagoProvince(f)) : fs),
      map(features => features.map(f => ({
        id: f.id,
        text: f.text,
        placeName: this.stripSantiagoTail(f.place_name),
        coords: { lat: f.center[1], lng: f.center[0] },
      } as PlaceSuggestion)))
    );
  }

  /** Reverse geocoding: coords -> label humano */
  reverse(
    lng: number,
    lat: number,
    opts?: { clampToSantiagoProvince?: boolean; language?: string }
  ): Observable<ReverseResult | null> {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json`;

    // ⚠️ NADA de bbox/country aquí; causan 422 en reverse
    let params = new HttpParams()
      .set('access_token', this.token)
    // .set('types', REV_TYPES)
    // .set('limit', '5')
    // .set('language', opts?.language ?? 'es');

    return this.http.get<MbResponse>(url, { params }).pipe(
      map(res => res?.features ?? []),
      // Si quieres “acotar” a la provincia, filtra en cliente:
      map(features =>
        opts?.clampToSantiagoProvince === false
          ? features
          : features.filter(f => this.isInSantiagoProvince(f))
      ),
      map(features => {
        if (!features.length) return null;
        const byType = (t: string) => features.find(f => (f as any).place_type?.includes?.(t));
        const pick =
          byType('poi') || byType('poi.landmark') ||
          byType('address') || byType('place') ||
          byType('locality') || byType('neighborhood') ||
          features[0];

        const label = this.stripSantiagoTail(pick.place_name);
        return { label, coords: { lat: pick.center[1], lng: pick.center[0] } };
      }),
      catchError(() => of(null))
    );
  }
}