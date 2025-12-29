import type { AppContext } from '$core/context';
import { dirname, documentDir, join } from '@tauri-apps/api/path';

export class Paths {
	constructor(readonly app: AppContext) {}

	async configDir(): Promise<string> {
		return (
			this.app.settings.companyOfHeroesConfigPath ||
			join(await documentDir(), 'My Games', 'Company of Heroes Relaunch')
		);
	}

	async playbackDir(): Promise<string> {
		return join(await this.configDir(), 'playback');
	}

	async installationDir(): Promise<string> {
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
}
