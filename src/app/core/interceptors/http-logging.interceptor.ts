import { Injectable } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest, HttpResponse, HttpErrorResponse } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { DebugLogger } from '../debug/logger.service';

@Injectable()
export class HttpLoggingInterceptor implements HttpInterceptor {
  constructor(private dbg: DebugLogger) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const started = performance.now();
    this.dbg.info('HTTP', `→ ${req.method} ${req.urlWithParams}`, req.body ?? null);

    return next.handle(req).pipe(
      tap({
        next: (ev) => {
          if (ev instanceof HttpResponse) {
            const ms = (performance.now() - started).toFixed(0);
            this.dbg.info('HTTP', `← ${req.method} ${req.url} [${ev.status}] ${ms}ms`, ev.body ?? null);
          }
        },
        error: (err: HttpErrorResponse) => {
          const ms = (performance.now() - started).toFixed(0);
          this.dbg.error('HTTP', `✗ ${req.method} ${req.url} [${err.status}] ${ms}ms`, err.error ?? err.message);
        }
      })
    );
  }
}