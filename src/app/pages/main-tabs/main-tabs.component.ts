import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { IonTabs, IonTabBar, IonTabButton, IonLabel, IonIcon, IonRouterOutlet, IonToolbar, IonButton, IonButtons, IonFooter, IonContent, IonTitle, IonHeader } from "@ionic/angular/standalone";
import { FloatingButtonComponent } from "src/app/components/floating-button/floating-button.component";
import { AuthStore } from 'src/app/store/auth/auth.store';

@Component({
  selector: 'app-main-tabs',
  templateUrl: './main-tabs.component.html',
  styleUrls: ['./main-tabs.component.scss'],
  standalone: true,
  imports: [IonHeader, IonTitle, IonFooter,
    IonRouterOutlet,
    IonIcon,
    RouterModule,
    FloatingButtonComponent,
    IonToolbar, IonButton, CommonModule, IonLabel
  ]
})
export default class MainTabsComponent implements OnInit {
private store = inject(AuthStore);
  constructor() { }

  ngOnInit() { 
    let session = this.store.sessionType();
    console.log(session);
   }

}
