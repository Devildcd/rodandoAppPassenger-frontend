import { Component, computed, inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonItem, IonLabel, IonInput, IonIcon, IonList, IonActionSheet, IonFooter, IonSegment, IonSegmentButton, IonChip, IonSpinner } from "@ionic/angular/standalone";
import { ModalController, InputCustomEvent } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TripDetailsComponent } from '../trip-details/trip-details.component';
import { TripPlannerFacade } from '@/app/store/trips/trip-planner.facade';
import { TripPlannerStore } from '@/app/store/trips/trip-planner.store';
import { PlaceSuggestion } from '@/app/core/models/trip/place-suggestion.model';

@Component({
  selector: 'app-trip-options',
  templateUrl: './trip-options.component.html',
  styleUrls: ['./trip-options.component.scss'],
  standalone: true,
  imports: [IonChip, IonList, IonIcon, IonInput, IonLabel, IonItem, IonButton, IonButtons, IonTitle, IonToolbar, IonHeader, IonContent, FormsModule, CommonModule, TripDetailsComponent, IonSpinner]
})
export class TripOptionsComponent implements OnInit, OnDestroy {
   private facade = inject(TripPlannerFacade);
  store = inject(TripPlannerStore);

  @ViewChild('modalInput', { static: false }) modalInput!: IonInput;

  // ⬇️ ya NO usamos estado local; todo sale del store
  originVm = computed(() => {
    const txt = this.store.originText();
    const p   = this.store.originPoint();
    // fallback bonito si aún no hay label
    return txt ?? (p ? `${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}` : '');
  });

  destinationVm = computed(() => this.store.destinationText() ?? '');

  showStopToggle = false;
  stops: string[] = [];
  readonly maxStops = 5;

  constructor(private modalCtrl: ModalController) {}

  ngOnInit() {
    this.facade.init();            // carga origen, auto-complete, follow de ubicación
  }
  ngOnDestroy() { this.facade.destroy(); }

  ngAfterViewInit() {
    setTimeout(() => this.modalInput?.setFocus(), 300);
  }

  addStop() {
    if (this.stops.length < this.maxStops) this.stops = [...this.stops, ''];
  }
  removeStop(index: number) {
    this.stops.splice(index, 1);
    if (this.stops.length === 0) this.showStopToggle = false;
  }

  closeModal() { this.modalCtrl.dismiss(); }
  cancel()     { return this.modalCtrl.dismiss(null, 'cancel'); }

  // === Bindings ===
  onDestInput(ev: Event) {
    const value = (ev as InputCustomEvent).detail?.value ?? '';
    // escribe directo al store y dispara búsqueda
    this.store.setDestinationText(value);
    this.facade.onDestinationInput(value);
  }

  pickSuggestion(item: PlaceSuggestion) {
    // el store fija destino y limpia sugerencias; la UI se actualiza sola
    this.facade.pickSuggestion(item);
  }

  clearDest() {
    this.store.clearDestination();       // limpia texto/punto/ruta/cotización
    this.facade.onDestinationInput('');  // corta cualquier búsqueda en curso
  }

  // si mantienes el botón de limpiar origen (readonly), solo limpia label cacheado si quieres
  clearOriginTextOnly() {
    this.store.setOriginText(null); // el follow de ubicación lo volverá a rellenar
  }

  async confirm() {
    // 1) Cierra TripOptions
    await this.modalCtrl.dismiss();

    // 2) Crea y presenta TripDetails como nuevo modal
    const detailModal = await this.modalCtrl.create({
      component: TripDetailsComponent,
      // componentProps: {
      //   origin: this.origin,
      //   destination: this.destination,
      //   stops: this.stops
      // },
      breakpoints: [0, 0.4, 0.8],
      initialBreakpoint: 0.8,
      cssClass: 'trip-details-modal'
    });

    await detailModal.present();
  }

  vehicleTypes = [
    { value: 'motor', icon: 'bicycle-outline', label: 'Favoritos' },
    { value: 'auto', icon: 'car-outline', label: 'Frecuentes' },
  ];

  selectedVehicle = this.vehicleTypes[1].value; // por defecto “auto”

  selectVehicle(value: string) {
    this.selectedVehicle = value;
    // tu lógica al cambiar vehículo…
  }



}
