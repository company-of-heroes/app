import { dev } from '$app/environment';
import type { AppContext } from '$core/app/context';
import { dirname, documentDir, join, appConfigDir } from '@tauri-apps/api/path';

export class Paths {
	constructor(readonly app: AppContext) {}

	async cohConfigDir(): Promise<string> {
		return (
			(await dirname(this.app.settings.companyOfHeroesConfigPath)) ||
			join(await documentDir(), 'My Games', 'Company of Heroes Relaunch')
		);
	}

	async appConfigFileBackupPath(): Promise<string> {
		return join(await this.documentDir(), 'com.fknoobscoh.app.backup');
	}

	async cohPlaybackDir(): Promise<string> {
		return join(await this.cohConfigDir(), 'playback');
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

	async documentDir(): Promise<string> {
		return await documentDir();
	}

	async appConfigDir(): Promise<string> {
		return await appConfigDir();
	}

	async appConfigFilePath(): Promise<string> {
		return join(await this.appConfigDir(), dev ? 'app.dev.json' : 'app.json');
	}
}
