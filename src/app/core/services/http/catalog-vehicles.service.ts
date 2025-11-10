import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { ApiResponse } from '../../models/api';
import { ServiceClass, ServiceClassDto, VehicleCategory, VehicleCategoryDto } from '../../models/trip/catalog.models';
import { catchError, map, Observable, of, tap } from 'rxjs';
import { environment } from '@/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class CatalogVehiclesService {
  private http = inject(HttpClient);
  private base = environment.apiUrl // sin trailing /

  private url = (path: string) =>
    `${this.base}/${path.replace(/^\/+/, '')}`; // join evitando dobles //

  private unwrapArray<T>(resp: ApiResponse<T[]> | null | undefined): T[] {
    const ok = !!resp && resp.success === true && Array.isArray(resp.data);
    if (!ok) return [];
    return resp!.data!;
  }

  private mapVehicle = (dto: VehicleCategoryDto): VehicleCategory =>
    ({ id: dto.id, label: dto.name });

  private mapService  = (dto: ServiceClassDto): ServiceClass  =>
    ({ id: dto.id, label: dto.name });

  fetchVehicleCategories(): Observable<VehicleCategory[]> {
    const url = this.url('/vehicle-categories'); // 👈 ahora es absoluta
    return this.http.get<ApiResponse<VehicleCategoryDto[]>>(url, {
      // headers: new HttpHeaders({ 'Accept': 'application/json' }),
    }).pipe(
      tap(resp => console.log('[CATALOG] /vehicle-categories resp:', resp)),
      map(resp => this.unwrapArray(resp)
        .filter(v => v.isActive !== false)
        .map(this.mapVehicle)
      ),
      tap(list => console.log('[CATALOG] mapped vehicleCategories len =', list.length)),
      catchError(err => {
        console.error('[CATALOG] fetchVehicleCategories error:', err);
        return of<VehicleCategory[]>([]);
      }),
    );
  }

   fetchServiceClasses(): Observable<ServiceClass[]> {
    const url = this.url('/vehicle-service-classes');
    return this.http.get<ApiResponse<ServiceClassDto[]>>(url).pipe(
      map(resp => this.unwrapArray(resp)
        .filter(s => s.isActive !== false)
        .map(this.mapService)
      ),
      catchError(err => {
        console.error('[CATALOG] fetchServiceClasses error:', err);
        return of<ServiceClass[]>([]);
      }),
    );
  }
}