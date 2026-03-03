import {
  ExtractionResultSchema,
  type ExtractionResult,
} from "../../domain/schemas/validation.js";
import { DomService } from "../../infra/dom/DomService.js";
import { PopupView } from "../../infra/dom/PopupView.js";
import { StorageService } from "../../infra/storage/StorageService.js";
import { PopupStatusType } from "../../application/types/index.js";
import type { CollectResponse } from "../../application/types/index.js";

/** Presentation controller: drives popup UI and Chrome messaging. */
export class PopupController {
  private currentData: ExtractionResult | null = null;
  private static readonly LAST_DATA_STORAGE_KEY = "lastExtractionData";
  private static readonly UI_STATE_STORAGE_KEY = "lastPopupUiState";
  private activeTabId: number | null = null;
  private persistedStatus: { type: PopupStatusType; text: string } = {
    type: PopupStatusType.NONE,
    text: "Ready",
  };
  private persistedLogs: Array<{
    msg: string;
    type: PopupStatusType;
    time: string;
  }> = [];

  private static readonly EXPECTED_NAVIGATION_ERROR_SNIPPETS = [
    "message channel closed before a response was received",
    "receiving end does not exist",
    "the tab was closed",
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
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    this.activeTabId = tab?.id ?? null;
  }

  private setupListeners(): void {
    DomService.getElement("#btnCollect", HTMLElement).addEventListener(
      "click",
      () => this.handleCollect(),
    );
    DomService.getElement("#btnClear", HTMLElement).addEventListener(
      "click",
      () => this.handleClear(),
    );
  }

  private async handleCollect(): Promise<void> {
    const user =
      DomService.getValueElement("#inputUser").value.trim() || "admin";
    const pass = DomService.getValueElement("#inputPass").value;

    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id) {
      this.setStatus(PopupStatusType.ERROR, "No active tab");
      this.log("No active tab found", PopupStatusType.ERROR);
      return;
    }

    try {
      const response = (await chrome.tabs.sendMessage(tab.id, {
        action: "authenticate",
        credentials: { username: user, password: pass },
      })) as CollectResponse | undefined;

      if (!response?.success) {
        const errorMessage = this.getResponseMessage(response);
        this.setStatus(PopupStatusType.WARN, errorMessage);
        this.log(errorMessage, PopupStatusType.WARN);
        return;
      }

      if (response.success && response.waiting) {
        await this.startRetryLoop(tab.id);
        return;
      }

      this.processResponse(response);
    } catch (err) {
      const errorMessage = this.getErrorMessage(err);
      const isExpectedNavigationError =
        this.isExpectedNavigationError(errorMessage);

      if (isExpectedNavigationError) {
        this.log(
          "Router page is redirecting after login. Retrying collection...",
          PopupStatusType.WARN,
        );
        await this.startRetryLoop(tab.id);
        return;
      }

      this.setStatus(PopupStatusType.ERROR, "Communication failed");
      this.log(errorMessage, PopupStatusType.ERROR);
    }
  }

  private async startRetryLoop(tabId: number): Promise<void> {
    const maxRetries = 5;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      this.log(`Retrying collection (${attempt}/${maxRetries})...`);

      try {
        const res = (await chrome.tabs.sendMessage(tabId, {
          action: "collect",
          credentials: { username: "", password: "" },
        })) as CollectResponse | undefined;

        if (res?.success) {
          this.processResponse(res);
          return;
        }
      } catch (error) {
        const message = this.getErrorMessage(error);
        if (!this.isExpectedNavigationError(message)) {
          this.log(message, PopupStatusType.WARN);
        }
      }

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    this.setStatus(PopupStatusType.ERROR, "Timeout: Page not ready");
    this.log("Timeout: Page not ready", PopupStatusType.ERROR);
  }

  private processResponse(response: CollectResponse): void {
    const result = ExtractionResultSchema.safeParse({
      ...response.data,
      timestamp: new Date().toISOString(),
    });

    if (!result.success) {
      this.setStatus(PopupStatusType.WARN, "Invalid data format received");
      return;
    }

    this.currentData = result.data;
    this.renderData();
    void this.persistCurrentData();
    this.setStatus(PopupStatusType.OK, "Data collected");
  }

  private renderData(): void {
    if (this.currentData === null) return;

    const data = this.currentData;
    PopupView.updateField("pppoeUsername", data?.ppoeUsername ?? null);
    PopupView.updateField(
      "internetStatus",
      this.toStatusText(data?.internetStatus),
    );
    PopupView.updateField("tr069Status", this.toStatusText(data?.tr069Status));
    PopupView.updateField("ipVersion", data?.ipVersion ?? null);
    PopupView.updateField(
      "requestPdStatus",
      this.toStatusText(data?.requestPdStatus),
    );
    PopupView.updateField(
      "slaacStatus",
      this.toStatusText(data?.slaacStatus),
    );
    PopupView.updateField(
      "dhcpv6Status",
      this.toStatusText(data?.dhcpv6Status),
    );
    PopupView.updateField("pdStatus", this.toStatusText(data?.pdStatus));
    PopupView.updateField("linkSpeed", data?.linkSpeed ?? null);
  }

  private async checkPendingErrors(): Promise<void> {
    const pendingAuthError =
      await StorageService.get<string>("pendingAuthError");
    if (pendingAuthError !== null && pendingAuthError !== "") {
      await StorageService.remove("pendingAuthError");
      this.setStatus(PopupStatusType.WARN, pendingAuthError);
    }
  }

  private handleClear(): void {
    this.currentData = null;
    this.setStatus(PopupStatusType.NONE, "Ready");
    PopupView.updateField("pppoeUsername", null);
    PopupView.updateField("internetStatus", null);
    PopupView.updateField("tr069Status", null);
    PopupView.updateField("ipVersion", null);
    PopupView.updateField("requestPdStatus", null);
    PopupView.updateField("slaacStatus", null);
    PopupView.updateField("dhcpv6Status", null);
    PopupView.updateField("pdStatus", null);
    PopupView.updateField("linkSpeed", null);
    PopupView.clearLogs();
    this.persistedLogs = [];
    void this.persistUiState();
    const storageKey = this.getTabStorageKey(
      PopupController.LAST_DATA_STORAGE_KEY,
    );
    if (storageKey !== null) {
      void StorageService.remove(storageKey);
    }
  }

  private async loadPersistedData(): Promise<void> {
    const storageKey = this.getTabStorageKey(
      PopupController.LAST_DATA_STORAGE_KEY,
    );
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
    const storageKey = this.getTabStorageKey(
      PopupController.LAST_DATA_STORAGE_KEY,
    );
    if (storageKey === null) return;

    await StorageService.save(storageKey, this.currentData, 24 * 60 * 1000);
  }

  private async loadPersistedUiState(): Promise<void> {
    const storageKey = this.getTabStorageKey(
      PopupController.UI_STATE_STORAGE_KEY,
    );
    if (storageKey === null) return;

    const state = await StorageService.get<{
      status?: { type?: PopupStatusType; text?: string };
      logs?: Array<{ msg?: string; type?: string; time?: string }>;
    }>(storageKey);
    if (!state) return;

    const statusType = state.status?.type;
    const statusText = state.status?.text;
    if (statusType && typeof statusText === "string") {
      this.persistedStatus = { type: statusType, text: statusText };
      PopupView.setStatus(statusType, statusText);
    }

    if (Array.isArray(state.logs)) {
      const logs = state.logs.filter(
        (log) =>
          typeof log?.msg === "string" &&
          log?.type &&
          typeof log?.time === "string",
      ) as Array<{ msg: string; type: PopupStatusType; time: string }>;

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
    const storageKey = this.getTabStorageKey(
      PopupController.UI_STATE_STORAGE_KEY,
    );
    if (storageKey === null) return;

    await StorageService.save(storageKey, {
      status: this.persistedStatus,
      logs: this.persistedLogs,
    }, 24 * 60 * 1000);
  }

  private setStatus(type: PopupStatusType, text: string): void {
    this.persistedStatus = { type, text };
    PopupView.setStatus(type, text);
    void this.persistUiState();
  }

  private log(
    msg: string,
    type: PopupStatusType = PopupStatusType.NONE,
  ): void {
    const time = new Date().toLocaleTimeString("en-US", { hour12: false });
    this.persistedLogs.unshift({ msg, type, time });
    if (this.persistedLogs.length > 50) {
      this.persistedLogs = this.persistedLogs.slice(0, 50);
    }
    PopupView.log(msg, type, time);
    void this.persistUiState();
  }

  private toStatusText(value: boolean | undefined): string | null {
    if (value === undefined) return null;
    return value ? "Enabled" : "Disabled";
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private getResponseMessage(response: unknown): string {
    const fallback = "Unknown response format";

    if (!response || typeof response !== "object") {
      return fallback;
    }

    const message = (response as { message?: unknown }).message;
    if (typeof message !== "string" || message.trim() === "") {
      return fallback;
    }

    const normalized = this.parseZodIssuesFromString(message);
    return normalized ?? message;
  }

  private parseZodIssuesFromString(raw: string): string | null {
    const value = raw.trim();
    if (!value.startsWith("[") || !value.endsWith("]")) {
      return null;
    }

    try {
      const parsed = JSON.parse(value) as Array<{ message?: unknown }>;
      if (!Array.isArray(parsed)) {
        return null;
      }

      const messages = parsed
        .map((issue) =>
          typeof issue?.message === "string" ? issue.message : null,
        )
        .filter((item): item is string => item !== null && item.trim() !== "");

      return messages.length > 0 ? messages.join("; ") : null;
    } catch {
      return null;
    }
  }

  private isExpectedNavigationError(errorMessage: string): boolean {
    const normalizedError = errorMessage.toLowerCase();
    return PopupController.EXPECTED_NAVIGATION_ERROR_SNIPPETS.some((snippet) =>
      normalizedError.includes(snippet),
    );
  }

  private async updateRouterModel(): Promise<boolean> {
    const routerModelElement = DomService.getElement("#routerModel", HTMLElement);
    const storageKey = this.getTabStorageKey("detectedRouterModel");

    if (storageKey === null) {
      routerModelElement.textContent = "Not detected";
      return false;
    }

    try {
      const model = await StorageService.get<string>(storageKey);
      routerModelElement.textContent =
        typeof model === "string" && model.trim() !== ""
          ? model
          : "Not detected";
      return typeof model === "string" && model.trim() !== "";
    } catch {
      routerModelElement.textContent = "Not detected";
      return false;
    }
  }

  private setCollectButtonEnabled(enabled: boolean): void {
    DomService.getElement("#btnCollect", HTMLButtonElement).disabled =
      !enabled;
  }

  private getTabStorageKey(baseKey: string): string | null {
    if (this.activeTabId === null) return null;
    return `${baseKey}:${this.activeTabId}`;
  }
}
