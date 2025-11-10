import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';

import { addIcons } from 'ionicons';
import * as allIcons from 'ionicons/icons';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';
import { APP_INITIALIZER, importProvidersFrom } from '@angular/core';
import { IonicModule }              from '@ionic/angular';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { apiErrorInterceptor } from './app/core/interceptors/api-error.interceptor';
import { provideStore } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { NotificationAlertEffects } from './app/store/notification-alerts/notification-alert.effects';
import { authInterceptor } from './app/core/interceptors/auth.interceptor';
import { initAuthFactory } from './app/core/config/auth.init';
import { AuthFacade } from './app/store/auth/auth.facade';

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    importProvidersFrom(IonicModule.forRoot()),
    provideHttpClient(withInterceptors([apiErrorInterceptor, authInterceptor])),
    provideStore(),
    provideEffects([NotificationAlertEffects]),
    // <-- APP_INITIALIZER para rehidratar sessionType antes del bootstrap
    {
      provide: APP_INITIALIZER,
      useFactory: initAuthFactory,
      deps: [AuthFacade],
      multi: true,
    },
],
});

addIcons(allIcons);
