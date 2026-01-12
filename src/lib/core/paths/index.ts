import { dev } from '$app/environment';
import type { AppContext } from '$core/app/context';
import { dirname, documentDir, join, appConfigDir } from '@tauri-apps/api/path';

export class Paths {
	constructor(readonly app: AppContext) {}

	async cohConfigDir(): Promise<string> {
		return (
			this.app.settings.companyOfHeroesConfigPath ||
			join(await documentDir(), 'My Games', 'Company of Heroes Relaunch')
		);
	}

	async cohPlaybackDir(): Promise<string> {
		return join(await dirname(await this.cohConfigDir()), 'playback');
	}

	async cohInstallationDir(): Promise<string> {
		return (
			this.app.settings.companyOfHeroesInstallationPath ||
			join(
				'C:',
				'Program Files (x86)',
				'Steam',
				'steamapps',
				'common',
				'Company of Heroes Relaunch'
			)
		);
	}

	async configDir(): Promise<string> {
		return await appConfigDir();
	}

	async documentDir(): Promise<string> {
		return await documentDir();
	}

	async configFilePath(): Promise<string> {
		return join(await this.configDir(), dev ? 'app.dev.json' : 'app.json');
	}
}
