import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { IonContent, IonButton, IonToolbar, IonButtons, IonIcon, IonTitle, IonHeader, IonItem, IonInput, IonLabel, IonChip, IonList, IonCard } from "@ionic/angular/standalone";
import { ReusableModalComponent } from "src/app/components/reusable-modal/reusable-modal.component";
import { ModalController } from '@ionic/angular';

@Component({
  selector: 'app-driver-arriving',
  templateUrl: './driver-arriving.component.html',
  styleUrls: ['./driver-arriving.component.scss'],
  standalone: true,
  imports: [IonCard, IonHeader, IonTitle, IonIcon, IonButtons, IonToolbar, IonButton, IonContent, ReusableModalComponent]
})
export default class DriverArrivingComponent  implements OnInit {
  @ViewChild('mapWrapper', { read: ElementRef }) mapWrapper!: ElementRef<HTMLDivElement>;

  constructor(private modalCtrl: ModalController) {}

  ngOnInit() {}

  // Estado para controlar la altura del mapa en píxeles
  mapHeight = 0;

  ngAfterViewInit() {
    // Inicialmente llenamos toda la pantalla
    this.mapHeight = window.innerHeight;
  }

  onModalWillPresent(event: any) {
    // Si tu modal emite el tamaño antes de presentarse,
    // podrías capturar un `event.detail.breakpoint` o similar.
    // Si no, podemos hacer un pequeño timeout para medirlo justo al mostrarse.
  }

   cancel() {
    return this.modalCtrl.dismiss(null, 'cancel');
  }
}
