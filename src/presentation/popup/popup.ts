import { PopupController } from "./PopupController.js";
import { ThemeManager } from "./ThemeManager.js";

enum tabElement {
  MAIN = "main",
  LOGS = "logs",
  TOPOLOGY = "topology",
}

function setupTabs(): void {
  const tabMain = document.getElementById("popup-tab-main");
  const tabLogs = document.getElementById("popup-tab-logs");
  const tabTopology = document.getElementById("popup-tab-topology");

  const panelMain = document.getElementById("popup-panel-main");
  const panelLogs = document.getElementById("popup-panel-logs");
  const panelTopology = document.getElementById("popup-panel-topology");

  if (
    !tabMain ||
    !tabLogs ||
    !panelMain ||
    !panelLogs ||
    !tabTopology ||
    !panelTopology
  )
    return;

  const activate = (target: tabElement): void => {
    const isMain = target === tabElement.MAIN;
    const isLogs = target === tabElement.LOGS;
    const isTopology = target === tabElement.TOPOLOGY;

    tabMain.classList.toggle("popup-tab--active", isMain);
    tabLogs.classList.toggle("popup-tab--active", isLogs);
    tabTopology.classList.toggle("popup-tab--active", isTopology);

    tabMain.setAttribute("aria-selected", String(isMain));
    tabLogs.setAttribute("aria-selected", String(isLogs));
    tabTopology.setAttribute("aria-selected", String(isTopology));

    panelMain.classList.toggle("popup-hidden", !isMain);
    panelLogs.classList.toggle("popup-hidden", !isLogs);
    panelTopology.classList.toggle("popup-hidden", !isTopology);
  };

  tabMain.addEventListener("click", () => activate(tabElement.MAIN));
  tabLogs.addEventListener("click", () => activate(tabElement.LOGS));
  tabTopology.addEventListener("click", () => activate(tabElement.TOPOLOGY));
}

/** Section toggle/section id pairs; must match popup.html. */
const SECTION_IDS = [
  { toggleId: "popup-toggle-wan", sectionId: "popup-section-wan" },
  {
    toggleId: "popup-toggle-remote-access",
    sectionId: "popup-section-remote-access",
  },
  {
    toggleId: "popup-toggle-wlan-band-steering",
    sectionId: "popup-section-wlan-band-steering",
  },
  {
    toggleId: "popup-toggle-wlan-24ghz",
    sectionId: "popup-section-wlan-24ghz",
  },
  { toggleId: "popup-toggle-wlan-5ghz", sectionId: "popup-section-wlan-5ghz" },
  { toggleId: "popup-toggle-dhcp", sectionId: "popup-section-dhcp" },
  { toggleId: "popup-toggle-upnp", sectionId: "popup-section-upnp" },
  {
    toggleId: "popup-toggle-router-version",
    sectionId: "popup-section-router-version",
  },
  { toggleId: "popup-toggle-tr069-url", sectionId: "popup-section-tr069-url" },
  {
    toggleId: "popup-toggle-topology-cable",
    sectionId: "popup-section-topology-cable",
  },
  {
    toggleId: "popup-toggle-topology-24ghz",
    sectionId: "popup-section-topology-24ghz",
  },
  {
    toggleId: "popup-toggle-topology-5ghz",
    sectionId: "popup-section-topology-5ghz",
  },
] as const;

function setupSectionToggles(): void {
  for (const { toggleId, sectionId } of SECTION_IDS) {
    const toggle = document.getElementById(toggleId);
    const section = document.getElementById(sectionId);
    if (!toggle || !section) continue;

    toggle.addEventListener("click", () => {
      const isCollapsed = section.classList.toggle("collapsed");
      toggle.setAttribute("aria-expanded", String(!isCollapsed));
    });
  }
}

function setupSettingsButton(): void {
  const btn = document.querySelector<HTMLButtonElement>(".popup-btn-settings");
  if (!btn) return;
  btn.addEventListener("click", () => {
    void chrome.runtime.openOptionsPage();
  });
}

function setupCloseButton(): void {
  const btn = document.getElementById("popup-btn-close");
  if (!btn) return;
  btn.addEventListener("click", () => {
    window.parent.postMessage({ type: "router-inspector-close" }, "*");
  });
}

document.addEventListener("DOMContentLoaded", () => {
  new ThemeManager();
  setupTabs();
  setupSectionToggles();
  setupSettingsButton();
  setupCloseButton();
  new PopupController();
});
