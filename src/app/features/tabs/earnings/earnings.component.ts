import { Component, OnInit } from '@angular/core';
import { IonCard, IonCardContent, IonBadge, IonIcon, IonChip, IonCardHeader, IonCardTitle, IonProgressBar, IonNote, IonButton, IonList, IonItem, IonLabel } from "@ionic/angular/standalone";

@Component({
  selector: 'app-earnings',
  templateUrl: './earnings.component.html',
  styleUrls: ['./earnings.component.scss'],
  standalone: true,
  imports: [IonCard, IonCardContent, IonBadge, IonChip, IonCardHeader, IonCardTitle, IonProgressBar, IonNote, IonButton, IonList, IonItem, IonIcon, IonLabel],
})
export default class EarningsComponent  implements OnInit {

  constructor() { }

  ngOnInit() {}

}
