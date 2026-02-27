import type { IResponse } from "../../domain/schemas/validation.js";
import { StorageService } from "../storage/StorageService.js";

class ExtensionManager {
  public static async saveLastExtractionData(tabId: number | undefined, data: unknown): Promise<IResponse> {
    if (tabId === undefined || tabId === chrome.tabs.TAB_ID_NONE) {
      return { success: false, error: 'No tab id available for extraction data.' };
    }

    if (typeof data !== 'object' || data === null) {
      return { success: false, error: 'Invalid extraction data.' };
    }

    await StorageService.save(`lastExtractionData:${tabId}`, data);

    return { success: true };
  }

  public static async saveDetectedRouterModel(tabId: number | undefined, model: unknown): Promise<IResponse> {
    if (tabId === undefined || tabId === chrome.tabs.TAB_ID_NONE) {
      return { success: false, error: 'No tab id available for detected router model.' };
    }

    if (typeof model !== 'string' || model.trim() === '') {
      return { success: false, error: 'Invalid router model.' };
    }

    await StorageService.save(`detectedRouterModel:${tabId}`, model);

    return { success: true };
  }

  private static async resolvePopupWindowId(senderWindowId?: number): Promise<number | null> {
    if (senderWindowId !== undefined && senderWindowId !== chrome.windows.WINDOW_ID_NONE) {
      return senderWindowId;
    }

    const focusedWindow = await chrome.windows.getLastFocused({ windowTypes: ['normal'] });
    if (focusedWindow?.id !== undefined && focusedWindow.id !== chrome.windows.WINDOW_ID_NONE) {
      return focusedWindow.id;
    }

    const allNormalWindows = await chrome.windows.getAll({ windowTypes: ['normal'] });
    const fallbackWindow = allNormalWindows.find(window => window.id !== undefined);
    return fallbackWindow?.id ?? null;
  }

  public static async openPopup(senderWindowId?: number): Promise<IResponse> {
    try {
      const windowId = await this.resolvePopupWindowId(senderWindowId);
      if (windowId === null) {
        return { success: false, error: 'No browser window available to open popup.' };
      }

      await chrome.action.openPopup({ windowId });
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'openPopup') {
    ExtensionManager.openPopup(sender.tab?.windowId).then(sendResponse);
    return true;
  }

  if (message.action === 'saveDetectedRouterModel') {
    ExtensionManager.saveDetectedRouterModel(sender.tab?.id, message.model).then(sendResponse);
    return true;
  }

  if (message.action === 'saveLastExtractionData') {
    ExtensionManager.saveLastExtractionData(sender.tab?.id, message.data).then(sendResponse);
    return true;
  }

  return false;
});
