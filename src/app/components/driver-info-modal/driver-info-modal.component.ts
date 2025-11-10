import { Component, OnInit, ViewChild } from '@angular/core';
import { ReusableModalComponent } from "../reusable-modal/reusable-modal.component";
import { IonContent, IonCard, IonCardContent, IonIcon, IonButton, IonChip, IonLabel } from "@ionic/angular/standalone";

@Component({
  selector: 'app-driver-info-modal',
  templateUrl: './driver-info-modal.component.html',
  styleUrls: ['./driver-info-modal.component.scss'],
  standalone: true,
  imports: [IonLabel, IonChip, IonButton, IonIcon, IonCardContent, IonCard, IonContent, ReusableModalComponent]
})
export class DriverInfoModalComponent  implements OnInit {
  @ViewChild('detailTripModal', { static: true })
    private detailTripModal!: ReusableModalComponent;

  constructor() { }

  ngOnInit() {

  }

}
