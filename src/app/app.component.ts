import { Component, OnInit } from '@angular/core';
import { IonApp, IonRouterOutlet, IonItem, IonLabel, IonToggle } from '@ionic/angular/standalone';
import { Platform } from '@ionic/angular';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
  standalone: true,
})
export class AppComponent implements OnInit{
  isDarkTheme: boolean = false;
  constructor(private platform: Platform) { }

  ngOnInit() {
    this.platform.ready().then(() => {
      // 1. Cargar la preferencia guardada del usuario desde localStorage
      const savedTheme = localStorage.getItem('dark-mode');

      if (savedTheme === 'true') {
        // Si la preferencia es 'true', aplicar modo oscuro
        document.body.classList.add('dark');
        this.isDarkTheme = true; // Sincronizar el estado del toggle
      } else if (savedTheme === 'false') {
        // Si la preferencia es 'false', asegurar modo claro
        document.body.classList.remove('dark');
        this.isDarkTheme = false; // Sincronizar el estado del toggle
      } else {
        // Si no hay preferencia guardada, usar el modo claro por defecto
        document.body.classList.remove('dark'); // Asegurar que no esté en modo oscuro por si acaso
        this.isDarkTheme = false; // Sincronizar el estado del toggle

        // Opcional: También puedes escuchar la preferencia del sistema la primera vez
        // si quieres que por defecto siga la del sistema antes de guardar una manual.
        // Si no quieres que el modo oscuro del sistema se aplique si no hay preferencia guardada,
        // simplemente omite este bloque.
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
          // Si el sistema prefiere oscuro y no hay preferencia guardada,
          // puedes considerar aplicarlo, pero tu requisito es "modo claro por defecto".
          // Así que lo dejamos en modo claro a menos que el usuario lo cambie.
        }
      }

      // 2. Escuchar cambios en la preferencia del sistema operativo
      // Esto solo afectará si el usuario no ha guardado una preferencia manual.
      window.matchMedia('(prefers-color-scheme: dark)').addListener(e => {
        // Si NO hay una preferencia manual guardada (null o undefined)
        // entonces el tema se puede ajustar con la preferencia del sistema.
        if (localStorage.getItem('dark-mode') === null || localStorage.getItem('dark-mode') === undefined) {
          if (e.matches) {
            document.body.classList.add('dark');
            this.isDarkTheme = true;
          } else {
            document.body.classList.remove('dark');
            this.isDarkTheme = false;
          }
        }
      });
    });
  }

  toggleDarkTheme(event: any) {
    const prefersDark = event.detail.checked;
    document.body.classList.toggle('dark', prefersDark);
    this.isDarkTheme = prefersDark; // Actualizar la propiedad para el toggle
    localStorage.setItem('dark-mode', prefersDark.toString()); // Guardar como 'true' o 'false'
  }
}
