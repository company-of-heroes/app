import Emittery from 'emittery';
import { isEmpty } from 'lodash-es';
import { LogTailer } from './tailer';
import { parseLogLine } from './parser';
import { LogSession, type SessionDeps, type SessionEvents } from './session';
import type { Lobby } from '../lobby';

export type GameLogEvents = {
	ready: undefined;
} & SessionEvents;

/**
 * Watches and interprets the Company of Heroes warnings.log.
 *
 * Composition of:
 * - LogTailer: efficient appended-bytes polling with truncation detection
 * - parseLogLine: pure line -> trigger event mapping
 * - LogSession: lobby state machine emitting domain events
 *
 * Readiness contract (identical to the previous implementation): when the
 * watcher starts on an existing log, all historical lines are replayed first
 * (consumers ignore events while not ready), then `ready` fires. If a lobby
 * is still active, `lobby.started` or `lobby.joined` is re-emitted once so
 * opening the app mid-game still shows the current match. Finished matches
 * (game over already in the log) are not re-emitted. App-level publish
 * keys guarantee `game.lobby.joined` / `game.lobby.started` fire once per match.
 */
export class GameLogService extends Emittery<GameLogEvents> {
	isReady = $state(false);

	readonly session: LogSession;

	#tailer: LogTailer;

	constructor(deps: SessionDeps) {
		super();

		this.session = new LogSession(deps);

		// Re-emit session events one-to-one, awaited so historical replay
		// finishes before `ready` / catch-up events.
		this.session.onAny(async (name, data) => {
			await this.emitSerial(name as keyof SessionEvents, data as never);
		});

		this.#tailer = new LogTailer({
			intervalMs: 50,
			onLines: async (lines) => {
				for (const line of lines) {
					const event = parseLogLine(line);

					if (!event) {
						continue;
					}

					try {
						await this.session.handle(event);
					} catch (error) {
						console.error(`[LOG]: Error handling ${event.type} for line "${line}":`, error);
					}
				}
			},
			onTruncated: () => {
				console.info('[LOG]: warnings.log truncated (game restarted), resetting session');
				this.session.reset();
			},
			onTick: () => this.#markReady(),
			onError: (error) => {
				console.error('[LOG]: Error reading log file:', error);
			}
		});
	}

	get lobby(): Lobby | undefined {
		return this.session.lobby;
	}

	start(path: string): void {
		if (isEmpty(path)) {
			return;
		}

		const resume = path === this.#tailer.path && this.#tailer.offset > 0;

		if (resume) {
			this.#tailer.start(path);
			return;
		}

		this.stop();
		this.#tailer.start(path);
	}

	/** Pauses polling without discarding the read offset or session state. */
	pause(): void {
		this.#tailer.pause();
		this.isReady = false;
	}

	/**
	 * Reads any appended log lines once so a late Game Stop is handled before stop.
	 */
	async flush(): Promise<void> {
		if (!this.#tailer.path) {
			return;
		}

		await this.#tailer.poll();
	}

	stop(): void {
		this.#tailer.stop();
		this.session.reset();
		this.isReady = false;
	}

	#markReady(): void {
		if (this.isReady) {
			return;
		}

		this.isReady = true;

		void this.emitSerial('ready').then(() => {
			const lobby = this.session.lobby;

			if (!lobby) {
				return;
			}

			// Opened mid-match: replay was ignored while not ready, so surface
			// the active lobby once. Skip finished matches so fair-play captures
			// do not start against the main menu.
			if (lobby.ended) {
				return;
			}

			if (lobby.started) {
				void this.emitSerial('lobby.started', lobby);
				return;
			}

			void this.emitSerial('lobby.joined', lobby);
		});
	}
}
