import { DomService } from "../dom/DomService.js";
import { Router } from "../../domain/models/Router.js";
import {
  ExtractionResultSchema,
  type ButtonConfig,
  type Credentials,
  type ExtractionResult,
} from "../../domain/schemas/validation.js";

export class ZteH199ADriver extends Router {
  private readonly selectors = {
    user: '#Frm_Username, input[name="Frm_Username"]',
    pass: '#Frm_Password, input[name="Frm_Password"]',
    submit: '#LoginId, button[type="submit"]',
    internetTab: '#internet',
    linkSpeed: '#cLinkSpeed\\:0',
    wanSection: '#internetConfig',
    ppoeSection: '#instName_Internet\\:0',
    pppoeUsername:
      '#UserName\\:0, [id="UserName:0"], [name="UserName:0"], input[name*="UserName"]',
    ipMode:
      '#IpMode\\:0, [id="IpMode:0"], [name="IpMode:0"], select[name*="IpMode"]',
  };

  constructor() {
    super("ZTE ZXHN H199A");
  }

  public authenticate(credentials: Credentials): void {
    if (this.isAuthenticated()) {
      return;
    }

    const { username, password } = credentials;

    const userField = DomService.getValueElement(this.selectors.user);
    const passField = DomService.getValueElement(this.selectors.pass);
    const submitBtn = DomService.getElement(this.selectors.submit, HTMLElement);

    DomService.updateField(userField, username);
    DomService.updateField(passField, password);

    setTimeout(() => DomService.safeClick(submitBtn), 100);
  }

  public async extract(): Promise<ExtractionResult> {
    const data = {
      timestamp: new Date().toISOString(),
      ...(await this.extractWanData()),
    };

    return ExtractionResultSchema.parse(data);
  }

  public async extractWanData(): Promise<ExtractionResult> {
    const internetTab = DomService.getElement(
      this.selectors.internetTab,
      HTMLElement,
    );
    DomService.safeClick(internetTab);

    await new Promise((resolve) => setTimeout(resolve, 500));
    await this.waitForElement(this.selectors.wanSection);

    const linkSpeed = (
      DomService.getOptionalValue(this.selectors.linkSpeed) ?? ""
    ).trim();

    const configSection = DomService.getElement(
      this.selectors.wanSection,
      HTMLElement,
    );
    DomService.safeClick(configSection);

    await new Promise((resolve) => setTimeout(resolve, 500));
    await this.waitForElement(this.selectors.ppoeSection);

    const ppoeSection = DomService.getElement(
      this.selectors.ppoeSection,
      HTMLElement,
    );
    DomService.safeClick(ppoeSection);

    const data = {
      ppoeUsername: (
        DomService.getOptionalValue(this.selectors.pppoeUsername) ?? ""
      ).trim(),
      internetStatus: DomService.getInputElement(
        '#Servlist_INTERNET\\:0',
      ).checked,
      tr069Status: DomService.getInputElement('#Servlist_TR069\\:0').checked,
      ipVersion:
        DomService.getOptionalValue(this.selectors.ipMode)?.toLowerCase() ===
        "both"
          ? "IPv4/IPv6"
          : DomService.getOptionalValue(this.selectors.ipMode) ?? null,
      requestPdStatus: DomService.getInputElement("#IsPD1\\:0").checked,
      slaacStatus: DomService.getInputElement("#IsSLAAC\\:0").checked,
      dhcpv6Status: DomService.getInputElement("#IsGUA\\:0").checked,
      pdStatus: DomService.getInputElement("#IsPdAddr\\:0").checked,
      linkSpeed,
    };

    return data;
  }

  protected readonly loginSelectors = {
    username: '#Frm_Username, input[name="Frm_Username"]',
    password:
      '#Frm_Password, input[name="Frm_Password"], input[type="password"]',
  };

  public isAuthenticated(): boolean {
    return /(?:^|;\s*)SID=/.test(document.cookie) && !this.isLoginPage();
  }

  public buttonElementConfig(): ButtonConfig | null {
    return {
      targetSelector: "#loginContainer",
      text: "Get Data Automatically",
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
      `,
    };
  }
}
