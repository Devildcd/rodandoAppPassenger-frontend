import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { IonContent, IonButton, IonAvatar, IonCard, IonCardContent, IonList, IonItem, IonIcon, IonLabel, IonSpinner } from "@ionic/angular/standalone";
import { take } from 'rxjs';
import { DinamicHeaderComponent } from "src/app/components/dinamic-header/dinamic-header.component";
import { SessionType } from 'src/app/core/models/auth/auth.auxiliary';
import { UserProfile } from 'src/app/core/models/user/user.response';
import { AuthFacade } from 'src/app/store/auth/auth.facade';
import { AuthStore } from 'src/app/store/auth/auth.store';

@Component({
  selector: 'app-tab4',
  templateUrl: './tab4.component.html',
  styleUrls: ['./tab4.component.scss'],
  standalone: true,
  imports: [IonSpinner, IonLabel, IonIcon, IonItem, IonList, IonCardContent, IonCard, IonAvatar, IonButton, IonContent, DinamicHeaderComponent, CommonModule],
})
export default class Tab4Component  implements OnInit {
  private readonly authFacade = inject(AuthFacade);
  public readonly authStore = inject(AuthStore);
  readonly userSignal = this.authStore.user;

  constructor() { }

  ngOnInit() {
    console.log('[Tab4] user snapshot (ngOnInit):', this.userSignal());
  }

  get user(): UserProfile | null {
    let user = this.authStore.user?.() ?? null;
    console.log(user)
    return user
  }

onLogout() {
  // leer sessionType desde el store (signal)
  const sessionType = this.authStore.sessionType?.() ?? null;

  // decidir flujo: mobile only si es mobile_app (o api_client si lo consideras mobile)
  const isMobile = sessionType === SessionType.MOBILE_APP || sessionType === SessionType.API_CLIENT;
  // fallback: si sessionType es null -> preferimos web para limpiar cookie HttpOnly
  const flow$ = isMobile ? this.authFacade.logoutMobileFlow() : this.authFacade.logoutWebFlow();

  flow$.pipe(take(1)).subscribe({
    next: () => {
      // limpiar UI/estado de login
      try { this.authFacade.clearLoginState?.(); } catch {}
      console.log('Logout completed');
    },
    error: (err) => {
      console.error('Error en logout', err);
      // aun en error, clearLoginState podría ser útil
      try { this.authFacade.clearLoginState?.(); } catch {}
    }
  });
}


}
