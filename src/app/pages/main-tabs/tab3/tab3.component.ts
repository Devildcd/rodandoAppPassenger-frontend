import { Component, OnInit } from '@angular/core';
import { IonContent, IonGrid, IonRow, IonCol, IonCard, IonCardHeader, IonIcon, IonCardTitle, IonCardContent } from "@ionic/angular/standalone";

@Component({
  selector: 'app-tab3',
  templateUrl: './tab3.component.html',
  styleUrls: ['./tab3.component.scss'],
  standalone: true,
  imports: [IonCardContent, IonCardTitle, IonIcon, IonCardHeader, IonCard, IonCol, IonRow, IonGrid, IonContent]
})
export default class Tab3Component implements OnInit {

  constructor() { }

  ngOnInit() { }

}
