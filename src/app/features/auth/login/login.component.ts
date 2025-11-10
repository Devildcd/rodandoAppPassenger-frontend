import { Component, computed, effect, inject, OnInit } from '@angular/core';
import { IonCard, IonContent, IonCardContent, IonItem, IonInput, IonIcon, IonButton, IonText, IonSegmentButton, IonLabel, IonSegment, IonSpinner } from "@ionic/angular/standalone";
import AuthComponent from "../auth.component";
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthFacade } from 'src/app/store/auth/auth.facade';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { toSignal } from '@angular/core/rxjs-interop';
import { showNotificationAlert } from 'src/app/store/notification-alerts/notification-alert.actions';
import { take } from 'rxjs';
import { CommonModule } from '@angular/common';
import { environment } from '@/environments/environment';
import { AppAudience, LoginPayload } from '@/app/core/models/auth/auth.payload';
import { UserType } from '@/app/core/models/user/user.auxiliary';

const APP_AUDIENCE = environment.appAudience as AppAudience;
const EXPECTED_USER_TYPE = environment.expectedUserType as UserType;

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  standalone: true,
  imports: [IonSpinner, IonSegment, IonLabel, IonSegmentButton, IonIcon, ReactiveFormsModule, IonButton, CommonModule],
})
export default class LoginComponent  implements OnInit {

   private fb = inject(FormBuilder);
  private authFacade = inject(AuthFacade);
  private router = inject(Router);
  private store = inject(Store);

   form: FormGroup = this.fb.group({
    contactMethod: ['email'], // 'email' | 'phone'
    email: ['', [Validators.email]],
    phone: ['+53'],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });
  // Convertir observables del form en signals (útil para template o lógica)
  readonly formValue = toSignal(this.form.valueChanges, { initialValue: this.form.value });
  readonly formStatus = toSignal(this.form.statusChanges, { initialValue: this.form.status });

  // Computed signals para UI
  readonly isValid = computed(() => this.form.valid);
  readonly contactMethod = toSignal(
    this.form.get('contactMethod')!.valueChanges,
    { initialValue: this.form.get('contactMethod')!.value }
  );

  // Exponer loading / errors desde facade/auth store
  readonly loginStatus = this.authFacade.getLoginStatus(); // { loading, error, formErrors }

  // Helper getters for template
  get loading() { return this.loginStatus.loading(); }
  get formErrors() { return this.loginStatus.formErrors(); }
  get error() { return this.loginStatus.error(); }

  constructor() {
    // efecto para aplicar errores de validación devueltos por el server (formErrors)
    effect(() => {
      const formErrors = this.loginStatus.formErrors();
      if (!formErrors) return;

      for (const [field, messages] of Object.entries(formErrors)) {
        const control = this.form.get(field);
        if (control && !control.disabled) {
          // marca errores de servidor en el control (se muestran en el template)
          control.setErrors({ server: messages });
          control.markAsTouched();
        } else {
          // si el control no existe o está deshabilitado, mostrar notificación alternativa
          this.store.dispatch(showNotificationAlert({
            payload: { type: 'error', message: (messages as string[])[0] }
          }));
        }
      }
    });
  }

   ngOnInit() {
    // Aplica validadores iniciales según contactMethod
    this.applyContactValidators(this.form.get('contactMethod')!.value as 'email' | 'phone' | null);

    // Suscribirse a cambios del método de contacto para actualizar validadores dinámicamente
    this.form.get('contactMethod')!.valueChanges.subscribe((val) => {
      this.applyContactValidators(val as 'email' | 'phone' | null);
    });
  }

  // Aplica validadores y habilita/deshabilita controles según método (reutiliza la lógica del signup)
  private applyContactValidators(method: 'email' | 'phone' | null) {
    const email = this.form.get('email')!;
    const phone = this.form.get('phone')!;

    if (method === 'email') {
      if (email.disabled) email.enable({ emitEvent: false });
      email.setValidators([Validators.required, Validators.email]);
      email.setErrors(null);

      if (!phone.disabled) {
        phone.setErrors(null);
        phone.reset();
        phone.disable({ emitEvent: false });
      }
    } else if (method === 'phone') {
      if (phone.disabled) phone.enable({ emitEvent: false });
      phone.setValidators([Validators.required, Validators.pattern(/^\+?\d{7,15}$/)]);
      phone.setErrors(null);

      if (!email.disabled) {
        email.setErrors(null);
        email.reset();
        email.disable({ emitEvent: false });
      }
    } else {
      if (!email.disabled) { email.setErrors(null); email.reset(); email.disable({ emitEvent: false }); }
      if (!phone.disabled) { phone.setErrors(null); phone.reset(); phone.disable({ emitEvent: false }); }
    }

    email.updateValueAndValidity({ onlySelf: true, emitEvent: false });
    phone.updateValueAndValidity({ onlySelf: true, emitEvent: false });
    this.form.updateValueAndValidity({ onlySelf: false, emitEvent: false });
  }

  // UX helper: limpiar control
  clearControl(name: string) {
    const c = this.form.get(name);
    if (!c) return;
    c.reset();
    c.markAsUntouched();
  }

  isLoading(): boolean {
    // read the signal exposed by the facade (returns a boolean)
    return !!this.authFacade.getLoginStatus().loading?.();
  }

  // onSubmit: construye payload acorde al backend y llama a authFacade.login
  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.value;
    const loginPayload: LoginPayload = {
      // tu backend acepta email o phone como credencial (según LoginDto)
      email: v.contactMethod === 'email' ? v.email : undefined,
      phoneNumber: v.contactMethod === 'phone' ? v.phone : undefined,
      password: v.password,
      // opcional: sessionType: 'web'|'api_client' (si quieres forzarlo)
      appAudience: APP_AUDIENCE,
      expectedUserType: EXPECTED_USER_TYPE
    };
    console.log('login payload ->', loginPayload);

    // Llamada al facade. El facade debe encargarse de:
    // - Usar withCredentials en web (para cookie)
    // - Guardar tokens / persistir refresh token en mobile
    // - Actualizar AuthStore con user/accessToken o con errores/formErrors
    this.authFacade.login(loginPayload).pipe(take(1)).subscribe({
      next: () => {
        // login exitoso: limpiar form y navegar
        this.form.reset();
        this.form.patchValue({ contactMethod: 'email' });
        this.form.markAsPristine();
        this.form.markAsUntouched();

        // limpiar estado del login si tu facade lo expone
        this.authFacade.clearLoginState?.();

        // navegar a la ruta principal (ajusta según tu app)
        this.router.navigate(['/home']);
      },
    });
  }
}
