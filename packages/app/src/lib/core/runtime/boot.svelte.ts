import { goto } from '$app/navigation';
import { getVersion } from '@tauri-apps/api/app';
import { app } from '$core/app/context';
import { settings } from '$core/config/settings.svelte';
import { account } from '$core/account';
import { hasCredentials } from '$core/account/recovery';
import { registerBrowserHandoffGlobal } from '$core/account/browser-handoff-global';
import { game } from '$core/game/process.svelte';
import { pocketbase } from '$core/pocketbase';
import { resolveAppLocale, setLocale, t } from '$lib/i18n';
import { expandToMain } from './window-bounds';

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

	/** True when boot failed because the remote server did not respond (maintenance/outage). */
	serverUnavailable = $state(false);

	/** True on a fresh install (no account yet) or after a sign-out / expired session. */
	needsOnboarding = $state(false);

	/** Why the sign-in screen is shown for an existing install (expired session, rejected login). */
	signInMessage = $state<string | null>(null);

	/** A fresh install restores its best backup once; a failed restore ends on the sign-in screen. */
	#restoreTried = false;

	/** Set once the setup finished this run ("continue without account" has no account yet). */
	#onboarded = false;

	#settingsLoaded = false;
	#startPromise: Promise<boolean> | null = null;

	/** True once the splashscreen logo intro animation has finished. */
	splashIntroComplete = $state(false);

	/** Incremented to restart the splash intro (e.g. after retry). */
	splashSession = $state(0);

	/** Route to open after the splash, when a reload started on another page. */
	returnTo: string | null = null;

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

		const target = this.returnTo ?? '/';
		this.returnTo = null;
		await expandToMain();
		await goto(target);
	}

	get phaseLabel(): string {
		return t(PHASE_LABELS[this.phase]);
	}

	/**
	 * Drives the boot state machine. Called from the root layout on every
	 * navigation. Returns a path when the caller should leave this URL.
	 * Does not navigate itself: `goto` inside `load` starts a second
	 * navigation before the click router exists, and later links then do a
	 * full document reload.
	 */
	async advance(pathname: string): Promise<string | null> {
		if (this.phase === 'ready') {
			if (pathname === '/setup') {
				return '/';
			}

			// /splashscreen dismisses itself after the intro animation finishes.
			return null;
		}

		try {
			await this.#ensureSettingsLoaded();
		} catch {
			// Error state is shown on the splashscreen (with retry).
			if (pathname !== '/splashscreen') {
				return '/splashscreen';
			}

			return null;
		}

		// Fresh installs (or wiped app data): restore the backup with an account, if any.
		// Not after a sign-out: that keeps its settings file and must stay signed out.
		if (settings.loadResult?.source === 'fresh' && !hasCredentials(settings.tree.account)) {
			await this.#restoreBackup();
		}

		this.needsOnboarding = !this.#onboarded && !hasCredentials(settings.tree.account);

		if (this.needsOnboarding) {
			this.phase = 'onboarding';
			if (pathname !== '/setup') {
				return '/setup';
			}

			return null;
		}

		const ready = await this.#ensureStarted();

		// The stored Steam session expired: back to the setup's sign-in step.
		if (this.needsOnboarding) {
			return pathname === '/setup' ? null : '/setup';
		}

		if (ready && pathname === '/setup') {
			return '/';
		}

		// Boot failed: surface the error state on the splashscreen.
		if (!ready && pathname !== '/splashscreen') {
			return '/splashscreen';
		}

		return null;
	}

	async #restoreBackup(): Promise<void> {
		if (this.#restoreTried) {
			return;
		}

		this.#restoreTried = true;
		const candidate = await settings.backup.findBestRestoreCandidate();
		if (!candidate || !hasCredentials(candidate.settings.account)) {
			return;
		}

		const result = await settings.replace(candidate.settings);
		if (!result.success) {
			console.warn('[BOOT]: backup restore failed:', result.error);
			return;
		}

		console.info('[BOOT]: restored settings and account from a backup');
	}

	/** Called by the setup wizard once the account step is done (paths are optional). */
	async completeOnboarding(): Promise<void> {
		await settings.persistNow();
		await settings.backup.backupNow('manual');

		this.#onboarded = true;
		this.needsOnboarding = false;
		this.signInMessage = null;
		this.resetSplashIntro();

		await goto('/splashscreen');
	}

	/** True when the remote server answers its health check. */
	async isServerReachable(): Promise<boolean> {
		try {
			await pocketbase.health.check({ requestKey: null });
			return true;
		} catch {
			return false;
		}
	}

	/** Retries a failed boot. */
	async retry(): Promise<void> {
		this.error = null;
		this.serverUnavailable = false;
		this.phase = 'idle';
		this.#startPromise = null;
		this.resetSplashIntro();

		const next = await this.advance('/splashscreen');
		if (next) {
			await goto(next);
		}
	}

	async #ensureSettingsLoaded(): Promise<void> {
		if (this.#settingsLoaded) {
			return;
		}

		this.phase = 'settings';

		try {
			const result = await settings.load();
			this.#settingsLoaded = true;
			const locale = resolveAppLocale(app.settings.locale);
			if (app.settings.locale !== locale) {
				app.settings.locale = locale;
			}

			setLocale(locale);

			if (result.source === 'legacy') {
				console.info('[BOOT]: migrated settings from the legacy store');
			}
		} catch (error) {
			this.phase = 'error';
			this.error = t('Failed to load settings: {message}', {
				message: error instanceof Error ? error.message : String(error)
			});
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

			// No working login and no working backup: open on the sign-in screen.
			if (outcome.action === 'failed' && outcome.reason === 'signed-out') {
				this.signInMessage = account.lastError;
				await account.signOut();
				this.#onboarded = false;
				this.needsOnboarding = true;
				this.phase = 'onboarding';
				this.#startPromise = null;
				return false;
			}

			if (outcome.action === 'failed') {
				this.serverUnavailable = outcome.reason === 'error' && !(await this.isServerReachable());
				this.phase = 'error';
				this.error = t('Could not sign in: {message}', {
					message: outcome.error ?? t('unknown error')
				});
				this.#startPromise = null;
				return false;
			}

			registerBrowserHandoffGlobal();

			// Services
			this.phase = 'services';
			void app.socket.start();

			window.addEventListener('beforeunload', () => {
				void settings.flush();
			});

			// Features (error-isolated; a broken feature never blocks boot). Path checks
			// first: features that need warnings.log stay unavailable without it.
			this.phase = 'features';
			await app.watchCohPaths();

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
			this.serverUnavailable = !(await this.isServerReachable());
			this.phase = 'error';
			this.error = t('Something went wrong: {message}', {
				message: error instanceof Error ? error.message : String(error)
			});
			this.#startPromise = null;
			return false;
		}
	}
}

export const boot = new Boot();
