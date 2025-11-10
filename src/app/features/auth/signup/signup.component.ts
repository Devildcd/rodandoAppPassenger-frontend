import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';

import { IonInput, IonItem, IonSegment, IonIcon, IonButton, IonSegmentButton, IonLabel, IonSpinner } from "@ionic/angular/standalone";
import { AuthMethod, UserType } from 'src/app/core/models/user/user.auxiliary';
import { UserFacade } from 'src/app/store/users/users.facade';
import { toSignal } from '@angular/core/rxjs-interop';
import { take } from 'rxjs';
import { Router } from '@angular/router';
import { showNotificationAlert } from 'src/app/store/notification-alerts/notification-alert.actions';
import { Store } from '@ngrx/store';

@Component({
  selector: 'app-signup',
  templateUrl: './signup.component.html',
  styleUrls: ['./signup.component.scss'],
  standalone: true,
  imports: [IonSpinner, IonLabel, IonSegmentButton, IonButton, IonIcon, IonSegment, FormsModule, CommonModule, ReactiveFormsModule],
})
export default class SignupComponent  implements OnInit {
  private fb = inject(FormBuilder);
  public userFacade = inject(UserFacade);
  private router = inject(Router);
  private store = inject(Store);

  constructor() {
    effect(() => {
    const formErrors = this.registerStatus.formErrors(); // signal
    if (!formErrors) return;

    // aplicar a los controls habilitados
    for (const [field, messages] of Object.entries(formErrors)) {
      const control = this.form.get(field);
      if (control && !control.disabled) {
        control.setErrors({ server: messages });
        control.markAsTouched();
      } else {
        // si el control está deshabilitado o no existe, mostrar notificación alternativa
        this.store.dispatch(showNotificationAlert({ payload: { type: 'error', message: (messages as string[])[0] } }));
      }
    }
  });
  }

  ngOnInit() {
  // aplica validators inicialmente según el valor por defecto
  this.applyContactValidators(this.form.get('contactMethod')!.value as 'email' | 'phone' | null);

  // además suscríbete a cambios para actualizar dinámicamente
  this.form.get('contactMethod')!.valueChanges.subscribe((val) => {
    this.applyContactValidators(val as 'email' | 'phone' | null);
  });
}

   // FormGroup como fuente de verdad
   form: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    contactMethod: ['email'], // 'email' | 'phone'
    email: ['', [Validators.email]],
    phone: ['+53'],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required]],
    userType: [UserType.Passenger],
  }, { validators: this.passwordsMatchValidator });

  // Convertir observables del form en signals (útil para template o lógica)
  readonly formValue = toSignal(this.form.valueChanges, { initialValue: this.form.value });
  readonly formStatus = toSignal(this.form.statusChanges, { initialValue: this.form.status });

  // Computed signals para UI
  readonly isValid = computed(() => this.form.valid);
  readonly contactMethod = toSignal(
  this.form.get('contactMethod')!.valueChanges,
  { initialValue: this.form.get('contactMethod')!.value }
);

  // Exponer loading / errors desde facade/register store
  readonly registerStatus = this.userFacade.getRegisterStatus(); // { status, loading, error, formErrors, lastRegisteredUserId }

  // Helper getters for template
  get loading() {
    return this.registerStatus.loading();
  }

  get formErrors() {
    return this.registerStatus.formErrors();
  }

  // Validators
  private passwordsMatchValidator(group: FormGroup) {
    const pw = group.get('password')?.value;
    const cpw = group.get('confirmPassword')?.value;
    return pw && cpw && pw === cpw ? null : { passwordsMismatch: true };
  }

  // Clear a specific control
  clearControl(name: string) {
    const control = this.form.get(name);
    if (!control) return;
    control.reset();
    control.markAsUntouched();
  }

/** Aplica validadores y habilita/deshabilita controles según método */
private applyContactValidators(method: 'email' | 'phone' | null) {
  const email = this.form.get('email')!;
  const phone = this.form.get('phone')!;

  if (method === 'email') {
    // Habilitar email y asignar validadores
    if (email.disabled) email.enable({ emitEvent: false });
    email.setValidators([Validators.required, Validators.email]);
    // limpia errores previos y (opcional) deja valor intacto o reset
    email.setErrors(null);
    // Desactivar telefono completamente (ya no participa en la validación ni en form.value)
    if (!phone.disabled) {
      phone.setErrors(null);
      phone.reset();       // opcional: limpia el valor
      phone.disable({ emitEvent: false });
    }
  } else if (method === 'phone') {
    // Habilitar phone y asignar validadores
    if (phone.disabled) phone.enable({ emitEvent: false });
    phone.setValidators([Validators.required, Validators.pattern(/^\+?\d{7,15}$/)]);
    phone.setErrors(null);
    // Desactivar email
    if (!email.disabled) {
      email.setErrors(null);
      email.reset();
      email.disable({ emitEvent: false });
    }
  } else {
    // Si method es null/otro, desactivar ambos por seguridad
    if (!email.disabled) { email.setErrors(null); email.reset(); email.disable({ emitEvent: false }); }
    if (!phone.disabled) { phone.setErrors(null); phone.reset(); phone.disable({ emitEvent: false }); }
  }

  // Re-evaluar validaciones en los controles que quedan habilitados
  email.updateValueAndValidity({ onlySelf: true, emitEvent: false });
  phone.updateValueAndValidity({ onlySelf: true, emitEvent: false });
  this.form.updateValueAndValidity({ onlySelf: false, emitEvent: false });
}

  isLoading(): boolean {
    // read the signal exposed by the facade (returns a boolean)
    return !!this.userFacade.getRegisterStatus().loading?.();
  }

  onSubmit() {
  if (this.form.invalid) {
    this.form.markAllAsTouched();
    return;
  }

  const v = this.form.value;
  const createUserPayload = {
    name: v.name,
    email: v.contactMethod === 'email' ? v.email : undefined,
    phoneNumber: v.contactMethod === 'phone' ? v.phone : undefined,
    userType: v.userType,
  };

  const credsPayload = {
    authenticationMethod: AuthMethod.LOCAL,
    password: v.password,
  };
  console.log(createUserPayload, credsPayload);

  // Llamamos a la facade que devuelve Observable<User>
  this.userFacade.register(createUserPayload as any, credsPayload as any)
    .pipe(take(1))
    .subscribe({
      next: () => {
        this.form.reset(); // limpia valores
        this.form.patchValue({ contactMethod: 'email', userType: /* default */ 'passenger' });
        this.form.markAsPristine();
        this.form.markAsUntouched();

        // 3) limpiar el estado de registro
        this.userFacade.clearRegisterState();
       this.router.navigate(['/auth/login']);
      },
    });
}

  getFormError(controlName: string, errorKey: string) {
    return this.form.get(controlName)?.errors?.[errorKey];
  }
}
