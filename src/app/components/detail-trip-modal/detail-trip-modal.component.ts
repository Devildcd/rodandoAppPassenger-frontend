import { AfterViewInit, Component, OnInit, ViewChild } from '@angular/core';
import { ReusableModalComponent } from "../reusable-modal/reusable-modal.component";
import { IonContent, IonCard, IonCardContent, IonIcon, IonButton, IonChip, IonLabel } from "@ionic/angular/standalone";
import { CommonModule } from '@angular/common';
import { DriverInfoModalComponent } from "../driver-info-modal/driver-info-modal.component";
import { ModalController } from '@ionic/angular';

export interface ServiceType {
  value: string;
  icon: string;
  label: string;
  img: string; // ruta a la imagen circular
  eta?: string;
}

interface PaymentMethod {
  value: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-detail-trip-modal',
  templateUrl: './detail-trip-modal.component.html',
  styleUrls: ['./detail-trip-modal.component.scss'],
  standalone: true,
  imports: [IonLabel, IonChip, IonButton, IonIcon, IonCardContent, IonCard, IonContent, ReusableModalComponent, CommonModule, DriverInfoModalComponent],
})
export class DetailTripModalComponent {

}
