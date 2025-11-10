import { Component, OnInit } from '@angular/core';

import { IonContent, IonList, IonItem, IonIcon, IonLabel, IonFab, IonFabButton, IonCheckbox, IonButton, IonAvatar, IonCard, IonCardTitle, IonCardHeader, IonCardContent } from "@ionic/angular/standalone";
import { DinamicHeaderComponent } from "src/app/components/dinamic-header/dinamic-header.component";

@Component({
  selector: 'app-tab2',
  templateUrl: './tab2.component.html',
  styleUrls: ['./tab2.component.scss'],
  standalone: true,
  imports: [IonCardContent, IonCardHeader, IonCardTitle, IonCard, IonAvatar, IonButton, IonCheckbox, IonFabButton, IonFab, IonLabel, IonIcon, IonItem, IonList, IonContent, DinamicHeaderComponent]
})
export default class Tab2Component implements OnInit {

  constructor() { }

  ngOnInit() {
  }
}
