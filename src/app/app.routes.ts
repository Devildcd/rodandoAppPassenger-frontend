import { Routes } from '@angular/router';
import { authGuardWithRefresh, authGuardWithRefreshCanLoad, authGuardWithRefreshChild, guestGuard, guestGuardCanLoad } from './core/guards/auth.guard';
import { DefaultLayoutComponent } from './shared/layouts/default-layout/default-layout.component';
import { MapLayoutComponent } from './shared/layouts/map-layout/map-layout.component';

export const routes: Routes = [
  // ==== Zona pública (auth) → bloqueada si ya hay sesión ====
  {
    path: 'auth',
    loadComponent: () => import('./features/auth/auth.component'),
    canActivate: [guestGuard],
    canLoad: [guestGuardCanLoad],
    children: [
      {
        path: '',
        loadChildren: () => import('./features/auth/auth.routes'),
      },
    ],
  },

  // ==== Zona privada (tabs + sidebar) → requiere sesión/refresh ====
  {
    path: '',
    component: DefaultLayoutComponent, // Header + Content + TabBar + Sidebar
    canActivateChild: [authGuardWithRefreshChild], // protege todas las hijas
    children: [
      // === Tabs ===
      {
        path: 'home',
        loadComponent: () => import('./features/tabs/home/home.component'),
        data: { title: 'Inicio', tab: 'home' },
      },
      {
        path: 'trips',
        loadComponent: () => import('./features/tabs/trips/trips.component'),
        children: [
          { path: '', redirectTo: 'active', pathMatch: 'full' },
          {
            path: 'active',
            loadComponent: () =>
              import('./features/tabs/trips/active/active.component'),
            data: { title: 'Viaje Activo', tab: 'trips' },
          },
          {
            path: 'history',
            loadComponent: () =>
              import('./features/tabs/trips/historial/historial.component'),
            data: { title: 'Historial', tab: 'trips' },
          },
        ],
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./features/tabs/profile/profile.component'),
        data: { title: 'Perfil', tab: 'profile' },
      },

      // === Sidebar pages (mismas “capas” visuales)
      {
        path: 'profile',
        loadComponent: () =>
          import('./features/sidebar/profile/profile.component'),
        data: { title: 'Perfil' },
      },
      {
        path: 'vehicle',
        loadComponent: () =>
          import('./features/sidebar/vehicle/vehicle.component'),
        data: { title: 'Vehículo' },
      },
      {
        path: 'wallet',
        loadComponent: () =>
          import('./features/sidebar/wallet/wallet.component'),
        data: { title: 'Wallet' },
      },
      {
        path: 'plans',
        loadComponent: () =>
          import('./features/sidebar/plans/plans.component'),
        data: { title: 'Planes' },
      },
      {
        path: 'referrals',
        loadComponent: () =>
          import('./features/sidebar/referrals/referrals.component'),
        data: { title: 'Referidos' },
      },
      {
        path: 'notifications',
        loadComponent: () =>
          import('./features/sidebar/notifications/notifications.component'),
        data: { title: 'Notificaciones' },
      },
      {
        path: 'support',
        loadComponent: () =>
          import('./features/sidebar/support/support.component'),
        data: { title: 'Soporte' },
      },
      {
        path: 'security',
        loadComponent: () =>
          import('./features/sidebar/security/security.component'),
        data: { title: 'Seguridad' },
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/sidebar/settings/settings.component'),
        data: { title: 'Configuración' },
      },
      {
        path: 'about',
        loadComponent: () =>
          import('./features/sidebar/about/about.component'),
        data: { title: 'Acerca de' },
      },

      // Redirects internos
      { path: 'trips', redirectTo: 'trips/active', pathMatch: 'full' },
      { path: '', redirectTo: 'home', pathMatch: 'full' },
    ],
  },

  // ==== Fullscreen (fuera del layout) → también privada ====
  {
    path: 'map',
    loadComponent: () => import('./features/tabs/map/map.component'),
    canActivate: [authGuardWithRefresh],
  },

  // Wildcard
  { path: '**', redirectTo: '' },
];
