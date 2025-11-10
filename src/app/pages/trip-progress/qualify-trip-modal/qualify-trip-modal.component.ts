import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonContent, IonCard, IonCardContent, IonIcon, IonButton, IonChip, IonLabel, IonAvatar } from "@ionic/angular/standalone";

@Component({
  selector: 'app-qualify-trip-modal',
  templateUrl: './qualify-trip-modal.component.html',
  styleUrls: ['./qualify-trip-modal.component.scss'],
  standalone: true,
  imports: [IonAvatar, IonLabel, IonChip, IonButton, IonIcon, IonCardContent, IonCard, IonContent, FormsModule, CommonModule],
})
export class QualifyTripModalComponent  implements OnInit {
  rating = 4;       // por defecto 4 estrellas (ejemplo)
comment = '';
 driver = {
    photoUrl: 'assets/images/user.png',
    name: 'Juan Pérez',
    vehicle: 'Toyota Prius'
  };
   driverAvgRating = 4.7;   // calificación promedio del conductor (solo display)

  constructor() { }

  ngOnInit() {}

setRating(value: number) {
    this.rating = value;
  }

  submitFeedback() {
    // aquí envías `rating` y `comment` a tu backend
    console.log('Enviando feedback', { rating: this.rating, comment: this.comment });
  }

}
