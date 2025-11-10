import { Component, ElementRef, Input, OnInit, ViewChild } from '@angular/core';

import { IonModal, IonContent } from '@ionic/angular/standalone';

@Component({
  selector: 'app-reusable-modal',
  templateUrl: './reusable-modal.component.html',
  styleUrls: ['./reusable-modal.component.scss'],
  standalone: true,
  imports: [IonModal]
})
export class ReusableModalComponent {
@ViewChild('modal', { static: true })
  private readonly modal!: IonModal;

  @Input() initialBreakpoint = 0.4;
  @Input() breakpoints: number[] = [0, 0.4, 0.8];
  @Input() presentingElement?: HTMLElement;
  @Input() cssClass = '';
  @Input() backdropDismiss = true;

  /** Abre el modal */
  async open(): Promise<void> {
    await this.modal.present();
  }

  /** Cierra el modal (puedes pasar data opcional) */
  async close(data?: any): Promise<void> {
    await this.modal.dismiss(data);
  }

  /** Devuelve la instancia del IonModal */
  get modalInstance(): IonModal {
    return this.modal;
  }
}
