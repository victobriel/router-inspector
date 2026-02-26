import { ExtractionResultSchema, type ExtractionResult } from "../domain/schemas/validation.js";
import { DomService } from "../infra/dom/DomService.js";
import { PopupView } from "../infra/dom/PopupView.js";

export class PopupController {
  private currentData: ExtractionResult | null = null;
  private static readonly EXPECTED_NAVIGATION_ERROR_SNIPPETS = [
    'message channel closed before a response was received',
    'receiving end does not exist',
    'the tab was closed'
  ];

  constructor() {
    this.setupListeners();
    this.checkPendingErrors();
  }

  private setupListeners(): void {
    DomService.getElement('#btnCollect', HTMLElement).addEventListener('click', () => this.handleCollect());
    DomService.getElement('#btnExport', HTMLElement).addEventListener('click', () => this.handleExport());
    DomService.getElement('#btnClear', HTMLElement).addEventListener('click', () => this.handleClear());
  }

  private async handleCollect(): Promise<void> {
    const user = DomService.getValueElement('#inputUser').value.trim() || 'admin';
    const pass = DomService.getValueElement('#inputPass').value;

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      PopupView.setStatus('err', 'No active tab');
      PopupView.log("No active tab found", "err");
      return;
    }

    try {
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'authenticate',
        credentials: { username: user, password: pass }
      });

      if (!response?.success) {
        const errorMessage = response.message || 'Authentication failed';
        PopupView.setStatus('warn', errorMessage);
        PopupView.log(errorMessage, 'warn');
        return;
      }

      if (response.success && response.waiting) {
        await this.startRetryLoop(tab.id);
        return;
      }

      this.processResponse(response);
    } catch (err) {
      const errorMessage = this.getErrorMessage(err);
      const isExpectedNavigationError = this.isExpectedNavigationError(errorMessage);

      if (isExpectedNavigationError) {
        PopupView.log('Router page is redirecting after login. Retrying collection...', 'warn');
        await this.startRetryLoop(tab.id);
        return;
      }

      PopupView.setStatus('err', 'Communication failed');
      PopupView.log(errorMessage, 'err');
    }
  }

  private async startRetryLoop(tabId: number): Promise<void> {
    const maxRetries = 5;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      PopupView.log(`Retrying collection (${attempt}/${maxRetries})...`);

      try {
        const res = await chrome.tabs.sendMessage(tabId, {
          action: 'collect',
          credentials: { username: '', password: '' }
        });

        if (res?.success) {
          this.processResponse(res);
          return;
        }
      } catch (error) {
        const message = this.getErrorMessage(error);
        if (!this.isExpectedNavigationError(message)) {
          PopupView.log(message, 'warn');
        }
      }

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    PopupView.setStatus('err', 'Timeout: Page not ready');
    PopupView.log('Timeout: Page not ready', 'err');
  }

  private processResponse(response: any): void {
    const result = ExtractionResultSchema.safeParse({
      ...response.data,
      model: response.model,
      timestamp: new Date().toISOString()
    });

    if (!result.success) {
      PopupView.setStatus('warn', 'Invalid data format received');
      return;
    }

    this.currentData = result.data;
    this.renderData();
    DomService.getElement('#btnExport', HTMLButtonElement).disabled = false;
    PopupView.setStatus('ok', 'Data collected');
  }

  private renderData(): void {
    if (this.currentData === null) return;
    
    const data = this.currentData;
    PopupView.updateField('pppoe', data.wan?.ppoeUsername ?? null);
    
    DomService.getElement('#modelDetected', HTMLElement).textContent = data.model;
  }

  private async checkPendingErrors(): Promise<void> {
    const store = await chrome.storage.local.get('pendingAuthError');
    if (store.pendingAuthError) {
      await chrome.storage.local.remove('pendingAuthError');
      PopupView.setStatus('warn', String(store.pendingAuthError));
    }
  }

  private handleExport(): void {
    if (this.currentData === null) return;
    PopupView.log("CSV Exported", "ok");
  }

  private handleClear(): void {
    this.currentData = null;
    PopupView.setStatus('', 'Ready');
    // Logic to reset all val- fields
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private isExpectedNavigationError(errorMessage: string): boolean {
    const normalizedError = errorMessage.toLowerCase();
    return PopupController.EXPECTED_NAVIGATION_ERROR_SNIPPETS.some(snippet => normalizedError.includes(snippet));
  }
}
