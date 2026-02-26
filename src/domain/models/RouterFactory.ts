import { ZteH199ADriver } from "../drivers/ZteH199ADriver.js";
import type { Router } from "./Router.js";

export class RouterFactory {
  public static create(): Router {
    const title = document.title.toLowerCase();
    const bodyText = document.body.innerText.toLowerCase();

    if (this.isZteH199A(title, bodyText)) {
      return new ZteH199ADriver();
    }

    throw new Error('Unsupported router model: The extension does not recognize this interface.');
  }

  private static isZteH199A(title: string, body: string): boolean {
    const indicators = ['h199a', 'zxhn', 'h199'];
    
    for (const term of indicators) {
      if (title.includes(term) || body.includes(term)) {
        return true;
      }
    }
    
    return false;
  }
}
