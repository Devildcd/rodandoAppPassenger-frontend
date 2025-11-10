import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonHeader, IonToolbar, IonTitle, IonSegmentButton, IonLabel, IonSegment, IonContent, IonFabButton, IonButton, IonItem, IonIcon, IonChip, IonCard, IonAvatar, IonList } from "@ionic/angular/standalone";

// Solo para DEMO: estados posibles (usa signals/ngrx luego)
type TripState = 'esperando' | 'rumboPickup' | 'enViaje' | 'finalizando';

@Component({
  selector: 'app-trips',
  templateUrl: './trips.component.html',
  styleUrls: ['./trips.component.scss'],
  standalone: true,
  imports: [IonHeader, IonToolbar, IonTitle, IonSegment, IonSegmentButton, IonLabel, FormsModule, CommonModule, IonContent, IonIcon, IonFabButton, IonButton, IonItem, IonChip, IonCard, IonAvatar, IonList],
})
export default class TripsComponent  implements OnInit {
  // UI DEMO
segment: 'activo' | 'historial' = 'activo';
hasActiveTrip = true; // pon en false para ver el vacío
state: TripState = 'rumboPickup'; // cambia para ver cada paso
elapsed = 0; // ms — DEMO estático

  constructor() { }

  ngOnInit() {}

}
