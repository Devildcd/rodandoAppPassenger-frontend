import { environment } from '@/environments/environment';
import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { EstimateTripRequest, FareQuote } from '../../models/trip/estimate-for-trip.models';
import { catchError, map, Observable, of } from 'rxjs';
import { ApiResponse } from '../../models/api';
import { CreateTripRequest, TripResponseDto } from '../../models/trip/create-trip.models';

@Injectable({
  providedIn: 'root'
})
export class TripsApiService {

  private http = inject(HttpClient);
  private baseUrl = environment.apiUrl; // sin trailing slash

  estimateTrip(body: EstimateTripRequest): Observable<FareQuote | null> {
    const url = `${this.baseUrl}/trips/estimate`;
    return this.http.post<ApiResponse<FareQuote>>(url, body).pipe(
      map(resp => (resp?.success && resp?.data ? resp.data : null)),
      catchError(err => {
        console.error('[API] estimateTrip error', err);
        return of(null);
      })
    );
  }

  // POST /trips (CreateTripDto)
  createTrip(body: CreateTripRequest): Observable<TripResponseDto | null> {
    const url = `${this.baseUrl}/trips`;
    return this.http.post<ApiResponse<TripResponseDto>>(url, body).pipe(
      map(resp => (resp?.success && resp?.data ? resp.data : null)),
      catchError(err => {
        console.error('[API] createTrip error', err);
        return of(null);
      }),
    );
  }
}
