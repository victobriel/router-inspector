import { ExtractionResultSchema, type ExtractionResult } from "../domain/schemas/validation.js";
import { DomService } from "../infra/dom/DomService.js";
import { PopupView } from "../infra/dom/PopupView.js";
import { StorageService } from "../infra/storage/StorageService.js";

export class PopupController {
  private currentData: ExtractionResult | null = null;
  private static readonly LAST_DATA_STORAGE_KEY = 'lastExtractionData';
  private static readonly UI_STATE_STORAGE_KEY = 'lastPopupUiState';
  private activeTabId: number | null = null;
  private persistedStatus: { type: 'ok' | 'warn' | 'err' | ''; text: string } = { type: '', text: 'Ready' };
  private persistedLogs: Array<{ msg: string; type: 'ok' | 'warn' | 'err' | ''; time: string }> = [];

  private static readonly EXPECTED_NAVIGATION_ERROR_SNIPPETS = [
    'message channel closed before a response was received',
    'receiving end does not exist',
    'the tab was closed'
  ];

  constructor() {
    this.setupListeners();
    void this.initialize();
  }

  private async initialize(): Promise<void> {
    await this.resolveActiveTab();
    const isModelDetected = await this.updateRouterModel();
    this.setCollectButtonEnabled(isModelDetected);
    await this.loadPersistedData();
    await this.loadPersistedUiState();
    await this.checkPendingErrors();
  }

  private async resolveActiveTab(): Promise<void> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    this.activeTabId = tab?.id ?? null;
  }

  private setupListeners(): void {
    DomService.getElement('#btnCollect', HTMLElement).addEventListener('click', () => this.handleCollect());
    DomService.getElement('#btnClear', HTMLElement).addEventListener('click', () => this.handleClear());
  }

  private async handleCollect(): Promise<void> {
    const user = DomService.getValueElement('#inputUser').value.trim() || 'admin';
    const pass = DomService.getValueElement('#inputPass').value;

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      this.setStatus('err', 'No active tab');
      this.log("No active tab found", "err");
      return;
    }

    try {
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'authenticate',
        credentials: { username: user, password: pass }
      });

      if (!response?.success) {
        const errorMessage = response.message || 'Authentication failed';
        this.setStatus('warn', errorMessage);
        this.log(errorMessage, 'warn');
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
        this.log('Router page is redirecting after login. Retrying collection...', 'warn');
        await this.startRetryLoop(tab.id);
        return;
      }

      this.setStatus('err', 'Communication failed');
      this.log(errorMessage, 'err');
    }
  }

  private async startRetryLoop(tabId: number): Promise<void> {
    const maxRetries = 5;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      this.log(`Retrying collection (${attempt}/${maxRetries})...`);

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
          this.log(message, 'warn');
        }
      }

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    this.setStatus('err', 'Timeout: Page not ready');
    this.log('Timeout: Page not ready', 'err');
  }

  private processResponse(response: any): void {
    const result = ExtractionResultSchema.safeParse({
      ...response.data,
      timestamp: new Date().toISOString()
    });

    if (!result.success) {
      this.setStatus('warn', 'Invalid data format received');
      return;
    }

    this.currentData = result.data;
    this.renderData();
    void this.persistCurrentData();
    this.setStatus('ok', 'Data collected');
  }

  private renderData(): void {
    if (this.currentData === null) return;

    const data = this.currentData;
    PopupView.updateField('pppoeUsername', data.wan?.ppoeUsername ?? null);
    PopupView.updateField('internetStatus', this.toStatusText(data.wan?.internetStatus));
    PopupView.updateField('tr069Status', this.toStatusText(data.wan?.tr069Status));
    PopupView.updateField('ipVersion', data.wan?.ipVersion ?? null);
    PopupView.updateField('requestPdStatus', this.toStatusText(data.wan?.requestPdStatus));
    PopupView.updateField('slaacStatus', this.toStatusText(data.wan?.slaacStatus));
    PopupView.updateField('dhcpv6Status', this.toStatusText(data.wan?.dhcpv6Status));
    PopupView.updateField('pdStatus', this.toStatusText(data.wan?.pdStatus));
    PopupView.updateField('linkSpeed', data.wan?.linkSpeed ?? null);
  }

  private async checkPendingErrors(): Promise<void> {
    const pendingAuthError = await StorageService.get<string>('pendingAuthError');
    if (pendingAuthError !== null && pendingAuthError !== '') {
      await StorageService.remove('pendingAuthError');
      this.setStatus('warn', pendingAuthError);
    }
  }

  private handleClear(): void {
    this.currentData = null;
    this.setStatus('', 'Ready');
    PopupView.updateField('pppoeUsername', null);
    PopupView.updateField('internetStatus', null);
    PopupView.updateField('tr069Status', null);
    PopupView.updateField('ipVersion', null);
    PopupView.updateField('requestPdStatus', null);
    PopupView.updateField('slaacStatus', null);
    PopupView.updateField('dhcpv6Status', null);
    PopupView.updateField('pdStatus', null);
    PopupView.updateField('linkSpeed', null);
    PopupView.clearLogs();
    this.persistedLogs = [];
    void this.persistUiState();
    const storageKey = this.getTabStorageKey(PopupController.LAST_DATA_STORAGE_KEY);
    if (storageKey !== null) {
      void StorageService.remove(storageKey);
    }
  }

  private async loadPersistedData(): Promise<void> {
    const storageKey = this.getTabStorageKey(PopupController.LAST_DATA_STORAGE_KEY);
    if (storageKey === null) return;

    const rawData = await StorageService.get<unknown>(storageKey);
    if (!rawData) return;

    const parsed = ExtractionResultSchema.safeParse(rawData);
    if (!parsed.success) {
      await StorageService.remove(storageKey);
      return;
    }

    this.currentData = parsed.data;
    this.renderData();
  }

  private async persistCurrentData(): Promise<void> {
    if (this.currentData === null) return;
    const storageKey = this.getTabStorageKey(PopupController.LAST_DATA_STORAGE_KEY);
    if (storageKey === null) return;

    await StorageService.save(storageKey, this.currentData);
  }

  private async loadPersistedUiState(): Promise<void> {
    const storageKey = this.getTabStorageKey(PopupController.UI_STATE_STORAGE_KEY);
    if (storageKey === null) return;

    const state = await StorageService.get<{
      status?: { type?: string; text?: string };
      logs?: Array<{ msg?: string; type?: string; time?: string }>;
    }>(storageKey);
    if (!state) return;

    const statusType = state.status?.type;
    const statusText = state.status?.text;
    if (
      (statusType === '' || statusType === 'ok' || statusType === 'warn' || statusType === 'err') &&
      typeof statusText === 'string'
    ) {
      this.persistedStatus = { type: statusType, text: statusText };
      PopupView.setStatus(statusType, statusText);
    }

    if (Array.isArray(state.logs)) {
      const logs = state.logs.filter(log =>
        typeof log?.msg === 'string' &&
        (log?.type === '' || log?.type === 'ok' || log?.type === 'warn' || log?.type === 'err') &&
        typeof log?.time === 'string'
      ) as Array<{ msg: string; type: 'ok' | 'warn' | 'err' | ''; time: string }>;

      this.persistedLogs = logs.slice(0, 50);
      PopupView.clearLogs();
      for (let index = this.persistedLogs.length - 1; index >= 0; index--) {
        const entry = this.persistedLogs[index];
        if (!entry) continue;
        PopupView.log(entry.msg, entry.type, entry.time);
      }
    }
  }

  private async persistUiState(): Promise<void> {
    const storageKey = this.getTabStorageKey(PopupController.UI_STATE_STORAGE_KEY);
    if (storageKey === null) return;

    await StorageService.save(storageKey, {
      status: this.persistedStatus,
      logs: this.persistedLogs
    });
  }

  private setStatus(type: 'ok' | 'warn' | 'err' | '', text: string): void {
    this.persistedStatus = { type, text };
    PopupView.setStatus(type, text);
    void this.persistUiState();
  }

  private log(msg: string, type: 'ok' | 'warn' | 'err' | '' = ''): void {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    this.persistedLogs.unshift({ msg, type, time });
    if (this.persistedLogs.length > 50) {
      this.persistedLogs = this.persistedLogs.slice(0, 50);
    }
    PopupView.log(msg, type, time);
    void this.persistUiState();
  }

  private toStatusText(value: boolean | undefined): string | null {
    if (value === undefined) return null;
    return value ? 'Enabled' : 'Disabled';
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private isExpectedNavigationError(errorMessage: string): boolean {
    const normalizedError = errorMessage.toLowerCase();
    return PopupController.EXPECTED_NAVIGATION_ERROR_SNIPPETS.some(snippet => normalizedError.includes(snippet));
  }

  private async updateRouterModel(): Promise<boolean> {
    const routerModelElement = DomService.getElement('#routerModel', HTMLElement);
    const storageKey = this.getTabStorageKey('detectedRouterModel');

    if (storageKey === null) {
      routerModelElement.textContent = 'Not detected';
      return false;
    }

    try {
      const model = await StorageService.get<string>(storageKey);
      routerModelElement.textContent = typeof model === 'string' && model.trim() !== ''
        ? model
        : 'Not detected';
      return typeof model === 'string' && model.trim() !== '';
    } catch {
      routerModelElement.textContent = 'Not detected';
      return false;
    }
  }

  private setCollectButtonEnabled(enabled: boolean): void {
    DomService.getElement('#btnCollect', HTMLButtonElement).disabled = !enabled;
  }

  private getTabStorageKey(baseKey: string): string | null {
    if (this.activeTabId === null) return null;
    return `${baseKey}:${this.activeTabId}`;
  }
}
