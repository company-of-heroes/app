import { Feature } from '../feature.svelte';
import { getVersion } from '@tauri-apps/api/app';
import { app } from '$core/app/context';
import { padEnd } from 'lodash-es';
import { coerce, gt, valid } from 'semver';
import Changelog from './changelog.svelte';
import Update from './update.svelte';
import { fetch } from '$core/http/fetch';
import { settings } from '$core/config/settings.svelte';

export type UpdaterSettings = {
	enabled: boolean;
	didReadChangelog: boolean;
	version: string;
};

function normalizeVersion(version: string): string | null {
	const trimmed = version.trim();
	if (!trimmed) return null;

	const exact = valid(trimmed);
	if (exact) return exact;

	// Windows/MS Store builds can report 4-part versions like "0.52.4.0".
	// `semver` treats those as invalid, but `coerce()` safely normalizes them.
	return coerce(trimmed)?.version ?? null;
}

/**
 * Checks GitHub for new releases, downloads the installer in the background,
 * and shows the changelog after an update.
 */
export class Updater extends Feature<UpdaterSettings> {
	name = 'updater';

	hasUpdate = $state<boolean>(false);
	currentVersion = $state<string>('');
	latestVersion = $state<string>('');
	downloadUrl = $state<string | undefined>(undefined);
	downloadFileName = $state<string | undefined>(undefined);
	releaseUrl = $state<string | undefined>(undefined);

	get currentVersionFormatted() {
		return padEnd(this.currentVersion.toString(), 6, '.0');
	}

	get latestVersionFormatted() {
		return padEnd(this.latestVersion.toString(), 6, '.0');
	}

	async enable() {
		this.currentVersion = await getVersion();

		void this.#checkForUpdate().then(() => this.#maybeShowChangelog());
	}

	disable() {
		this.hasUpdate = false;
		this.downloadUrl = undefined;
		this.downloadFileName = undefined;
		this.releaseUrl = undefined;
	}

	async #checkForUpdate(): Promise<void> {
		try {
			const response = await fetch(
				'https://api.github.com/repos/company-of-heroes/app/releases/latest',
				{
					method: 'GET',
					headers: {
						Accept: 'application/vnd.github+json'
					}
				}
			);

			const release = (await response.json()) as {
				tag_name?: string;
				html_url?: string;
				assets?: Array<{ browser_download_url?: string; name?: string }>;
			};

			const latestRaw = (release.tag_name ?? '').replace(/^v/i, '').trim();
			this.latestVersion = latestRaw || this.currentVersion;
			this.releaseUrl = release.html_url;

			const latest = normalizeVersion(this.latestVersion);
			const current = normalizeVersion(this.currentVersion);

			const isNewer =
				(latest && current && gt(latest, current)) ||
				(!latest || !current ? this.latestVersion !== this.currentVersion : false);

			if (isNewer) {
				const assets = release.assets ?? [];
				const pick = (pattern: RegExp) =>
					assets.find((a) => pattern.test(a.name ?? '') && a.browser_download_url);

				const asset =
					pick(/setup\.exe$/i) ?? pick(/\.exe$/i) ?? pick(/\.msi$/i) ?? assets[0];

				this.downloadUrl = asset?.browser_download_url;
				this.downloadFileName = asset?.name;

				this.hasUpdate = true;
				this.openDialog();
			}
		} catch (error) {
			console.warn('[UPDATER]: update check failed:', error);
			this.latestVersion = this.currentVersion;
		}
	}

	#maybeShowChangelog(): void {
		const current = normalizeVersion(this.currentVersion);
		const previous = normalizeVersion(this.settings.version);

		const shouldShow =
			!previous ||
			(current && previous && gt(current, previous)) ||
			// Fallback: if we can't parse one of the versions, show the changelog
			// when the raw strings differ (better than silently doing nothing).
			(!current || !previous ? this.currentVersion !== this.settings.version : false);

		if (shouldShow) {
			this.openChangelog();

			app.modal.on('close', () => {
				this.settings.version = current ?? this.currentVersion;
			});
		}
	}

	openChangelog() {
		app.modal.create({
			component: Changelog,
			title: 'Changelog',
			description: 'Here are the latest changes in this version:',
			size: 'lg'
		});
		app.modal.open();
	}

	/**
	 * Called by the update dialog right before downloading/launching the installer:
	 * snapshots the settings (incl. account) to the external backup location.
	 */
	async prepareForUpdate(): Promise<void> {
		await settings.flush();
		await settings.backup.backupNow('pre-update');
	}

	openDialog() {
		if (!this.downloadUrl && !this.releaseUrl) {
			return;
		}

		app.modal.create({
			component: Update,
			title: 'Update Available',
			description: `A new version (${this.latestVersionFormatted}) is available. You are currently on version ${this.currentVersionFormatted}.`,
			props: {
				currentVersion: this.currentVersion,
				latestVersion: this.latestVersion,
				downloadUrl: this.downloadUrl,
				downloadFileName: this.downloadFileName,
				releaseUrl: this.releaseUrl,
				onPrepare: async () => this.prepareForUpdate()
			}
		});
		app.modal.open();
	}

	async defaultSettings(): Promise<UpdaterSettings> {
		const version = await getVersion();

		return {
			enabled: true,
			didReadChangelog: false,
			version: normalizeVersion(version) ?? version
		};
	}
}

export const updater = new Updater();
