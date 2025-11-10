import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { interval, Subscription } from 'rxjs';

import { IonCard, IonContent, IonIcon, IonButton, IonFabButton, IonModal, IonList, IonItem, IonLabel, IonCardContent, IonChip, IonBadge } from "@ionic/angular/standalone";
import { BaseMapComponent } from "src/app/components/base-map/base-map.component";
import { CommonModule } from '@angular/common';
import { NotificationModalComponent } from 'src/app/components/notification-modal/notification-modal.component';
import { ReusableModalComponent } from 'src/app/components/reusable-modal/reusable-modal.component';
import { QualifyTripModalComponent } from '../qualify-trip-modal/qualify-trip-modal.component';

@Component({
  selector: 'app-passenger-on-trip',
  templateUrl: './passenger-on-trip.component.html',
  styleUrls: ['./passenger-on-trip.component.scss'],
  standalone: true,
  imports: [IonBadge, IonChip, IonCardContent, IonLabel, IonItem, IonList, IonModal, IonFabButton, IonButton, IonIcon, IonContent, IonCard, BaseMapComponent, CommonModule, ReusableModalComponent]
})
export default class PassengerOnTripComponent  implements OnInit, OnDestroy {
  @ViewChild('detailModal') detailModal!: ReusableModalComponent;
  status = 'Esperando';
   elapsed = 0;
   elapsedViajando = 0;
   private timerSub!: Subscription;
   private viajandoSub!: Subscription;

  constructor(private modalCtrl: ModalController) { }

  ngOnInit() {
  this.timerSub = interval(1000).subscribe(() => {
    this.elapsed += 1000;
    if (this.status === 'Esperando' && this.elapsed >= 15000) {
      this.status = 'Viajando';
      this.elapsed = 0;
      this.startViajandoTimer();
    }
  });

  this.openModal();
}

async openModal() {
  const modal = await this.modalCtrl.create({
    component: NotificationModalComponent,
    cssClass: 'example-modal',
    componentProps: {
      icon: 'notifications', // o 'assets/bell.gif' si usas imagen
      title: 'El auto ha llegado',
      message: 'El coche te espera. Por favor, súbete y empieza el viaje.',
      buttonText: 'Aceptar'
    }
  });
  await modal.present();
}

openDetailModal() {
    this.detailModal.open();
  }

startViajandoTimer() {
    if (this.viajandoSub) {
      this.viajandoSub.unsubscribe();
    }

    this.elapsedViajando = 0;

    this.viajandoSub = interval(1000).subscribe(() => {
      this.elapsedViajando += 1000;
      if (this.elapsedViajando >= 10000) {
        this.openEndTripModal();
        this.viajandoSub.unsubscribe();
      }
    });
  }

async openEndTripModal() {
    const detailModal = await this.modalCtrl.create({
      component: QualifyTripModalComponent,
      breakpoints: [0, 0.4, 0.8],
      initialBreakpoint: 0.8,
      cssClass: 'trip-details-modal'
    });

    await detailModal.present();
  }

closeDetailModal() {
  this.detailModal.close();
}


  ngOnDestroy() {
    this.timerSub?.unsubscribe();
  }





  serviceTypes: any[] = [
      {
        value: 'standard',
        icon: 'trophy-outline',
        label: 'Estándar',
        img: '/assets/images/standar.png',
        eta: '2 min'
      },
      {
        value: 'comfort',
        icon: 'star-outline',
        label: 'Confort',
        img: '/assets/images/confort.png',
        eta: '2 min'
      },
      {
        value: 'premium',
        icon: 'diamond-outline',
        label: 'Premium',
        img: '/assets/images/premium.png',
        eta: '2 min'
      },
    ];

    selectedType = 'standard';

    selectType(type: any) {
      this.selectedType = type.value;
      // aquí tu lógica de cambio de tipo…
    }

    selectedService = 'standard';

    vehicleTypes = [
      { value: 'motor', icon: 'bicycle-outline', label: 'Motor' },
      { value: 'auto', icon: 'car-outline', label: 'Auto' },
      { value: 'van', icon: 'bus-outline', label: 'Van' },
      { value: 'bus', icon: 'help-circle-outline', label: 'Bus' }
    ];

    selectedVehicle = this.vehicleTypes[1].value;

    messages = [
  { type: 'info', icon: 'warning-outline', text: 'Recargo por espera: $5.00' },
  { type: 'warning', icon: 'pricetag-outline', text: 'Descuento aplicado: $2.00' }
];

}
