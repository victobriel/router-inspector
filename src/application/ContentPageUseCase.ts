import type { Router } from "../domain/models/Router.js";
import { RouterFactory } from "../infra/router/RouterFactory.js";
import { CollectionService } from "./CollectionService.js";
import { DomService } from "../infra/dom/DomService.js";
import { StorageService } from "../infra/storage/StorageService.js";

/**
 * Application use case: bootstrap content script on router page.
 * Detects router, persists model, handles post-login redirect, injects UI.
 */
export class ContentPageUseCase {
  public static async bootstrap(): Promise<void> {
    let router: Router;
    try {
      router = RouterFactory.create();
    } catch {
      return;
    }

    const result = await chrome.runtime.sendMessage({
      action: "saveDetectedRouterModel",
      model: router.model,
    });

    if (!result?.success) {
      console.warn("Failed to save detected router model", result?.message);
    }

    const loginPending = sessionStorage.getItem("router_login_pending");
    const loginTimeStr = sessionStorage.getItem("router_login_time");

    if (loginPending === "true" && loginTimeStr !== null) {
      await this.handlePostLoginRedirect(router, parseInt(loginTimeStr, 10));
    }

    this.injectUIComponents(router);
  }

  private static async handlePostLoginRedirect(
    router: Router,
    loginTime: number,
  ): Promise<void> {
    sessionStorage.removeItem("router_login_pending");
    sessionStorage.removeItem("router_login_time");

    if (router.isAuthenticated()) {
      await StorageService.save(
        "pendingAuthError",
        "Authentication failed. Please check your credentials", 5 * 60 * 1000,
      );
      void chrome.runtime.sendMessage({ action: "openPopup" });
      return;
    }

    const elapsed = Date.now() - loginTime;
    if (elapsed < 10000) {
      const result = await CollectionService.handleCollect({
        action: "collect",
        credentials: { username: "", password: "" },
      });

      if (result.success && result.data) {
        await chrome.runtime.sendMessage({
          action: "saveLastExtractionData",
          data: result.data,
        });
        void chrome.runtime.sendMessage({ action: "openPopup" });
      }
    }
  }

  private static injectUIComponents(router: Router): void {
    const config = router.buttonElementConfig();

    if (config === null || !router.isLoginPage()) return;

    try {
      const targetElement = DomService.getElement(
        config.targetSelector,
        HTMLElement,
      );
      targetElement.style.position = "relative";

        const btn = document.createElement("button");
        btn.id = "router-collect-btn";
        btn.textContent = config.text;
        btn.style.cssText = config.style;

        btn.addEventListener("click", async () => {
          const username = DomService.getValueElement(
            router.usernameSelector,
          ).value.trim();
          const password = DomService.getValueElement(
            router.passwordSelector,
          ).value;

          if (username === "" || password === "") {
            alert(
              "Please enter credentials in the router login fields first.",
            );
            return;
          }

          const result = await CollectionService.handleCollect({
            action: "authenticate",
            credentials: { username, password },
          });

          if (result.success && !result.waiting) {
            void chrome.runtime.sendMessage({ action: "openPopup" });
          }
        });

      targetElement.appendChild(btn);
    } catch (error) {
      console.warn("UI Injection failed:", error);
    }
  }
}
