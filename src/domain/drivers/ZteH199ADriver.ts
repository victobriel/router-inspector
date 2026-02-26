import { DomService } from "../../infra/dom/DomService.js";
import { Router } from "../models/Router.js";
import { CredentialsSchema, WanDataSchema, type ButtonConfig, type Credentials, type ExtractionResult, type IResponse, type WanData } from "../schemas/validation.js";

export class ZteH199ADriver extends Router {
  private readonly selectors = {
    user: '#Frm_Username, input[name="Frm_Username"]',
    pass: '#Frm_Password, input[name="Frm_Password"]',
    submit: '#LoginId, button[type="submit"]',
    internetTab: '#internet',
    configSection: '#internetConfig',
    ppoeSection: '#template_Internet_0',
    pppoeUsername: '#UserName\\:0, [id="UserName:0"], [name="UserName:0"], input[name*="UserName"]',
    ipMode: '#IpMode\\:0, [id="IpMode:0"], [name="IpMode:0"], select[name*="IpMode"]'
  };

  constructor() {
    super('ZTE ZXHN H199A');
  }

  public async authenticate(credentials: Credentials): Promise<IResponse> {
    if (!this.isLoginPage()) {
      return { success: true, message: 'Already authenticated.' };
    }

    const { username, password } = CredentialsSchema.parse(credentials);

    const userField = DomService.getValueElement(this.selectors.user);
    const passField = DomService.getValueElement(this.selectors.pass);
    const submitBtn = DomService.getElement(this.selectors.submit, HTMLElement);

    DomService.updateField(userField, username);
    DomService.updateField(passField, password);

    sessionStorage.setItem('router_login_pending', 'true');
    sessionStorage.setItem('router_login_time', Date.now().toString());

    setTimeout(() => DomService.safeClick(submitBtn), 100);

    const authRedirected = await this.waitForAuthRedirect(1000);

    if (!authRedirected && this.isLoginPage()) {
      sessionStorage.removeItem('router_login_pending');
      sessionStorage.removeItem('router_login_time');
      return { success: false, message: 'Authentication failed. Please check your credentials.' };
    }

    return { success: true, message: 'Login submitted. Waiting for redirect...' };
  }

  public async extract(): Promise<ExtractionResult> {
    return {
      model: this.name,
      timestamp: new Date().toISOString(),
      wan: await this.extractWanData()
    };
  }

  public async extractWanData(): Promise<WanData> {
    const internetTab = DomService.getElement(this.selectors.internetTab, HTMLElement);
    DomService.safeClick(internetTab);

    await new Promise(resolve => setTimeout(resolve, 500));
    await this.waitForElement(this.selectors.configSection);

    const configSection = DomService.getElement(this.selectors.configSection, HTMLElement);
    DomService.safeClick(configSection);

    await new Promise(resolve => setTimeout(resolve, 500));
    await this.waitForElement(this.selectors.ppoeSection);

    const ppoeSection = DomService.getElement(this.selectors.ppoeSection, HTMLElement);
    DomService.safeClick(ppoeSection);

    const data = {
      ppoeUsername: (DomService.getOptionalValue(this.selectors.pppoeUsername) ?? '').trim(),
      internetStatus: DomService.getInputElement('#Servlist_INTERNET\\:0').checked,
      tr069Status: DomService.getInputElement('#Servlist_TR069\\:0').checked,
      ipVersion: DomService.getOptionalValue(this.selectors.ipMode),
      requestPdStatus: DomService.getInputElement('#IsPD1\\:0').checked,
      slaacStatus: DomService.getInputElement('#IsSLAAC\\:0').checked,
      dhcpv6Status: DomService.getInputElement('#IsGUA\\:0').checked,
      pdStatus: DomService.getInputElement('#IsPdAddr\\:0').checked
    };

    return WanDataSchema.parse(data);
  }

  protected readonly loginSelectors = {
    username: '#Frm_Username, input[name="Frm_Username"]',
    password: '#Frm_Password, input[name="Frm_Password"], input[type="password"]'
  };

  public buttonElementConfig (): ButtonConfig | null {
    return {
      targetSelector: '#loginContainer',
      text: 'Get Data Automatically',
      style: `
        position: absolute;
        bottom: 6.5px;
        left: 27px;
        z-index: 10000;
        padding: 8px;
        color: #181717;
        border: none;
        cursor: pointer;
        text-decoration: underline;
        background-color: transparent;
      `
    };
  }
}
