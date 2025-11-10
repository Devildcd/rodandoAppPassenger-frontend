import { Component, Input, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';

import { IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonList, IonIcon, IonLabel, IonItem, IonModal } from "@ionic/angular/standalone";
import { addIcons } from 'ionicons';
import { personCircle } from 'ionicons/icons';

@Component({
  selector: 'app-notification-modal',
  templateUrl: './notification-modal.component.html',
  styleUrls: ['./notification-modal.component.scss'],
  standalone: true,
  imports: [IonModal, IonItem, IonLabel, IonIcon, IonList, IonButton, IonContent, IonTitle, IonToolbar, IonHeader, ],
})
export class NotificationModalComponent  implements OnInit {
  @Input() icon!: string;
  @Input() title!: string;
  @Input() message!: string;
  @Input() buttonText = 'OK';

   constructor(private modalCtrl: ModalController) {
    /**
     * Any icons you want to use in your application
     * can be registered in app.component.ts and then
     * referenced by name anywhere in your application.
     */
    addIcons({ personCircle });
  }

  ngOnInit() {}

  close() {
    this.modalCtrl.dismiss();
  }
}
