import type { IResponse } from "../../domain/schemas/validation.js";

class ExtensionManager {
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
  if (message.action !== 'openPopup') {
    return false; 
  }

  ExtensionManager.openPopup(sender.tab?.windowId).then(sendResponse);
  return true;
});
