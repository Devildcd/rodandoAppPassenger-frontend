import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { IonHeader, IonRouterOutlet, IonFooter, IonToolbar, IonButton, IonIcon, IonContent } from "@ionic/angular/standalone";

import { FloatingButtonComponent } from "@/app/components/floating-button/floating-button.component";
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-default-layout',
  templateUrl: './default-layout.component.html',
  styleUrls: ['./default-layout.component.scss'],
  standalone: true,
  imports: [IonHeader, FloatingButtonComponent, IonRouterOutlet, IonFooter, IonToolbar, IonButton, IonIcon, RouterModule, IonContent],
})
export class DefaultLayoutComponent  implements OnInit {

  constructor() { }

  ngOnInit() {}

}
