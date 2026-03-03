import { PopupController } from "./PopupController.js";

enum tabElement {
	MAIN = 'main',
	LOGS = 'logs',
	TOPOLOGY = 'topology'
}

function setupTabs(): void {
	const tabMain = document.getElementById('tabMain');
	const tabLogs = document.getElementById('tabLogs');
	const tabTopology = document.getElementById('tabTopology');

	const panelMain = document.getElementById('panelMain');
	const panelLogs = document.getElementById('panelLogs');
	const panelTopology = document.getElementById('panelTopology');

	if (!tabMain || !tabLogs || !panelMain || !panelLogs || !tabTopology || !panelTopology) return;

	const activate = (target: tabElement): void => {
		const isMain = target === tabElement.MAIN;
		const isLogs = target === tabElement.LOGS;
		const isTopology = target === tabElement.TOPOLOGY;

		tabMain.classList.toggle('active', isMain);
		tabLogs.classList.toggle('active', isLogs);
		tabTopology.classList.toggle('active', isTopology);

		tabMain.setAttribute('aria-selected', String(isMain));
		tabLogs.setAttribute('aria-selected', String(isLogs));
		tabTopology.setAttribute('aria-selected', String(isTopology));

		panelMain.classList.toggle('hidden', !isMain);
		panelLogs.classList.toggle('hidden', !isLogs);
		panelTopology.classList.toggle('hidden', !isTopology);
	};

	tabMain.addEventListener('click', () => activate(tabElement.MAIN));
	tabLogs.addEventListener('click', () => activate(tabElement.LOGS));
	tabTopology.addEventListener('click', () => activate(tabElement.TOPOLOGY));
}

function setupSectionToggles(): void {
	const toggleWanSection = document.getElementById('toggleWanSection');
	const wanSection = document.getElementById('wanSection');

	const toggleRemoteAccessSection = document.getElementById('toggleRemoteAccessSection');
	const remoteAccessSection = document.getElementById('remoteAccessSection');

	if (!toggleWanSection || !wanSection || !toggleRemoteAccessSection || !remoteAccessSection) return;

	toggleWanSection.addEventListener('click', () => {
		const isCollapsed = wanSection.classList.toggle('collapsed');
		toggleWanSection.setAttribute('aria-expanded', String(!isCollapsed));
	});

	toggleRemoteAccessSection.addEventListener('click', () => {
		const isCollapsed = remoteAccessSection.classList.toggle('collapsed');
		toggleRemoteAccessSection.setAttribute('aria-expanded', String(!isCollapsed));
	});
}

document.addEventListener('DOMContentLoaded', () => {
	setupTabs();
	setupSectionToggles();
	new PopupController();
});
