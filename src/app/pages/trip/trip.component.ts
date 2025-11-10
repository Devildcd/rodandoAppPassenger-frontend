import { AfterViewInit, Component, ElementRef, Input, OnInit, ViewChild } from '@angular/core';
import { IonContent, IonText, IonItem, IonLabel, IonIcon, IonButton, IonHeader, IonToolbar, IonTitle, IonButtons, IonCol, IonFooter, IonGrid, IonRow, IonList, IonRadioGroup, IonListHeader, IonRadio, IonCard, IonCardContent, IonSegment, IonSegmentButton, IonSelectOption, IonCardHeader, IonCardTitle, IonFab, IonFabButton, IonFabList, IonChip } from "@ionic/angular/standalone";
import { BaseMapComponent } from "src/app/components/base-map/base-map.component";
import { FloatingButtonComponent } from "src/app/components/floating-button/floating-button.component";
import { ReusableModalComponent } from "src/app/components/reusable-modal/reusable-modal.component";
import { ModalController, LoadingController, AlertController, NavParams } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';


@Component({
  selector: 'app-trip',
  templateUrl: './trip.component.html',
  styleUrls: ['./trip.component.scss'],
  standalone: true,
  imports: [IonContent, BaseMapComponent, FloatingButtonComponent],
})
export default class TripComponent {

}

