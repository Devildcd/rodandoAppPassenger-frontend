import { Component, Input, OnInit } from '@angular/core';
import { IonHeader, IonToolbar, IonTitle } from "@ionic/angular/standalone";

@Component({
  selector: 'app-dinamic-header',
  templateUrl: './dinamic-header.component.html',
  styleUrls: ['./dinamic-header.component.scss'],
  standalone: true,
  imports: [IonTitle, IonToolbar, IonHeader,]
})
export class DinamicHeaderComponent implements OnInit {
  @Input() title: string = '';

  constructor() { }

  ngOnInit() { }

}
