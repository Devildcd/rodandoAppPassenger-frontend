import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { IonSpinner } from "@ionic/angular/standalone";

@Component({
  selector: 'app-spinner',
  templateUrl: './spinner.component.html',
  styleUrls: ['./spinner.component.scss'],
  standalone: true,
imports: [CommonModule, IonSpinner],
})
export class SpinnerComponent  implements OnInit {

  @Input() message = 'Cargando…';
  
  constructor() { }

  ngOnInit() {}

}
