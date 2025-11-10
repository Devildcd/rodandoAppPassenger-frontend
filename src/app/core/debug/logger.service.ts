import { environment } from "@/environments/environment";
import { Injectable } from "@angular/core";

type Lvl = 'log'|'info'|'warn'|'error';
type Tag = 'DA'|'HTTP'|'LOC'|'APP'|'PAX'|'PL';

@Injectable({ providedIn: 'root' })
export class DebugLogger {
  private enabled = !!environment.debug;
  private allowed = new Set((environment as any).debugTags ?? []);

  enable(v = true) { this.enabled = v; }
  allowTags(tags: string[]) { this.allowed = new Set(tags); }

  private ok(tag: Tag) {
    if (!this.enabled) return false;
    if (!this.allowed.size) return true;
    return this.allowed.has(tag);
  }

  private fmt(tag: Tag, msg: any) {
    const time = new Date().toISOString().split('T')[1].replace('Z','');
    return [`%c[${time}] %c${tag}%c`, 'color:#999', 'color:#6cf;font-weight:600', 'color:inherit', msg];
  }

  out(tag: Tag, lvl: Lvl, ...args: any[]) {
    if (!this.ok(tag)) return;
    const [fmt, ...rest] = this.fmt(tag, args[0]);
    // @ts-ignore
    console[lvl](fmt, ...rest, ...args.slice(1));
  }

  log(tag: Tag, ...a:any[]){ this.out(tag,'log',...a); }
  info(tag: Tag, ...a:any[]){ this.out(tag,'info',...a); }
  warn(tag: Tag, ...a:any[]){ this.out(tag,'warn',...a); }
  error(tag: Tag, ...a:any[]){ this.out(tag,'error',...a); }

  group(tag: Tag, title: string) {
    if (!this.ok(tag)) return { end: () => {} };
    // eslint-disable-next-line no-console
    console.groupCollapsed(`%c${tag}%c ${title}`, 'color:#6cf;font-weight:600', 'color:inherit');
    return { end: () => console.groupEnd() };
  }
}