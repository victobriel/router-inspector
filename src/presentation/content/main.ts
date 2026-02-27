import { RouterFactory } from "../../domain/models/RouterFactory.js";
import { CollectionService } from "../../application/CollectionService.js";
import { DomService } from "../../infra/dom/DomService.js";
import { StorageService } from "../../infra/storage/StorageService.js";
import { CollectMessageSchema } from "../../domain/schemas/validation.js";
import type { Router } from "../../domain/models/Router.js";

chrome.runtime.onMessage.addListener((rawMessage, _sender, sendResponse) => {
  const result = CollectMessageSchema.safeParse(rawMessage);

  if (!result.success) {
    return false; // Not a message we handle
  }

  CollectionService.handleCollect(result.data)
    .then(sendResponse)
    .catch(error => {
      sendResponse({
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    });

  return true; // Keep channel open for async response
});

window.addEventListener('load', async () => {
  let router: Router;
  try {
    router = RouterFactory.create();
  } catch {
    return;
  }

  void chrome.runtime.sendMessage({
    action: 'saveDetectedRouterModel',
    model: router.model
  });

  const loginPending = sessionStorage.getItem('router_login_pending');
  const loginTimeStr = sessionStorage.getItem('router_login_time');

  if (loginPending === 'true' && loginTimeStr !== null) {
    await handlePostLoginRedirect(router, parseInt(loginTimeStr, 10));
  }

  injectUIComponents(router);
});

/**
 * Handles the logic after the page reloads during an authentication flow.
 */
async function handlePostLoginRedirect(router: Router, loginTime: number): Promise<void> {
  sessionStorage.removeItem('router_login_pending');
  sessionStorage.removeItem('router_login_time');

  if (router.isLoginPage()) {
    await StorageService.save('pendingAuthError', 'Authentication failed. Please check your credentials.');
    chrome.runtime.sendMessage({ action: 'openPopup' });
    return;
  }

  const elapsed = Date.now() - loginTime;
  if (elapsed < 10000) {
    const result = await CollectionService.handleCollect({
      action: 'collect',
      credentials: { username: '', password: '' }
    });

    if (result.success) {
      await chrome.runtime.sendMessage({
        action: 'saveLastExtractionData',
        data: result.data
      });
      chrome.runtime.sendMessage({ action: 'openPopup' });
    }
  }
}

function injectUIComponents(router: Router): void {
  const config = router.buttonElementConfig();

  if (config === null || !router.isLoginPage()) return;

  try {
    const targetElement = DomService.getElement(config.targetSelector, HTMLElement);
    targetElement.style.position = 'relative';

    const btn = document.createElement('button');
    btn.id = 'router-collect-btn';
    btn.textContent = config.text;
    btn.style.cssText = config.style;

    btn.addEventListener('click', async () => {
      const username = DomService.getValueElement(router.usernameSelector).value.trim();
      const password = DomService.getValueElement(router.passwordSelector).value;

      if (username === '' || password === '') {
        alert("Please enter credentials in the router login fields first.");
        return;
      }

      const result = await CollectionService.handleCollect({
        action: 'authenticate',
        credentials: { username, password }
      });

      if (result.success && !('waiting' in result)) {
        chrome.runtime.sendMessage({ action: 'openPopup' });
      }
    });

    targetElement.appendChild(btn);
  } catch (error) {
    console.warn('UI Injection failed:', error);
  }
}
