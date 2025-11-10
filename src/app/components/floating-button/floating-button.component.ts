import { Component, EventEmitter, input, Input, OnInit, Output } from '@angular/core';

import { IonFab, IonFabButton, IonIcon } from '@ionic/angular/standalone';

@Component({
  selector: 'app-floating-button',
  templateUrl: './floating-button.component.html',
  styleUrls: ['./floating-button.component.scss'],
  standalone: true,
  imports: [
    IonFab, 
    IonFabButton, 
    IonIcon, 
  ]
})
export class FloatingButtonComponent  implements OnInit {
  @Input() iconName: string = 'add';
  @Input() positionVertical: 'top'|'center'|'bottom' = 'top';
  @Input() positionHorizontal: 'start'|'center'|'end' = 'end';
  @Input() customClass = 'fab-semitransp';
  @Output() buttonClick = new EventEmitter<void>();

  constructor() { }

  ngOnInit() {}

  onClick() {
    this.buttonClick.emit();
  }

}
