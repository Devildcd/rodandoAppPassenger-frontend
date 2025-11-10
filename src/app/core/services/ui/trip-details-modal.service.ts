import { TripPlannerStore } from '@/app/store/trips/trip-planner.store';
import { effect, inject, Injectable, Injector } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { TripDetailsComponent } from '@/app/pages/trip-ask/trip-details/trip-details.component';

@Injectable({
  providedIn: 'root'
})
export class TripDetailsModalService {
private modalCtrl = inject(ModalController);
  private store     = inject(TripPlannerStore);
  private injector  = inject(Injector);

  private modal?: HTMLIonModalElement | null;
  private timer: any = null;
  private lastKey: string | null = null;
  private running = false;

  /** Llama esto una sola vez (por ejemplo desde MapComponent.ngAfterViewInit) */
  start() {
    if (this.running) return;
    this.running = true;
    this.autoEffect; // inicializa el effect
  }

  /** Llama esto en ngOnDestroy de quien haya llamado start() */
  async stop() {
    this.running = false;
    this.clearTimer();
    await this.dismiss();
  }

  // ------- Effect reactivo sobre el estado global -------
  private autoEffect = effect(() => {
    if (!this.running) return;

    const rs = this.store.routeSummary();
    const loading = this.store.loading();

    // Si estoy cargando o no hay ruta -> aseguramos modal cerrado y sin timers
    if (loading || !rs) {
      this.clearTimer();
      this.dismiss();
      return;
    }

    // Tenemos ruta lista: generamos una firma para evitar reabrir sin cambios
    const key = `${rs.origin.lng},${rs.origin.lat}|${rs.destination.lng},${rs.destination.lat}|${rs.distanceKm}|${rs.durationMin}`;

    // Si ya está abierto con la misma ruta, no hacemos nada
    if (this.modal && this.lastKey === key) return;

    // Si cambió la ruta, reprogramamos apertura (1s)
    this.lastKey = key;
    this.clearTimer();
    this.timer = setTimeout(() => this.present(), 1000);
  }, { injector: this.injector });

  private clearTimer() {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
  }

  private async present() {
    // safety: si mientras esperábamos 1s se limpió la ruta/cambió loading, no abrir
    const rs = this.store.routeSummary();
    const loading = this.store.loading();
    if (!rs || loading) return;

    // Si ya hay uno abierto, ciérralo antes (para el caso de re-abrir con datos nuevos)
    if (this.modal) {
      try { await this.modal.dismiss(null, 'refresh'); } catch {}
      this.modal = null;
    }

    this.modal = await this.modalCtrl.create({
      component: TripDetailsComponent,
      componentProps: {}, // datos los toma directo desde la Facade (VM computado)
      showBackdrop: true,
      backdropDismiss: true,
      cssClass: 'glass-modal',
      handle: false, // si usas ion-modal sheet, ajusta esto
      breakpoints: [0, 0.35, 0.9],
      initialBreakpoint: 0.9,
    });
    await this.modal.present();

    // Si el usuario cierra manualmente, dejamos el modal en null (se reabrirá con próxima ruta)
    this.modal.onDidDismiss().then(() => { this.modal = null; });
  }

  private async dismiss() {
    if (this.modal) {
      try { await this.modal.dismiss(null, 'auto-close'); } catch {}
      this.modal = null;
    }
  }
}
