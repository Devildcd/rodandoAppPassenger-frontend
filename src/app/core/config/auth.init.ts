import type { Provider } from '@angular/core';
import { AuthFacade } from 'src/app/store/auth/auth.facade';

export function initAuthFactory(auth: AuthFacade): () => Promise<void> {
  // opcional: evitar bloquear bootstrap más de X ms usando Promise.race
  const BOOTSTRAP_TIMEOUT_MS = 3000; // ajustar si quieres
  return () =>
    Promise.race([
      auth.restoreSession(), // tu método que intenta silent refresh y me()
      new Promise<void>((resolve) => setTimeout(() => resolve(), BOOTSTRAP_TIMEOUT_MS)),
    ]);
}
