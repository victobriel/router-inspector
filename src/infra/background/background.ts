import { StorageService } from "../storage/StorageService.js";
import type { CollectResponse } from "../../application/types/index.js";

class ExtensionManager {
  public static async saveLastExtractionData(tabId: number | undefined, data: unknown): Promise<CollectResponse> {
    if (tabId === undefined || tabId === chrome.tabs.TAB_ID_NONE) {
      return { success: false, message: 'No tab id available for extraction data' };
    }

    if (typeof data !== 'object' || data === null) {
      return { success: false, message: 'Invalid extraction data' };
    }

    await StorageService.save(`lastExtractionData:${tabId}`, data, 24 * 60 * 1000);

    return { success: true };
  }

  public static async saveDetectedRouterModel(tabId: number | undefined, model: unknown): Promise<CollectResponse> {
    if (tabId === undefined || tabId === chrome.tabs.TAB_ID_NONE) {
      return { success: false, message: 'No tab id available for detected router model' };
    }

    if (typeof model !== 'string' || model.trim() === '') {
      return { success: false, message: 'Invalid router model' };
    }

    await StorageService.save(`detectedRouterModel:${tabId}`, model, 14 * 60 * 1000);

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

  public static async openPopup(senderWindowId?: number): Promise<CollectResponse> {
    try {
      const windowId = await this.resolvePopupWindowId(senderWindowId);
      if (windowId === null) {
        return { success: false, message: 'No browser window available to open popup' };
      }

      await chrome.action.openPopup({ windowId });
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, message };
    }
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const actions = {
    openPopup: () => {
      void ExtensionManager.openPopup(sender.tab?.windowId)
      .then(sendResponse)
      .catch(error => {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      });
      return true;
    },

    saveDetectedRouterModel: () => {
      void ExtensionManager.saveDetectedRouterModel(sender.tab?.id, message.model)
      .then(sendResponse)
      .catch(error => {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      });
      return true;
    },

    saveLastExtractionData: () => {
      void ExtensionManager.saveLastExtractionData(sender.tab?.id, message.data)
        .then(sendResponse)
        .catch(error => {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        });
      return true;
    },
  };

  const handler = message.action;
  if (handler in actions) {
    return actions[handler as keyof typeof actions]();
  }

  return false; // No handler for this action
});
