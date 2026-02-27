import type { ButtonConfig, Credentials, ExtractionResult, IResponse } from "../schemas/validation.js";

export abstract class Router {
  private readonly name: string;

  protected abstract readonly loginSelectors: {
    username: string;
    password: string;
  };

  protected constructor(name: string) {
    if (new.target === Router) {
      throw new Error('Router is abstract and cannot be instantiated directly.');
    }
    this.name = name;
  }

  public isLoginPage(): boolean {
    const selectors = [this.loginSelectors.username, this.loginSelectors.password];

    return selectors.every(selector => {
      const element = document.querySelector(selector);
      return element instanceof HTMLElement;
    });
  }

  public abstract authenticate(credentials?: Credentials): Promise<IResponse>;

  public abstract extract(): Promise<ExtractionResult>;

  public abstract buttonElementConfig(): ButtonConfig | null;

  public waitForElement(selector: string, timeoutMs = 5000): Promise<HTMLElement> {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element instanceof HTMLElement) {
        return resolve(element);
      }

      const observer = new MutationObserver(() => {
        const found = document.querySelector(selector);
        if (found instanceof HTMLElement) {
          observer.disconnect();
          resolve(found);
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Timeout: Element "${selector}" not found after ${timeoutMs}ms`));
      }, timeoutMs);
    });
  }

  public async waitForAuthRedirect(timeoutMs = 8000): Promise<boolean> {
    const startTime = Date.now();

    return new Promise((resolve) => {
      if (!this.isLoginPage()) {
        resolve(true);
        return;
      }

      const interval = setInterval(() => {
        if (!this.isLoginPage()) {
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

  public get usernameSelector(): string {
    return this.loginSelectors.username;
  }

  public get passwordSelector(): string {
    return this.loginSelectors.password;
  }

  public get model(): string {
    return this.name;
  }
}
