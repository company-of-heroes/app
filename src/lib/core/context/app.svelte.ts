import { dev } from '$app/environment';
import { Store } from '@tauri-apps/plugin-store';
import { Context } from 'runed';
import { z } from 'zod';
import { defaultsDeep } from 'lodash-es';

export const appSettingsSchema = z.object({
	autostart: z.boolean().default(true),
	isStreamer: z.boolean().default(false),
	companyOfHeroesConfigPath: z.string().default(''),
	companyOfHeroesInstallationPath: z.string().default('')
});

export type AppSettings = z.infer<typeof appSettingsSchema>;

export class AppContext {
	/**
	 * Indicates whether the application is ready.
	 *
	 * @public
	 * @type {boolean}
	 * @default false
	 */
	isReady: boolean = false;

	/**
	 * The store instance for persistent data storage.
	 *
	 * @public
	 * @type {Store}
	 */
	store!: Store;

	/**
	 * Reactive object holding the application's settings.
	 * Loaded from the store or initialized with defaults.
	 *
	 * @public
	 * @type {AppSettings}
	 */
	settings: AppSettings = $state({
		autostart: true,
		isStreamer: false,
		companyOfHeroesConfigPath: '',
		companyOfHeroesInstallationPath: ''
	});

	async start(): Promise<AppContext> {
		this.store = await Store.load(dev ? 'app.dev.json' : 'app.json');
		this.settings = await this.loadSettings();

		return this;
	}

	async loadSettings() {
		const storedSettings = await this.store.get<AppSettings>('settings');

		if (storedSettings) {
			this.settings = defaultsDeep(storedSettings, this.settings);
		}

		const settings = appSettingsSchema.parse(this.settings);
		console.log(settings);
		return settings;
	}
}

export const appContext = new Context<AppContext>('<app-context />');
export const createApp = (): AppContext => appContext.set(new AppContext());
export const useApp = (): AppContext => appContext.get();
