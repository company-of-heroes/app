import { goto } from '$app/navigation';
import { getVersion } from '@tauri-apps/api/app';
import { app } from '$core/app/context';
import { settings } from '$core/config/settings.svelte';
import type { BackupCandidate } from '$core/config/backup';
import { account } from '$core/account';
import { game } from '$core/game/process.svelte';

export type BootPhase =
	| 'idle'
	| 'settings'
	| 'onboarding'
	| 'account'
	| 'services'
	| 'features'
	| 'game'
	| 'ready'
	| 'error';

const PHASE_LABELS: Record<BootPhase, string> = {
	idle: 'Starting...',
	settings: 'Loading settings...',
	onboarding: 'Waiting for setup...',
	account: 'Signing in...',
	services: 'Starting services...',
	features: 'Loading features...',
	game: 'Watching for Company of Heroes...',
	ready: 'Ready',
	error: 'Something went wrong'
};

/**
 * Explicit boot pipeline.
 *
 * Phases: settings -> onboarding gate -> account -> services -> features ->
 * game -> ready. The root layout calls `advance()` on every navigation; the
 * splashscreen and setup wizard render the phase state.
 */
export class Boot {
	phase = $state<BootPhase>('idle');
	error = $state<string | null>(null);

	/** True while the mandatory CoH paths are missing/invalid. */
	needsOnboarding = $state(false);

	/** Backup proposed for restore during onboarding (fresh installs). */
	restoreCandidate = $state<BackupCandidate | null>(null);

	#settingsLoaded = false;
	#startPromise: Promise<boolean> | null = null;

	/** True once the splashscreen logo intro animation has finished. */
	splashIntroComplete = $state(false);

	/** Incremented to restart the splash intro (e.g. after retry). */
	splashSession = $state(0);

	resetSplashIntro(): void {
		this.splashIntroComplete = false;
		this.splashSession += 1;
	}

	markSplashIntroComplete(): void {
		this.splashIntroComplete = true;
	}

	/** Called by the splashscreen once boot is ready and the intro animation finished. */
	async dismissSplash(): Promise<void> {
		if (this.phase !== 'ready') {
			return;
		}

		await goto('/');
	}

	get phaseLabel(): string {
		return PHASE_LABELS[this.phase];
	}

	/**
	 * Drives the boot state machine. Called from the root layout on every
	 * navigation; navigates to /setup or / depending on state.
	 */
	async advance(pathname: string): Promise<void> {
		if (this.phase === 'ready') {
			if (pathname === '/setup') {
				await goto('/');
			}

			// /splashscreen dismisses itself after the intro animation finishes.
			return;
		}

		try {
			await this.#ensureSettingsLoaded();
		} catch {
			// Error state is shown on the splashscreen (with retry).
			if (pathname !== '/splashscreen') {
				await goto('/splashscreen');
			}

			return;
		}

		this.needsOnboarding = !(await app.isConfigured());

		if (this.needsOnboarding) {
			this.phase = 'onboarding';

			// Fresh installs (or wiped app data): offer a backup restore.
			if (this.restoreCandidate === null && account.userId === '') {
				this.restoreCandidate = await settings.backup.findBestRestoreCandidate();
			}

			if (pathname !== '/setup') {
				await goto('/setup');
			}

			return;
		}

		const ready = await this.#ensureStarted();

		if (ready && pathname === '/setup') {
			await goto('/');
		}

		// Boot failed: surface the error state on the splashscreen.
		if (!ready && pathname !== '/splashscreen') {
			await goto('/splashscreen');
		}
	}

	/** Called by the setup wizard once both paths validate. */
	async completeOnboarding(): Promise<void> {
		await settings.persistNow();
		await settings.backup.backupNow('manual');

		this.needsOnboarding = false;
		this.restoreCandidate = null;
		this.resetSplashIntro();

		await goto('/splashscreen');
	}

	/** Retries a failed boot. */
	async retry(): Promise<void> {
		this.error = null;
		this.phase = 'idle';
		this.#startPromise = null;
		this.resetSplashIntro();

		await this.advance('/splashscreen');
	}

	async #ensureSettingsLoaded(): Promise<void> {
		if (this.#settingsLoaded) {
			return;
		}

		this.phase = 'settings';

		try {
			const result = await settings.load();
			this.#settingsLoaded = true;

			if (result.source === 'legacy') {
				console.info('[BOOT]: migrated settings from the legacy store');
			}
		} catch (error) {
			this.phase = 'error';
			this.error = `Failed to load settings: ${error instanceof Error ? error.message : error}`;
			throw error;
		}
	}

	#ensureStarted(): Promise<boolean> {
		this.#startPromise ??= this.#start();
		return this.#startPromise;
	}

	async #start(): Promise<boolean> {
		try {
			app.version = await getVersion();

			// Account (recover/create) - blocking, with explicit error state.
			this.phase = 'account';
			const outcome = await account.ensureAccount();

			if (outcome.action === 'failed') {
				this.phase = 'error';
				this.error =
					outcome.reason === 'declined'
						? 'Account setup was cancelled. The app needs an account to function.'
						: `Could not sign in: ${outcome.error ?? 'unknown error'}`;
				this.#startPromise = null;
				return false;
			}

			// Services
			this.phase = 'services';

			window.addEventListener('beforeunload', () => {
				void settings.flush();
			});

			// Features (error-isolated; a broken feature never blocks boot)
			this.phase = 'features';

			for (const feature of app._features.values()) {
				try {
					await feature.register();
				} catch (error) {
					console.error(`[BOOT]: feature "${feature.name}" failed to start:`, error);
				}
			}

			// Game watchers
			this.phase = 'game';
			app.wire();
			await game.start();

			this.phase = 'ready';

			void settings.backup.backupNow('boot');

			return true;
		} catch (error) {
			console.error('[BOOT]: boot failed:', error);
			this.phase = 'error';
			this.error = error instanceof Error ? error.message : String(error);
			this.#startPromise = null;
			return false;
		}
	}
}

export const boot = new Boot();
