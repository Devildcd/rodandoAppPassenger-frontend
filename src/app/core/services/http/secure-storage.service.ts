import { Injectable } from '@angular/core';
import { from, map, Observable } from 'rxjs';
import { Preferences } from '@capacitor/preferences';

@Injectable({
  providedIn: 'root'
})
export class SecureStorageService {

  constructor() { }

   save(key: string, value: string | null): Observable<void> {
    if (value === null) return from(Preferences.remove({ key }));
    return from(Preferences.set({ key, value }));
  }

  load(key: string): Observable<string | null> {
    return from(Preferences.get({ key })).pipe(
      map(r => r.value ?? null)
    );
  }

  remove(key: string): Observable<void> {
    return from(Preferences.remove({ key }));
  }
}
