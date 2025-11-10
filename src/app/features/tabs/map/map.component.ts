import { environment } from '@/environments/environment';
import { AfterViewInit, Component, computed, effect, ElementRef, inject, Injector, OnDestroy, OnInit, signal, ViewChild } from '@angular/core';
import mapboxgl from 'mapbox-gl';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonBadge, IonModal, IonButton, ToastController, IonCard, IonCardContent, IonIcon, IonFab, IonFabButton } from "@ionic/angular/standalone";
import { SpinnerComponent } from "@/app/shared/components/spinner/spinner.component";
import { CommonModule } from '@angular/common';
import * as turf from '@turf/turf';
import type { Feature, FeatureCollection, Point, Polygon, MultiPolygon } from 'geojson';
import { LatLng } from '@/app/core/utils/geo.utils';
import { MapboxDirectionsService, RouteResult } from '@/app/core/services/http/mapbox-directions.service';
import { FloatingButtonComponent } from "@/app/components/floating-button/floating-button.component";
import { NavigationStart, Router, RouterModule } from '@angular/router';
import { TripPlannerStore } from '@/app/store/trips/trip-planner.store';
import { TripPlannerFacade } from '@/app/store/trips/trip-planner.facade';
import { TripDetailsModalService } from '@/app/core/services/ui/trip-details-modal.service';
import { filter, Subscription } from 'rxjs';

const ORIGIN_CACHE_KEY = 'trip.origin';   // { lat, lng, label? }
const DEST_CACHE_KEY   = 'trip.dest';

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss'],
  standalone: true,
  imports: [IonContent, IonButton, SpinnerComponent, IonCard, IonCardContent, IonIcon, CommonModule, IonFab, IonFabButton, FloatingButtonComponent, RouterModule],
})
export default class MapComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapEl', { static: true }) mapEl!: ElementRef<HTMLDivElement>;
  private injector = inject(Injector);
  private store = inject(TripPlannerStore);
  private facade = inject(TripPlannerFacade);
  private toast = inject(ToastController);
  private detailsModal = inject(TripDetailsModalService);
   private router = inject(Router);
  private navSub?: Subscription;

  map!: mapboxgl.Map;
  geolocate!: mapboxgl.GeolocateControl;
  private originMarker?: mapboxgl.Marker;
  private destMarker?: mapboxgl.Marker;

  isLoaded = signal(false);
  error = signal<string | null>(null);
  isReady = computed(() => this.isLoaded() && !this.error());

  constructor() {
    // 1) Dibujar/actualizar polyline cuando cambia routeSummary
    effect(() => {
      if (!this.isLoaded()) return;
      const rs = this.store.routeSummary();
      const srcId = 'trip-route';
      const layerId = 'trip-route-line';

      // limpiar si no hay ruta
      if (!rs?.geometry) {
        if (this.map.getLayer(layerId)) this.map.removeLayer(layerId);
        if (this.map.getSource(srcId)) this.map.removeSource(srcId);
        return;
      }

      if (this.map.getLayer(layerId)) this.map.removeLayer(layerId);
      if (this.map.getSource(srcId)) this.map.removeSource(srcId);
      this.map.addSource(srcId, { type: 'geojson', data: rs.geometry as any });
      this.map.addLayer({
        id: layerId,
        type: 'line',
        source: srcId,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-width': 5, 'line-color': '#FF3B30' },
      });

      // bounds
      const coords = (rs.geometry.features[0].geometry as any).coordinates as [number, number][];
      const bounds = coords.reduce((b, c) => b.extend(c as any), new mapboxgl.LngLatBounds(coords[0], coords[0]));
      this.map.fitBounds(bounds, { padding: 60, duration: 600 });

      // markers
      this.placeOrMoveOrigin(rs.origin, this.store.originText() ?? 'Tu ubicación');
      this.placeOrMoveDestination(rs.destination, rs.destinationLabel ?? 'Destino (ajustable)');
    }, { injector: this.injector });

    // 2) Mover pin de origen cuando cambie originPoint (aunque no haya ruta)
    effect(() => {
      if (!this.isLoaded()) return;
      const o = this.store.originPoint();
      if (!o) return;
      this.placeOrMoveOrigin(o, this.store.originText() ?? 'Tu ubicación');

      // si no hay destino ni ruta, muestra picker en el centro
      const hasDest = !!this.store.destinationPoint();
      const hasRoute = !!this.store.routeSummary();
      if (!hasDest && !hasRoute) {
        const c = this.map.getCenter();
        this.ensureDestPicker(c.lng, c.lat, 'Selecciona destino');
      }
    }, { injector: this.injector });

    // 3) Mover pin de destino cuando cambie destinationPoint (sin ruta)
    effect(() => {
      if (!this.isLoaded()) return;
      const d = this.store.destinationPoint();
      const hasRoute = !!this.store.routeSummary();
      if (d && !hasRoute) {
        this.ensureDestPicker(d.lng, d.lat, 'Destino (ajustable)');
      }
    }, { injector: this.injector });
  }

  async ngAfterViewInit() {
    this.facade.init();
    this.detailsModal.start();
    this.initMap();

    // Si sales de /map por cualquier vía, resetea
    this.navSub = this.router.events.pipe(
      filter(e => e instanceof NavigationStart)
    ).subscribe((e: any) => {
      const goingOutOfMap = !String(e.url || '').startsWith('/map');
      if (goingOutOfMap) {
        this.detailsModal.stop();
        this.facade.hardResetPlanning();
      }
    });
  }


onBack() {
    // this.detailsModal.stop();
    this.facade.hardResetPlanning();
    this.router.navigate(['/home']);
  }

  private initMap() {
    this.isLoaded.set(false);
    this.error.set(null);
    mapboxgl.accessToken = environment.mapbox.accessToken;

    try {
      const origin = this.store.originPoint();
      const firstCenter = origin ?? { lat: 20.02, lng: -75.83 };

      this.map = new mapboxgl.Map({
        container: this.mapEl.nativeElement,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [firstCenter.lng, firstCenter.lat],
        zoom: origin ? 14 : 12,
        attributionControl: true,
      });

      this.map.addControl(new mapboxgl.ScaleControl({ maxWidth: 100, unit: 'metric' }));
      this.map.addControl(new mapboxgl.AttributionControl({ compact: true }));

      // Geolocate SOLO como UI/heading (no trigger)
      this.geolocate = new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 },
        trackUserLocation: true,
        showUserHeading: true,
      });
      this.map.addControl(this.geolocate, 'top-left');
      this.geolocate.on('error', (e:any) => {
        console.info('[Geolocate] proveedor red Chrome puede fallar (403):', e?.message);
      });

      this.map.on('load', async () => {
        this.isLoaded.set(true);
        setTimeout(() => this.map.resize(), 0);

        // Si ya había estado, los effects pintan; si no, muestra picker en centro
        const hasRoute = !!this.store.routeSummary();
        const hasDest  = !!this.store.destinationPoint();
        const o = this.store.originPoint();
        if (o && !hasRoute && !hasDest) {
          this.placeOrMoveOrigin(o, this.store.originText() ?? 'Tu ubicación');
          const c = this.map.getCenter();
          this.ensureDestPicker(c.lng, c.lat, 'Selecciona destino');
          await this.tip('Marca el destino moviendo el pin rojo o tocando el mapa.');
        }
      });

      // Click en mapa => fija/mueve destino y recalcula
      this.map.on('click', (e: any) => {
        const lng = e?.lngLat?.lng, lat = e?.lngLat?.lat;
        if (typeof lng !== 'number' || typeof lat !== 'number') return;
        this.ensureDestPicker(lng, lat);
        this.facade.recalcRouteAfterAdjust({ lat, lng });
      });

    } catch (err: any) {
      this.handleError(err?.message || 'No se pudo inicializar el mapa');
    }
  }

  // Markers
  private placeOrMoveOrigin(point: LatLng, title = 'Tu ubicación') {
    if (!this.originMarker) {
      this.originMarker = new mapboxgl.Marker({ color: '#0A84FF' })
        .setLngLat([point.lng, point.lat])
        .setPopup(new mapboxgl.Popup({ offset: 10 }).setText(title))
        .addTo(this.map);
    } else {
      this.originMarker.setLngLat([point.lng, point.lat]);
    }
  }
  private ensureDestPicker(lng: number, lat: number, title = 'Destino (ajustable)') {
    if (!this.destMarker) {
      this.destMarker = new mapboxgl.Marker({ color: '#FF3B30', draggable: true })
        .setLngLat([lng, lat])
        .setPopup(new mapboxgl.Popup({ offset: 10 }).setText(title))
        .addTo(this.map);
      this.destMarker.on('dragend', () => {
        const ll = this.destMarker!.getLngLat();
        this.facade.recalcRouteAfterAdjust({ lat: ll.lat, lng: ll.lng });
      });
    } else {
      this.destMarker.setLngLat([lng, lat]);
    }
  }
  private placeOrMoveDestination(point: LatLng, title = 'Destino (ajustable)') {
    this.ensureDestPicker(point.lng, point.lat, title);
  }

  // UI helpers
  private async tip(message: string) {
    const t = await this.toast.create({ message, duration: 2200, color: 'medium' });
    t.present();
  }
  async handleError(message: string) {
    this.error.set(message);
    const t = await this.toast.create({ message, duration: 2500, color: 'warning' });
    t.present();
  }

  // Acciones UI opcionales
  centerOnMe() {
    const o = this.store.originPoint();
    if (!o) return;
    this.map.easeTo({ center: [o.lng, o.lat], zoom: 15, duration: 600 });
  }

  ionViewDidLeave() {
    this.facade.resetPlanning();
  }

  ngOnDestroy() {
    this.navSub?.unsubscribe();
    try { if (this.map) this.map.remove(); } catch {}
    this.detailsModal.stop();
    this.facade.hardResetPlanning(); // por si acaso
  }
}

