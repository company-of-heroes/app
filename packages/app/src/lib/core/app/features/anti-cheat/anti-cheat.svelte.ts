import type { Match } from '$core/game/lobby';
import type {
	AntiCheatModuleAllowlistResponse,
	AntiCheatProcessDenylistResponse
} from '$core/pocketbase/types';
import { invoke } from '@tauri-apps/api/core';
import { dirname, join } from '@tauri-apps/api/path';
import { watch } from 'runed';
import { dev } from '$app/environment';
import { app } from '$core/app/context';
import { account } from '$core/account';
import { pocketbase } from '$core/pocketbase';
import { fetch } from '$core/http/fetch';
import { Feature } from '../feature.svelte';
import { shortcuts } from '../shortcuts';
import { t } from '$lib/i18n';
import ChatAnnouncePrompt from './chat-announce-prompt.svelte';

export type AntiCheatSettings = {
	enabled: boolean;
	announceInChat: boolean;
	chatAnnouncePromptSeen: boolean;
};

type GameWindowCapture = {
	jpegBase64: string;
	width: number;
	height: number;
};

type DenylistedProcess = {
	name: string;
	pid: number;
};

type UnknownGameModule = {
	name: string;
	path: string;
	pid: number;
};

type ActiveSession = {
	sessionId: number;
	map: string;
};

const LOADING_GRACE_MS = 30_000;
const MIN_CAPTURES = 2;
const MAX_CAPTURES = 5;
const SCHEDULE_WINDOW_MS = 25 * 60 * 1000;
const MAX_SESSION_AGE_MS = 2 * 60 * 60 * 1000;
const FIRST_CAPTURE_MIN_MS = LOADING_GRACE_MS;
const FIRST_CAPTURE_MAX_MS = LOADING_GRACE_MS + 15_000;
const DEV_CAPTURE_DELAYS_MS = [1_000, 5_000, 10_000];
const FIRST_PROCESS_SCAN_MS = 8_000;
const PROCESS_SCAN_MIN_MS = 20_000;
const PROCESS_SCAN_MAX_MS = 30_000;
const CAPTURE_RETRY_MIN_MS = 5_000;
const CAPTURE_RETRY_MAX_MS = 15_000;
const MAX_CAPTURE_RETRIES = 20;
const CHAT_ANNOUNCE_MESSAGE = '[FAIRPLAY] Supervised by coh1stats.com';
const CHAT_ANNOUNCE_RETRY_MS = 100;
const CHAT_ANNOUNCE_RETRY_WINDOW_MS = 1_000;
const CHAT_ANNOUNCE_DEDUP_MS = 10_000;
const CHAT_INPUT_LOCK_MS = 1_000;
const CHAT_INPUT_LOCK_PULSE_MS = 400;
const CHAT_INPUT_LOCK_FAILSAFE_MS = 2_000;

function randomInt(min: number, max: number): number {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Elapsed time since `warnings.log` lobby start (`HH:MM:SS` wall clock). */
function matchElapsedMs(startedAt: string | undefined | null): number {
	if (!startedAt) {
		return 0;
	}

	const parsed = startedAt.trim().match(/^(\d{1,2}):(\d{2}):(\d{2})/);
	if (!parsed) {
		return 0;
	}

	const now = new Date();
	const started = new Date(now);
	started.setHours(Number(parsed[1]), Number(parsed[2]), Number(parsed[3]), 0);
	let elapsed = now.getTime() - started.getTime();
	if (elapsed < -5 * 60 * 1000) {
		elapsed += 24 * 60 * 60 * 1000;
	}

	return Math.max(0, elapsed);
}

function base64ToJpegFile(base64: string): File {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return new File([bytes], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
}

/**
 * Captures the Company of Heroes window during a live match, reports known
 * cheat processes from a server denylist, reports unknown DLLs loaded into the
 * game process, and can post a one-time all-chat announce so other players can
 * see that fair play is on.
 */
export class AntiCheat extends Feature<AntiCheatSettings> {
	name = 'anti-cheat';

	#unsubscribers: (() => void)[] = [];
	#disposeWatchers: (() => void) | null = null;
	#captureTimers: ReturnType<typeof setTimeout>[] = [];
	#processTimer: ReturnType<typeof setTimeout> | null = null;
	#chatRetryTimer: ReturnType<typeof setTimeout> | null = null;
	#inputLockTimer: ReturnType<typeof setInterval> | null = null;
	#inputLockFailsafe: ReturnType<typeof setTimeout> | null = null;
	#awaitingChatAnnounce = false;
	#session: ActiveSession | null = null;
	#sessionToken = 0;
	#denylist: AntiCheatProcessDenylistResponse[] = [];
	#moduleAllowlist: AntiCheatModuleAllowlistResponse[] = [];
	#reportedHits = new Set<string>();
	#reportedModuleHits = new Set<string>();
	#chatAnnounced = false;
	#chatAnnounceInFlight = false;
	#lastChatAnnounceAt = 0;
	#stopWaitingForModal: (() => void) | null = null;
	#promptInFlight = false;

	enable() {
		void this.#maybePromptChatAnnounce();

		this.#unsubscribers.push(
			app.on('lobby.joined', () => {
				this.#resetChatAnnounce();
			}),
			app.on('lobby.missionStarting', (match) => {
				if (match?.isReplay) {
					return;
				}

				void this.#announceChatNow();
			}),
			app.on('lobby.started', (match) => {
				if (match.isReplay) {
					return;
				}

				void this.#startSession(match);
			}),
			app.on('lobby.gameover', () => {
				this.#resetChatAnnounce();
				this.#stopSession();
			}),
			app.on('lobby.destroyed', () => {
				this.#resetChatAnnounce();
				this.#stopSession();
			})
		);

		this.#disposeWatchers = $effect.root(() => {
			watch(
				() => app.game.isRunning,
				(running) => {
					if (!running) {
						this.#resetChatAnnounce();
						this.#stopSession();
					}
				}
			);
			watch(
				() => app.game.isWindowFocused,
				(focused) => {
					if (!this.#awaitingChatAnnounce || !this.#shouldAnnounceChat()) {
						return;
					}

					if (focused) {
						this.#startInputLockPulse();
					} else {
						this.#releaseInputLock();
					}
				}
			);
		});

		if (app.lobby?.started && !app.lobby.ended && !app.lobby.isReplay) {
			void this.#startSession(app.lobby);
		}
	}

	disable() {
		this.#stopWaitingForModal?.();
		this.#stopWaitingForModal = null;
		this.#promptInFlight = false;
		this.#resetChatAnnounce();
		this.#stopSession();
		this.#disposeWatchers?.();
		this.#disposeWatchers = null;
		for (const unsubscribe of this.#unsubscribers) {
			unsubscribe();
		}
		this.#unsubscribers = [];
	}

	async register(): Promise<this> {
		await super.register();
		this.#applyChatAnnounceDefaultOff();
		return this;
	}

	defaultSettings(): AntiCheatSettings {
		return { enabled: true, announceInChat: false, chatAnnouncePromptSeen: false };
	}

	/** Previous default was on; opt existing installs into the new default once. */
	#applyChatAnnounceDefaultOff(): void {
		const settings = this.settings as AntiCheatSettings & {
			chatAnnounceDefaultOff?: boolean;
		};
		if (settings.chatAnnounceDefaultOff) {
			return;
		}

		// Already on (old default or user choice): keep it and skip the consent popup.
		if (this.settings.announceInChat) {
			this.settings.chatAnnouncePromptSeen = true;
		} else {
			this.settings.announceInChat = false;
		}

		settings.chatAnnounceDefaultOff = true;
	}

	#maybePromptChatAnnounce(): void {
		if (this.settings.chatAnnouncePromptSeen) {
			return;
		}

		if (this.settings.announceInChat) {
			this.settings.chatAnnouncePromptSeen = true;
			return;
		}

		this.#whenModalIdle(() => {
			void this.#showChatAnnouncePrompt();
		});
	}

	#whenModalIdle(run: () => void): void {
		this.#stopWaitingForModal?.();
		let done = false;
		const finish = () => {
			if (done || app.modal.isOpen) {
				return;
			}

			done = true;
			unsubscribe();
			this.#stopWaitingForModal = null;
			run();
		};
		const unsubscribe = app.modal.on('close', finish);
		this.#stopWaitingForModal = () => {
			done = true;
			unsubscribe();
			this.#stopWaitingForModal = null;
		};
		finish();
	}

	async #showChatAnnouncePrompt(): Promise<void> {
		if (this.#promptInFlight || this.settings.chatAnnouncePromptSeen) {
			return;
		}

		if (this.settings.announceInChat) {
			this.settings.chatAnnouncePromptSeen = true;
			return;
		}

		this.#promptInFlight = true;

		const enabled = await new Promise<boolean>((resolve) => {
			let settled = false;

			const settle = (value: boolean) => {
				if (settled) {
					return;
				}

				settled = true;
				unsubscribe();
				resolve(value);
				app.modal.close();
			};

			const unsubscribe = app.modal.on('close', () => {
				if (settled) {
					return;
				}

				settled = true;
				unsubscribe();
				resolve(false);
			});

			app.modal.create({
				component: ChatAnnouncePrompt,
				title: t('Show fair play in all-chat?'),
				description: t('Help other players trust that fair play is on.'),
				size: 'md',
				props: {
					onConfirm: () => settle(true),
					onCancel: () => settle(false)
				}
			});
			app.modal.open();
		});

		this.#promptInFlight = false;
		this.settings.chatAnnouncePromptSeen = true;
		if (enabled) {
			this.settings.announceInChat = true;
		}
	}

	async #startSession(match: Match): Promise<void> {
		this.#stopSession();

		if (!account.isAuthenticated) {
			console.warn('[ANTI-CHEAT]: skip session, not authenticated');
			return;
		}

		if (match.isReplay) {
			return;
		}

		if (match.ended || !app.game.isRunning) {
			return;
		}

		const elapsedMs = matchElapsedMs(match.startedAt);
		if (elapsedMs > MAX_SESSION_AGE_MS) {
			console.warn('[ANTI-CHEAT]: skip session, match start too old');
			return;
		}

		const token = this.#sessionToken;
		this.#session = {
			sessionId: match.sessionId || 0,
			map: match.map || match.mapName || 'Unknown'
		};
		this.#reportedHits.clear();
		this.#reportedModuleHits.clear();
		await Promise.all([this.#refreshDenylist(), this.#refreshModuleAllowlist()]);
		if (token !== this.#sessionToken || !this.#session) {
			return;
		}

		console.info('[ANTI-CHEAT]: session started', {
			sessionId: this.#session.sessionId,
			map: this.#session.map,
			elapsedSec: Math.round(elapsedMs / 1000)
		});
		this.#scheduleCaptures(elapsedMs);
		this.#processTimer = setTimeout(() => {
			void this.#scanProcesses();
		}, FIRST_PROCESS_SCAN_MS);
	}

	#stopSession(): void {
		this.#sessionToken += 1;
		this.#session = null;
		for (const timer of this.#captureTimers) {
			clearTimeout(timer);
		}
		this.#captureTimers = [];
		if (this.#processTimer) {
			clearTimeout(this.#processTimer);
			this.#processTimer = null;
		}
	}

	#trackTimer(timer: ReturnType<typeof setTimeout>): void {
		this.#captureTimers.push(timer);
	}

	#resetChatAnnounce(): void {
		this.#chatAnnounced = false;
		this.#chatAnnounceInFlight = false;
		this.#lastChatAnnounceAt = 0;
		this.#awaitingChatAnnounce = false;
		if (this.#chatRetryTimer) {
			clearTimeout(this.#chatRetryTimer);
			this.#chatRetryTimer = null;
		}

		this.#releaseInputLock();
	}

	#recentlyAnnouncedChat(): boolean {
		return this.#chatAnnounced && Date.now() - this.#lastChatAnnounceAt < CHAT_ANNOUNCE_DEDUP_MS;
	}

	#isLiveMatch(): boolean {
		if (!this.#session || !app.game.isRunning) {
			return false;
		}

		const lobby = app.lobby;
		if (!lobby?.started || lobby.ended) {
			return false;
		}

		if (this.#session.sessionId && lobby.sessionId && lobby.sessionId !== this.#session.sessionId) {
			return false;
		}

		return true;
	}

	#scheduleCaptures(elapsedMs: number): void {
		const offsets = new Set<number>();
		if (dev) {
			// `lobby.started` is several seconds after warnings.log start (loading).
			for (const delayMs of DEV_CAPTURE_DELAYS_MS) {
				offsets.add(delayMs);
			}
		} else {
			const firstFromStart = randomInt(FIRST_CAPTURE_MIN_MS, FIRST_CAPTURE_MAX_MS);
			if (firstFromStart > elapsedMs) {
				offsets.add(firstFromStart - elapsedMs);
			}

			const count = randomInt(MIN_CAPTURES, MAX_CAPTURES);
			let attempts = 0;
			while (offsets.size < count && attempts < 40) {
				attempts += 1;
				const fromStart = randomInt(LOADING_GRACE_MS + 30_000, SCHEDULE_WINDOW_MS);
				if (fromStart > elapsedMs) {
					offsets.add(fromStart - elapsedMs);
				}
			}
		}

		if (offsets.size === 0) {
			console.info('[ANTI-CHEAT]: skip captures, match sample window already elapsed', {
				elapsedSec: Math.round(elapsedMs / 1000)
			});
			return;
		}

		const scheduled = [...offsets].sort((a, b) => a - b);
		console.info(
			'[ANTI-CHEAT]: captures scheduled in',
			scheduled.map((ms) => `${Math.round(ms / 1000)}s`)
		);

		for (const offset of scheduled) {
			this.#trackTimer(setTimeout(() => void this.#captureWithRetry(0), offset));
		}
	}

	#startInputLockPulse(): void {
		this.#stopInputLockPulse();
		const pulse = () => {
			if (!this.#awaitingChatAnnounce || !this.#shouldAnnounceChat() || !app.game.isRunning) {
				this.#releaseInputLock();
				return;
			}

			void invoke('lock_game_input', { durationMs: CHAT_INPUT_LOCK_MS });
		};
		pulse();
		this.#inputLockTimer = setInterval(pulse, CHAT_INPUT_LOCK_PULSE_MS);
		if (!this.#inputLockFailsafe) {
			this.#inputLockFailsafe = setTimeout(() => {
				this.#inputLockFailsafe = null;
				this.#awaitingChatAnnounce = false;
				this.#releaseInputLock();
			}, CHAT_INPUT_LOCK_FAILSAFE_MS);
		}
	}

	#stopInputLockPulse(): void {
		if (this.#inputLockTimer) {
			clearInterval(this.#inputLockTimer);
			this.#inputLockTimer = null;
		}
	}

	#releaseInputLock(): void {
		this.#stopInputLockPulse();
		if (this.#inputLockFailsafe) {
			clearTimeout(this.#inputLockFailsafe);
			this.#inputLockFailsafe = null;
		}

		void invoke('unlock_game_input');
	}

	#shouldAnnounceChat(): boolean {
		return this.enabled && this.settings.announceInChat;
	}

	async #announceChatNow(): Promise<void> {
		if (this.#chatAnnounceInFlight) {
			return;
		}

		if (this.#recentlyAnnouncedChat()) {
			this.#awaitingChatAnnounce = false;
			this.#releaseInputLock();
			return;
		}

		if (!this.#shouldAnnounceChat()) {
			console.info('[ANTI-CHEAT]: skip chat announce, disabled in settings');
			this.#awaitingChatAnnounce = false;
			this.#releaseInputLock();
			return;
		}

		if (!app.game.isRunning) {
			console.info('[ANTI-CHEAT]: skip chat announce, game is not running');
			this.#awaitingChatAnnounce = false;
			this.#releaseInputLock();
			return;
		}

		console.info('[ANTI-CHEAT]: chat announce on Starting mission');
		this.#awaitingChatAnnounce = true;
		await invoke('unlock_game_input');
		if (app.game.isWindowFocused) {
			this.#startInputLockPulse();
		}

		await this.#announceChatWithRetry(Date.now() + CHAT_ANNOUNCE_RETRY_WINDOW_MS);
	}

	async #announceChatWithRetry(deadlineMs: number): Promise<void> {
		if (this.#chatAnnounceInFlight || this.#recentlyAnnouncedChat()) {
			return;
		}

		if (!app.game.isRunning || !this.#shouldAnnounceChat()) {
			return;
		}

		this.#chatAnnounceInFlight = true;
		this.#stopInputLockPulse();
		await shortcuts.suspendBindings();
		try {
			await invoke('send_game_chat', { message: CHAT_ANNOUNCE_MESSAGE });
			this.#chatAnnounced = true;
			this.#lastChatAnnounceAt = Date.now();
			this.#awaitingChatAnnounce = false;
			this.#releaseInputLock();
			console.info('[ANTI-CHEAT]: chat announce sent');
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			if (message.includes('not focused')) {
				this.#retryChatAnnounce('game is not focused', deadlineMs);
				return;
			}

			console.warn('[ANTI-CHEAT]: chat announce failed:', error);
			this.#awaitingChatAnnounce = false;
			this.#releaseInputLock();
		} finally {
			this.#chatAnnounceInFlight = false;
			shortcuts.resumeBindings();
		}
	}

	#retryChatAnnounce(reason: string, deadlineMs: number): void {
		if (!app.game.isRunning || !this.#shouldAnnounceChat() || Date.now() >= deadlineMs) {
			console.info('[ANTI-CHEAT]: skip chat announce,', reason);
			this.#awaitingChatAnnounce = false;
			this.#releaseInputLock();
			return;
		}

		if (this.#chatRetryTimer) {
			clearTimeout(this.#chatRetryTimer);
		}

		this.#chatRetryTimer = setTimeout(() => {
			this.#chatRetryTimer = null;
			void this.#announceChatWithRetry(deadlineMs);
		}, CHAT_ANNOUNCE_RETRY_MS);
	}

	async #captureWithRetry(attempts: number): Promise<void> {
		if (!this.#isLiveMatch()) {
			this.#stopSession();
			return;
		}

		if (!app.game.isWindowFocused) {
			console.info('[ANTI-CHEAT]: skip capture, game is not focused');
			this.#retryCapture(attempts);
			return;
		}

		await shortcuts.suspendBindings();
		try {
			const warningsLog = app.settings.companyOfHeroesConfigPath;
			const screenshotsDir = warningsLog
				? await join(await dirname(warningsLog), 'screenshots')
				: undefined;
			const capture = await invoke<GameWindowCapture>('capture_game_window', {
				screenshotsDir,
				keepScreenshot: dev
			});
			if (!this.#isLiveMatch()) {
				this.#stopSession();
				return;
			}

			await this.#uploadCapture(capture);
			console.info('[ANTI-CHEAT]: capture uploaded', {
				width: capture.width,
				height: capture.height
			});
		} catch (error) {
			console.warn('[ANTI-CHEAT]: capture failed:', error);
			this.#retryCapture(attempts);
		} finally {
			shortcuts.resumeBindings();
		}
	}

	#retryCapture(attempts: number): void {
		if (!this.#isLiveMatch() || attempts >= MAX_CAPTURE_RETRIES) {
			return;
		}

		this.#trackTimer(
			setTimeout(
				() => void this.#captureWithRetry(attempts + 1),
				randomInt(CAPTURE_RETRY_MIN_MS, CAPTURE_RETRY_MAX_MS)
			)
		);
	}

	async #uploadCapture(capture: GameWindowCapture): Promise<void> {
		if (!this.#isLiveMatch()) {
			return;
		}

		const session = this.#session;
		const userId = pocketbase.authStore.record?.id ?? account.userId;
		if (!session || !userId) {
			return;
		}

		await pocketbase.collection('anti_cheat_captures').create(
			{
				user: userId,
				session_id: session.sessionId || undefined,
				map: session.map,
				game_focused: app.game.isWindowFocused,
				captured_at: new Date().toISOString(),
				steam_id:
					account.user.steamIds?.find(Boolean) ||
					app.game.steamId ||
					app.game.profile?.steam.steamid ||
					undefined,
				image: base64ToJpegFile(capture.jpegBase64)
			},
			{ fetch }
		);
	}

	#scheduleProcessScan(): void {
		if (!this.#session) {
			return;
		}

		this.#processTimer = setTimeout(
			() => {
				void this.#scanProcesses();
			},
			randomInt(PROCESS_SCAN_MIN_MS, PROCESS_SCAN_MAX_MS)
		);
	}

	async #scanProcesses(): Promise<void> {
		if (!this.#isLiveMatch()) {
			this.#stopSession();
			return;
		}

		try {
			const names = this.#denylist
				.filter((item) => item.enabled !== false)
				.map((item) => item.name);
			if (names.length > 0) {
				const hits = await invoke<DenylistedProcess[]>('find_denylisted_processes', { names });
				for (const hit of hits) {
					await this.#reportHit(hit);
				}
			}
		} catch (error) {
			console.warn('[ANTI-CHEAT]: process scan failed:', error);
		}

		try {
			await this.#scanModules();
		} catch (error) {
			console.warn('[ANTI-CHEAT]: module scan failed:', error);
		}

		this.#scheduleProcessScan();
	}

	async #scanModules(): Promise<void> {
		const allowlist = this.#moduleAllowlist
			.filter((item) => item.enabled !== false)
			.map((item) => item.name);
		const gameRoot = app.settings.companyOfHeroesInstallationPath?.trim() || null;
		const hits = await invoke<UnknownGameModule[]>('find_unknown_game_modules', {
			processName: 'RelicCOH.exe',
			gameRoot,
			allowlist
		});
		for (const hit of hits) {
			await this.#reportModuleHit(hit);
		}
	}

	async #reportHit(hit: DenylistedProcess): Promise<void> {
		const session = this.#session;
		const userId = pocketbase.authStore.record?.id ?? account.userId;
		if (!session || !userId) {
			return;
		}

		const key = `${session.sessionId}:${hit.name.toLowerCase()}`;
		if (this.#reportedHits.has(key)) {
			return;
		}

		this.#reportedHits.add(key);

		try {
			await pocketbase.collection('anti_cheat_process_hits').create(
				{
					user: userId,
					session_id: session.sessionId,
					process_name: hit.name,
					pid: hit.pid,
					detected_at: new Date().toISOString()
				},
				{ fetch }
			);
		} catch (error) {
			this.#reportedHits.delete(key);
			console.warn('[ANTI-CHEAT]: process hit upload failed:', error);
		}
	}

	async #reportModuleHit(hit: UnknownGameModule): Promise<void> {
		const session = this.#session;
		const userId = pocketbase.authStore.record?.id ?? account.userId;
		if (!session || !userId) {
			return;
		}

		const key = `${session.sessionId}:${hit.path.toLowerCase()}`;
		if (this.#reportedModuleHits.has(key)) {
			return;
		}

		this.#reportedModuleHits.add(key);

		try {
			await pocketbase.collection('anti_cheat_module_hits').create(
				{
					user: userId,
					session_id: session.sessionId,
					module_name: hit.name,
					module_path: hit.path,
					pid: hit.pid,
					detected_at: new Date().toISOString()
				},
				{ fetch }
			);
		} catch (error) {
			this.#reportedModuleHits.delete(key);
			console.warn('[ANTI-CHEAT]: module hit upload failed:', error);
		}
	}

	async #refreshDenylist(): Promise<void> {
		try {
			this.#denylist = await pocketbase
				.collection('anti_cheat_process_denylist')
				.getFullList<AntiCheatProcessDenylistResponse>({ fetch });
		} catch (error) {
			console.warn('[ANTI-CHEAT]: denylist fetch failed:', error);
			this.#denylist = [];
		}
	}

	async #refreshModuleAllowlist(): Promise<void> {
		try {
			this.#moduleAllowlist = await pocketbase
				.collection('anti_cheat_module_allowlist')
				.getFullList<AntiCheatModuleAllowlistResponse>({ fetch });
		} catch (error) {
			console.warn('[ANTI-CHEAT]: module allowlist fetch failed:', error);
			this.#moduleAllowlist = [];
		}
	}
}

export const antiCheat = new AntiCheat();
