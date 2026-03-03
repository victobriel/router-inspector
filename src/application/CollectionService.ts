
import type { Router } from "../domain/models/Router.js";
import { RouterFactory } from "../infra/router/RouterFactory.js";
import { CredentialsSchema, type CollectMessage } from "../domain/schemas/validation.js";
import type { CollectResponse } from "./types/index.js";

export class CollectionService {
  public static async handleCollect(message: CollectMessage): Promise<CollectResponse> {
    const router = RouterFactory.create();
    const { action, credentials } = message;

    const actions = {
      collect: async () => await this.executeExtraction(router),
      authenticate: async () => {
        const { username, password } = CredentialsSchema.parse(credentials);

        router.authenticate({ username, password });

        const authRedirected = await this.waitForAuthRedirect(router, 1000);

        if (!authRedirected && !router.isAuthenticated()) {
          sessionStorage.removeItem('router_login_pending');
          sessionStorage.removeItem('router_login_time');
          return {
            success: false,
            message: 'Authentication failed. Please check your credentials'
          };
        }

        sessionStorage.setItem('router_login_pending', 'true');
        sessionStorage.setItem('router_login_time', Date.now().toString());

        return { success: true, waiting: true, message: 'Authentication in progress' };
      }
    };

    const handler = actions[action];
    if (!handler) {
      return { success: false, message: 'Unknown action' };
    }

    return await handler();
  }

  private static async executeExtraction(router: Router): Promise<CollectResponse> {
    const data = await router.extract();
    const hasData = Object.values(data).some(value => value !== null);

    return { 
      success: hasData,
      message: hasData ? 'Data extracted successfully' : 'No data could be extracted',
      data
    };
  }

  private static async waitForAuthRedirect(router: Router, timeoutMs = 8000): Promise<boolean> {
    const startTime = Date.now();

    return new Promise((resolve) => {
      if (!router.isAuthenticated()) {
        resolve(true);
        return;
      }

      const interval = setInterval(() => {
        if (!router.isAuthenticated()) {
          clearInterval(interval);
          resolve(true);
        }

        if (Date.now() - startTime >= timeoutMs) {
          clearInterval(interval);
          resolve(false);
        }
      }, 300);
    });
  }
}
