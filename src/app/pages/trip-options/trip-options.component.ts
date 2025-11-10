import { Component, OnInit, ViewChild } from '@angular/core';
import { IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonItem, IonLabel, IonInput, IonIcon, IonList, IonActionSheet, IonFooter, IonSegment, IonSegmentButton, IonChip } from "@ionic/angular/standalone";
import { ModalController } from '@ionic/angular';
import { ContentCardComponent } from "src/app/components/content-card/content-card.component";
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { DetailTripModalComponent } from '../../components/detail-trip-modal/detail-trip-modal.component';
import { TripDetailsComponent } from '../trip-details/trip-details.component';

@Component({
  selector: 'app-trip-options',
  templateUrl: './trip-options.component.html',
  styleUrls: ['./trip-options.component.scss'],
  standalone: true,
  imports: [IonChip, IonList, IonIcon, IonInput, IonLabel, IonItem, IonButton, IonButtons, IonTitle, IonToolbar, IonHeader, IonContent, FormsModule, CommonModule, TripDetailsComponent]
})
export class TripOptionsComponent  implements OnInit {
  @ViewChild('modalInput', { static: false }) modalInput!: IonInput;
  @ViewChild('tripDetail') tripDetail!: TripDetailsComponent;
    origin: string = '';
  destination: string = '';
  showStopToggle: boolean = false;
  stops: string[] = [];
   readonly maxStops = 5;


  constructor(private modalCtrl: ModalController) {}

  ngOnInit() {}

   ngAfterViewInit() {
    // Espera un momento para que el modal termine de mostrarse
    setTimeout(() => {
      // Enfoca el input dentro del modal
      this.modalInput.setFocus();
    }, 300);
  }

   addStop(): void {
    if (this.stops.length < this.maxStops) {
      this.stops = [...this.stops, ''];
    }
  }

  removeStop(index: number): void {
    this.stops.splice(index, 1);
    // Si no quedan paradas, ocultamos todo el bloque
    if (this.stops.length === 0) {
      this.showStopToggle = false;
    }
  }

  // Cierra el modal sin pasar datos
  closeModal() {
    this.modalCtrl.dismiss();
  }

   clearDestination() {
    this.destination = '';
  }

  clearInput(input: IonInput) {
    input.value = '';
    input.setFocus();
  }

   goToTrip() {
    // this.router.navigate(['/trip']);
  }

   cancel() {
    return this.modalCtrl.dismiss(null, 'cancel');
  }

  async confirm() {
    this.tripDetail.open();
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
