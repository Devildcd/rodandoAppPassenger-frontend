import { environment } from '@/environments/environment';
import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { PassengerPingDto } from '../../models/user/user.auxiliary';
import { map, Observable } from 'rxjs';
import { ApiResponse } from '../../models/api';
import { UserProfile } from '../../models/user/user.response';

@Injectable({
  providedIn: 'root'
})
export class PassengerLocationApiService {
private http = inject(HttpClient);
  private baseUrl = environment.apiUrl;

  /** Perfil con currentLocation (GeoJSON Point) */
 me(useCookie = true): Observable<UserProfile> {
    const url = `${this.baseUrl}/users/profile`;
    const options = useCookie ? { withCredentials: true } : {};
    return this.http
      .get<ApiResponse<UserProfile>>(url, options)
      .pipe(map(res => {
        if (!res?.success || !res.data) throw new Error('Profile response malformed');
        return res.data;
      }));
  }

  /** Ping de ubicación del PASSENGER (REST “compact”) */
  pingLocation(dto: PassengerPingDto): Observable<UserProfile> {
    return this.http
      .post<ApiResponse<UserProfile>>(
        `${this.baseUrl}/users/ping-location`,
        dto,
        { withCredentials: true }
      )
      .pipe(map(res => {
        if (!res?.success || !res.data) throw new Error('Ping response malformed');
        return res.data;
      }));
  }
}
