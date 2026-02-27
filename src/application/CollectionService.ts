
import type { Router } from "../domain/models/Router.js";
import { RouterFactory } from "../domain/models/RouterFactory.js";
import type { CollectMessage } from "../domain/schemas/validation.js";

export class CollectionService {
  public static async handleCollect(message: CollectMessage): Promise<Record<string, unknown>> {
    const router = RouterFactory.create();
    const { action, credentials } = message;

    const actions = {
      collect: async () => await this.executeExtraction(router),
      authenticate: async () => {
        const authResult = await router.authenticate({
          username: credentials.username,
          password: credentials.password
        });
        if (authResult.success) {
          return { success: true, message: authResult.message, waiting: true };
        }
        throw new Error(authResult.message || 'Authentication failed');
      }
    }

    const handler = actions[action];
    if (!handler) {
      return { success: false, message: 'Unknown action.' };
    }

    return await handler();
  }

  private static async executeExtraction(router: Router): Promise<Record<string, unknown>> {
    const data = await router.extract();
    const hasData = Object.values(data).some(value => value !== null);

    return { 
      success: hasData,
      message: 'Data extracted successfully.',
      data
    };
  }
}
