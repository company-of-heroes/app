import { appDataDir } from '@tauri-apps/api/path';
import { exists, mkdir, writeTextFile } from '@tauri-apps/plugin-fs';
import { Command, type Child } from '@tauri-apps/plugin-shell';
import PB from 'pocketbase';
import { Bootable } from './bootable.svelte';
import { app } from './app.svelte';

// Configuration constants
const POCKETBASE_CONFIG = {
	HOST: '127.0.0.1',
	PORT: 49240,
	DEFAULT_EMAIL: 'admin@fknoobs.com',
	DEFAULT_PASSWORD: '1234567890',
	BINARY_PATH: 'binaries/pocketbase',
	MIGRATION_FILE: '0001_create_superuser.js'
} as const;

const createSuperuserMigration = (email: string, password: string) => `migrate((app) => {
    let superusers = app.findCollectionByNameOrId("_superusers")
    let record = new Record(superusers)

    // note: the values can be eventually loaded via $os.getenv(key)
    // or from a special local config file
    record.set("email", "${email}")
    record.set("password", "${password}")

    app.save(record)
});`;

interface PocketbaseOptions {
	email?: string;
	password?: string;
	host?: string;
	port?: number;
}

export class Pocketbase extends Bootable {
	private process: Child | null = null;
	private readonly baseUrl: string;

	client: PB;

	constructor(options: PocketbaseOptions = {}) {
		super();

		this.baseUrl = `http://${app.settings.pocketbase.host}:${app.settings.pocketbase.port}`;
		this.client = new PB(this.baseUrl);
	}

	private async getDirectoryPaths() {
		const rootDir = await appDataDir();
		return {
			migrations: `${rootDir}/pb_migrations`,
			data: `${rootDir}/pb_data`,
			public: `${rootDir}/pb_public`
		};
	}

	private async setupMigrations(migrationsDir: string): Promise<void> {
		const migrationExists = await exists(migrationsDir);

		if (!migrationExists) {
			await mkdir(migrationsDir, { recursive: true });

			const migrationContent = createSuperuserMigration(
				app.settings.pocketbase.email,
				app.settings.pocketbase.password
			);

			const migrationPath = `${migrationsDir}/${POCKETBASE_CONFIG.MIGRATION_FILE}`;
			await writeTextFile(migrationPath, migrationContent);
		}
	}

	private async startServer(
		dirs: Awaited<ReturnType<typeof this.getDirectoryPaths>>
	): Promise<void> {
		const args = [
			'serve',
			`--http=${app.settings.pocketbase.host}:${app.settings.pocketbase.port}`,
			`--dir=${dirs.data}`,
			`--publicDir=${dirs.public}`,
			`--migrationsDir=${dirs.migrations}`
		];

		const command = Command.sidecar(POCKETBASE_CONFIG.BINARY_PATH, args);
		this.process = await command.spawn();
	}

	private async waitForReady(maxRetries = 30, delayMs = 1000): Promise<void> {
		for (let i = 0; i < maxRetries; i++) {
			try {
				await this.client.health.check();
				return;
			} catch {
				if (i === maxRetries - 1) {
					throw new Error('PocketBase failed to start within the expected time');
				}
				await new Promise((resolve) => setTimeout(resolve, delayMs));
			}
		}
	}

	async boot() {
		try {
			const dirs = await this.getDirectoryPaths();
			await this.setupMigrations(dirs.migrations);
			await this.startServer(dirs);
			await this.waitForReady();
		} catch (error) {
			throw new Error(
				`Failed to boot PocketBase: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}

		return this;
	}

	async shutdown(): Promise<void> {
		if (this.process) {
			try {
				await this.process.kill();
				this.process = null;
			} catch (error) {
				console.warn('Error shutting down PocketBase:', error);
			}
		}
	}

	async isHealthy(): Promise<boolean> {
		try {
			await this.client.health.check();
			return true;
		} catch {
			return false;
		}
	}

	getBaseUrl(): string {
		return this.baseUrl;
	}
}
