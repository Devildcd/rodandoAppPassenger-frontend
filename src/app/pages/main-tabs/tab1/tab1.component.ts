import { Component, OnInit } from '@angular/core';
import { BaseMapComponent } from "src/app/components/base-map/base-map.component";
import { FloatingButtonComponent } from "src/app/components/floating-button/floating-button.component";
import { IonButton, IonContent, IonItem, IonIcon, IonInput, IonLabel, IonList, IonActionSheet, IonHeader, IonToolbar, IonTitle } from "@ionic/angular/standalone";
import { ReusableModalComponent } from "src/app/components/reusable-modal/reusable-modal.component";
import { environment } from '../../../../../../rodandoApp-frontend/environments/environment';
import { ContentCardComponent } from "src/app/components/content-card/content-card.component";
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ModalController } from '@ionic/angular';
import { TripOptionsComponent } from '../../trip-ask/trip-options/trip-options.component';

@Component({
  selector: 'app-tab1',
  templateUrl: './tab1.component.html',
  styleUrls: ['./tab1.component.scss'],
  standalone: true,
  imports: [IonInput, IonIcon, IonItem, IonContent, IonButton, BaseMapComponent, ContentCardComponent, FormsModule],
})
export default class Tab1Component implements OnInit {
   googleMapsApiKey = environment.googleMapsApiKey;
   collapsed = true;
   destination: string = '';

  constructor( private router: Router, private modalCtrl: ModalController) { }

  ngOnInit() { }

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

}
