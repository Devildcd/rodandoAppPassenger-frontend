import { environment } from '@/environments/environment';
import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { LatLng } from '../../utils/geo.utils';
import { map, Observable, throwError } from 'rxjs';
import type { FeatureCollection, LineString } from 'geojson';

export interface RouteResult {
  distanceKm: number;                  // p.ej. 12.3
  durationMin: number;                 // p.ej. 24
  feature: GeoJSON.FeatureCollection<GeoJSON.LineString>;
  raw?: any;                           // opcional: respuesta completa de Mapbox
}

type MbDirectionsRes = {
  code: string;
  routes: Array<{
    distance: number;          // metros
    duration: number;          // segundos
    geometry: { type: 'LineString'; coordinates: [number, number][] }; // [lng,lat]
  }>;
  waypoints: any[];
  uuid?: string;
};

@Injectable({
  providedIn: 'root'
})
export class MapboxDirectionsService {
private http = inject(HttpClient);
  private token = environment.mapbox.accessToken;

getRoute(origin: LatLng, destination: LatLng): Observable<RouteResult> {
  // Validaciones defensivas
  const okNum = (n: any) => typeof n === 'number' && isFinite(n);
  if (!okNum(origin?.lng) || !okNum(origin?.lat) ||
      !okNum(destination?.lng) || !okNum(destination?.lat)) {
    return throwError(() => new Error('Parámetros de ruta inválidos'));
  }

  // Normaliza a 6 decimales (evita “-75.81741500000001”)
  const oLng = +origin.lng.toFixed(6);
  const oLat = +origin.lat.toFixed(6);
  const dLng = +destination.lng.toFixed(6);
  const dLat = +destination.lat.toFixed(6);

  const coords = `${oLng},${oLat};${dLng},${dLat}`;
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}`;

  const params = new HttpParams()
    .set('access_token', environment.mapbox.accessToken)
    .set('alternatives', 'false')
    .set('geometries', 'geojson')
    .set('overview', 'full')
    .set('annotations', 'distance,duration');

  return this.http.get<any>(url, { params }).pipe(
    map(json => {
      if (!json?.routes?.length) throw new Error('Sin rutas');
      const r = json.routes[0];
      console.log(r);
      const feature: GeoJSON.FeatureCollection<GeoJSON.LineString> = {
        type: 'FeatureCollection',
        features: [{ type: 'Feature', geometry: r.geometry, properties: {} }]
      };
      return {
        feature,
        distanceKm: r.distance / 1000,
        durationMin: r.duration / 60,
      } as RouteResult;
    })
  );
}
}
