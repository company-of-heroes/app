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
 * (consumers ignore events while not ready), then `ready` fires, and when a
 * lobby is currently active `lobby.started` is re-emitted so opening the app
 * mid-game still shows the current match.
 */
export class GameLogService extends Emittery<GameLogEvents> {
	isReady = $state(false);

	readonly session: LogSession;

	#tailer: LogTailer;

	constructor(deps: SessionDeps) {
		super();

		this.session = new LogSession(deps);

		// Re-emit session events one-to-one.
		this.session.onAny((name, data) => {
			void this.emitSerial(name as keyof SessionEvents, data as never);
		});

		this.#tailer = new LogTailer({
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

		this.stop();
		this.#tailer.start(path);
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
			// Opened mid-game: surface the active lobby immediately.
			if (this.session.lobby) {
				void this.emitSerial('lobby.started', this.session.lobby);
			}
		});
	}
}
