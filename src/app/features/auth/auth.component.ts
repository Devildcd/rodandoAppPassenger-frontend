import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { IonRouterOutlet, IonContent, IonCard, IonCardContent } from "@ionic/angular/standalone";

@Component({
  selector: 'app-auth',
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.scss'],
  standalone: true,
  imports: [IonCardContent, IonCard, IonContent, IonRouterOutlet, RouterModule],
})
export default class AuthComponent  implements OnInit {

  constructor() { }

  ngOnInit() {}

}
