import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
import { RegisterUserPayload } from '../../models/user/user.payload';
import { mergeMap, Observable, of, throwError } from 'rxjs';
import { User } from '../../models/user/user.response';
import { ApiError, ApiResponse } from '../../models/api';
import { BackendUserDto } from 'src/app/store/users/models';
import { backendUserDtoToUser } from 'src/app/store/users/mappers';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private baseUrl = environment.apiUrl;
  private http = inject(HttpClient);

  register(payload: RegisterUserPayload): Observable<User> {
    const url = `${this.baseUrl}/users/register`;
    return this.http.post<ApiResponse<BackendUserDto>>(url, payload).pipe(
      mergeMap((resp) => {
        if (resp.success && resp.data)
          return of(backendUserDtoToUser(resp.data));
        const apiErr: ApiError = {
          message: resp.message ?? 'Register failed',
          code: resp.error?.code,
          raw: resp,
        };
        return throwError(() => apiErr);
      })
    );
  }
}
