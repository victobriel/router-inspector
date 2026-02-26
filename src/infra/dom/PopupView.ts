import { DomService } from "./DomService.js";

export class PopupView {
  public static setStatus(type: 'ok' | 'warn' | 'err' | '', text: string): void {
    const dot = DomService.getElement('#statusDot', HTMLElement);
    const txt = DomService.getElement('#statusText', HTMLElement);
    dot.className = `status-dot ${type}`;
    txt.textContent = text;
  }

  public static updateField(id: string, value: string | null): void {
    const el = DomService.getElement(`#val-${id}`, HTMLElement);
    const displayValue = value === null || value === '' ? '—' : value;
    el.textContent = displayValue;
    el.className = `card-value ${displayValue === '—' ? 'empty' : ''}`;
  }

  public static log(msg: string, type: 'ok' | 'warn' | 'err' | '' = ''): void {
    const panel = DomService.getElement('#log', HTMLElement);
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.innerHTML = `<span class="log-time">[${time}]</span><span class="log-msg ${type}">${msg}</span>`;
    panel.prepend(entry);
  }
}
