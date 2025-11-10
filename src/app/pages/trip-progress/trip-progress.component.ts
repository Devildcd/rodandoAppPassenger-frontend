import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';

import { IonRouterOutlet, IonButton } from "@ionic/angular/standalone";
import { FloatingButtonComponent } from "src/app/components/floating-button/floating-button.component";

@Component({
  selector: 'app-trip-progress',
  templateUrl: './trip-progress.component.html',
  styleUrls: ['./trip-progress.component.scss'],
  standalone: true,
  imports: [IonRouterOutlet, FloatingButtonComponent, RouterModule, IonButton]
})
export default class TripProgressComponent  implements OnInit {

  constructor() { }

  ngOnInit() {}

}
