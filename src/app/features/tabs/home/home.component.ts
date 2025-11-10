import { AfterViewInit, Component, computed, ElementRef, inject, OnDestroy, OnInit, signal, ViewChild } from '@angular/core';
import { DinamicHeaderComponent } from "@/app/components/dinamic-header/dinamic-header.component";
import { IonCard, IonCardContent, IonIcon, IonButton, IonChip, IonLabel, IonGrid, IonRow, IonCol, IonCardHeader, IonCardTitle, IonContent, IonInput, IonItem, IonBadge } from "@ionic/angular/standalone";
import { environment } from '@/environments/environment';
import { Router } from '@angular/router';
import { ModalController, ToastController } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { TripOptionsComponent } from '@/app/pages/trip-ask/trip-options/trip-options.component';
import mapboxgl from 'mapbox-gl';
import { LocationProvider } from '@/app/core/providers/location.provider';

export type QuickTab = 'hoy' | 'wallet' | 'planes';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  standalone: true,
  imports: [DinamicHeaderComponent, IonCard, IonCardContent, IonIcon, IonButton, IonChip, IonLabel, IonGrid, IonRow, IonCol, IonCardHeader, IonCardTitle, IonContent, IonInput, FormsModule, IonItem, IonBadge, TripOptionsComponent],
})
export default class HomeComponent implements OnInit, AfterViewInit, OnDestroy {
 @ViewChild('mapEl', { static: true }) mapEl!: ElementRef<HTMLDivElement>;
  map!: mapboxgl.Map;
  geolocate!: mapboxgl.GeolocateControl;

  // estado
  isLoaded = signal(false);
  error = signal<string | null>(null);
  isReady = computed(() => this.isLoaded() && !this.error());

  // posición
  userLngLat = signal<mapboxgl.LngLatLike | null>(null);
  gpsAccuracy = signal<number | null>(null); // metros
  netOnline = signal<boolean>(navigator.onLine);
  quickReject = signal<boolean>(false);
  onlineStart = Date.now();

   collapsed = true;
   destination: string = '';

   private watchSub?: { unsubscribe: () => void };

  constructor( private router: Router, private modalCtrl: ModalController, private toast: ToastController, private loc: LocationProvider) {
     // escuchar red
    const onOff = () => this.netOnline.set(navigator.onLine);
    window.addEventListener('online', onOff);
    window.addEventListener('offline', onOff);
   }

  ngOnInit() { }

   async ngAfterViewInit(): Promise<void> {
    this.initMap();

    // Seed: primer fix válido (solo Cuba)
    const seed = await this.loc.waitForValidFix({ timeoutMs: 20_000 });
    if (seed) {
      this.userLngLat.set([seed.lng, seed.lat]);
      this.gpsAccuracy.set(seed.accuracyMeters);
      this.map.setCenter([seed.lng, seed.lat]);
      this.map.setZoom(15);
    } else {
      this.handleError('Chrome no pudo obtener tu ubicación. Revisa permisos o toca el mapa para fijar tu punto.');
      this.enableManualFallback(); // 👈 fallback manual si Chrome falla
    }

    // Stream continuo (filtrado a Cuba)
    this.watchSub = this.loc.watchBalanced().subscribe((s) => {
      this.userLngLat.set([s.lng, s.lat]);
      this.gpsAccuracy.set(s.accuracyMeters);
      // si quieres recentrar solo al inicio, hazlo aquí de forma condicional
    });

    // GeolocateControl solo como UI (no re-centrar fuera de Cuba)
    this.geolocate.on('error', (e: any) => {
      console.info('[GEOLOCATE CTRL] proveedor de red falló (403 en Chrome):', e?.message);
    });
    this.geolocate.on('geolocate', (e: GeolocationPosition) => {
      const { latitude, longitude, accuracy } = e.coords as any;
      const inCuba =
        latitude >= 19.5 && latitude <= 23.6 &&
        longitude >= -85.6 && longitude <= -73.4;
      if (!inCuba) return; // ignorar VPN/lecturas externas
      this.userLngLat.set([longitude, latitude]);
      this.gpsAccuracy.set(accuracy ?? null);
    });
  }

  private initMap(): void {
    this.isLoaded.set(false);
    this.error.set(null);
    mapboxgl.accessToken = environment.mapbox.accessToken;

    try {
      this.map = new mapboxgl.Map({
        container: this.mapEl.nativeElement,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [-75.83, 20.02],
        zoom: 12,
        attributionControl: true,
        antialias: false,
        cooperativeGestures: false,
        dragPan: true,
        dragRotate: false,
        scrollZoom: true,
        boxZoom: true,
        doubleClickZoom: true,
        keyboard: true,
        touchZoomRotate: true,
      });

      this.map.addControl(new mapboxgl.ScaleControl({ maxWidth: 100, unit: 'metric' }));
      this.map.addControl(new mapboxgl.AttributionControl({ compact: true }));

      // Geolocate (no llamamos trigger para no forzar proveedor de red de Chrome)
      this.geolocate = new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true, timeout: 10000, maximumAge: 10_000 },
        trackUserLocation: true,
        showUserHeading: true,
      });
      this.map.addControl(this.geolocate, 'top-left');

      this.map.on('load', () => {
        this.isLoaded.set(true);
        setTimeout(() => this.map.resize(), 0);
        // ❌ this.geolocate.trigger(); // NO disparar (evita 403 del proveedor)
      });

      this.map.on('error', (e: any) => this.handleError(e?.error?.message || 'Error de mapa'));

      const ionContent = this.mapEl.nativeElement.closest('ion-content');
      ionContent?.addEventListener('ionScrollEnd', () => this.map.resize());
    } catch (err: any) {
      this.handleError(err?.message || 'No se pudo inicializar el mapa');
    }
  }

  // === Fallback manual si Chrome no da ubicación ===
  private enableManualFallback() {
    const b = { minLat: 19.5, maxLat: 23.6, minLng: -85.6, maxLng: -73.4 };
    const click = (e: any) => {
      const { lng, lat } = e.lngLat;
      const inCuba = lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng;
      if (!inCuba) return;
      this.userLngLat.set([lng, lat]);
      this.map.setCenter([lng, lat]);
      this.map.setZoom(15);
      this.map.off('click', click);
      this.map.getCanvas().style.cursor = '';
    };
    this.map.getCanvas().style.cursor = 'crosshair';
    this.map.on('click', click);
  }

   async openModal() {
    const modal = await this.modalCtrl.create({
      component: TripOptionsComponent,
      mode: 'ios'
    });
    await modal.present();
  }

  collapse() {
    this.collapsed = false;
  }

  onDestinationInput(event: CustomEvent) {
    this.destination = event.detail.value;
    if (this.destination?.length > 0) {
      this.collapsed = false;
    }
  }

  clearDestination() {
    this.destination = '';
    this.collapsed = false;
  }

   goToTrip() {
    this.router.navigate(['/trip']);
  }

  async handleError(message: string) {
    this.error.set(message);
    const t = await this.toast.create({ message, duration: 2500, color: 'warning' });
    t.present();
  }


  retry() {
    if (this.map) { try { this.map.remove(); } catch { /* noop */ } }
    this.initMap();
  }

  ngOnDestroy(): void {
    this.watchSub?.unsubscribe?.();
    try { if (this.map) this.map.remove(); } catch { /* noop */ }
    window.removeEventListener('offline', () => { });
    window.removeEventListener('online', () => { });
  }

}
