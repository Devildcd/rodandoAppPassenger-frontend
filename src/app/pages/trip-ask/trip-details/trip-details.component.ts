import { Component, computed, inject, OnInit, ViewChild } from '@angular/core';
import { ModalController } from '@ionic/angular';

import { ReusableModalComponent } from 'src/app/components/reusable-modal/reusable-modal.component';
import { IonContent, IonCard, IonCardContent, IonIcon, IonButton, IonChip, IonLabel } from "@ionic/angular/standalone";
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import DriverArrivingComponent  from '../../trip-progress/trip-driver-arriving/driver-arriving.component';
import { TripPlannerFacade } from '@/app/store/trips/trip-planner.facade';

export interface ServiceType {
  value: string;
  icon: string;
  label: string;
  img: string; // ruta a la imagen circular
  eta?: string;
}

@Component({
  selector: 'app-trip-details',
  templateUrl: './trip-details.component.html',
  styleUrls: ['./trip-details.component.scss'],
  standalone: true,
  imports: [IonLabel, IonChip, IonButton, IonIcon, IonCardContent, IonCard, IonContent, ReusableModalComponent, CommonModule],
})
export class TripDetailsComponent implements OnInit {
  private facade = inject(TripPlannerFacade);

  // datos superiores (distancia/min, labels origen/destino)
  vm = computed(() => this.facade.tripDetailsVm());

  // listas (signals)
  vehicleTypes = this.facade.vehicleTypesVm;     // Signal<{value,label,selected}[]>
  serviceTypes = this.facade.serviceTypesVm;     // Signal<{value,label,selected}[]>

  // selección actual (por si la usas en el template)
  selectedVehicle = this.facade.selectedVehicleId;        // Signal<string|null>
  selectedType    = this.facade.selectedServiceClassId;   // Signal<string|null>

  // acciones
  selectVehicle = (id: string) => this.facade.selectVehicle(id);
  selectType    = (id: string) => this.facade.selectServiceType(id);

  etaText = '2';

  // modal refs
  @ViewChild('tripDetail',   { static: true }) private tripDetail!: ReusableModalComponent;
  @ViewChild('driverModal',  { static: true }) private driverModal!: ReusableModalComponent;

  constructor(private modalCtrl: ModalController, private router: Router) {}

  ngOnInit(): void {
    // Asegura catálogo cargado si el modal abre “rápido”
    this.facade.ensureCatalogLoaded();
  }

  serviceIconsByLabel: Record<string, string> = {
  Economy: 'trophy-outline',
  Confort: 'star-outline',
  Premium: 'diamond-outline',
  // fallback: cualquier otro label usará 'trophy-outline'
};

  open() {
    this.facade.ensureCatalogLoaded();
    this.tripDetail.open();
  }

  requestTrip = () => {
  this.facade.requestTrip({ payment: 'cash' });
};

  async openDriverArriving() {
    await this.modalCtrl.dismiss();
    this.router.navigate(['trip-progress/driver-arriving']);
  }

  close() { this.modalCtrl.dismiss(); }

  // trackBy para *ngFor
  trackByValue = (_: number, item: { value: string }) => item.value;
}