import { RelicClient } from '../relic';
import { Game } from './game';
import { Lobby } from './lobby';
import { triggers, type LogEvents } from './triggers';
import { inferTypes } from './utils';
import { Watcher } from './watcher';
import emittery, { type DatalessEventNames } from 'emittery';

export class CoH extends emittery<LogEvents> {
	/**
	 * The watcher instance that monitors the warnings.log file.
	 *
	 * @type {Watcher}
	 * @readonly
	 */
	readonly watcher: Watcher;

	/**
	 * The game instance that represents the current state of the game.
	 *
	 * @type {Game}
	 * @readonly
	 */
	readonly game: Game;

	/**
	 * The relic client instance that interacts with the Relic API.
	 *
	 * @type {RelicClient}
	 * @readonly
	 */
	readonly relic: RelicClient;

	/**
	 * A promise to chain processing tasks sequentially.
	 *
	 * @type {Promise<void>}
	 * @private
	 */
	private processingPromise: Promise<void> = Promise.resolve();

	/**
	 * Parser constructor
	 *
	 * @param path Path to the warnings.log file
	 */
	constructor(path: string) {
		super();

		this.watcher = new Watcher(path);
		this.game = new Game();
		this.relic = new RelicClient();

		this.onAny(async (event, data) => {
			switch (event) {
				case 'LOG:FOUND:PROFILE': {
					const { steamId } = data as LogEvents['LOG:FOUND:PROFILE'];
					const profile = await this.relic.getProfileBySteamId(steamId);

					if (!profile) {
						console.error(`Profile not found for steamId: ${steamId}`);
						return;
					}

					this.game.setProfile(profile);
					this.game.setIsRunning(true);
					this.game.setSteamId(steamId);
					this.game.emit('GAME:LAUNCHED', this.game);
					break;
				}

				case 'LOG:LOBBY:POPULATING': {
					this.game.setLobby(new Lobby());
					break;
				}

				case 'LOG:LOBBY:POPULATING:MATCH:TYPE': {
					const { type } = data as LogEvents['LOG:LOBBY:POPULATING:MATCH:TYPE'];
					const lobby = this.game.getLobby();

					lobby.setMatchType(type);
					break;
				}

				case 'LOG:LOBBY:POPULATING:PLAYER': {
					const { index, playerId, type, team, race } =
						data as LogEvents['LOG:LOBBY:POPULATING:PLAYER'];
					const lobby = this.game.getLobby();
					if (lobby) {
						lobby.addPlayer({
							index,
							playerId,
							type,
							team,
							race
						});
					} else {
						console.error('Attempted to add player before lobby was created.');
					}
					break;
				}

				case 'LOG:LOBBY:POPULATING:PLAYER:STEAM': {
					const { steamId, slot, ranking } = data as LogEvents['LOG:LOBBY:POPULATING:PLAYER:STEAM'];
					const lobby = this.game.getLobby();
					const player = lobby.getPlayerBySlot(slot);

					if (player) {
						player.ranking = ranking;
						player.steamId = steamId.toString();
					}

					break;
				}

				case 'LOG:LOBBY:POPULATING:MAP': {
					const { map } = data as LogEvents['LOG:LOBBY:POPULATING:MAP'];
					const lobby = this.game.getLobby();
					if (lobby) {
						lobby.setMap(map);
					} else {
						console.error('Attempted to set map before lobby was created.');
					}
					break;
				}

				case 'LOG:LOBBY:STARTED': {
					const lobby = this.game.getLobby();
					if (!lobby) {
						console.error('Attempted to start lobby before it was created.');
						return;
					}

					const profileIds = lobby.getPlayerIds();
					if (profileIds.length === 0) {
						return;
					}

					const profiles = await this.relic.getProfileByIds(profileIds);

					lobby.getPlayers().forEach((player) => {
						const profile = profiles.find((p) => p.profile_id === player.playerId);
						if (profile) {
							player.profile = profile;
						}
					});

					lobby.setIsStarted(true);
					this.game.emit('LOBBY:STARTED', lobby);
					break;
				}

				case 'LOG:LOBBY:PLAYER:RESULT': {
					const { playerId, result } = data as LogEvents['LOG:LOBBY:PLAYER:RESULT'];
					const lobby = this.game.getLobby();
					if (!lobby || !this.game.getProfileProperty('profile_id')) {
						console.error('Attempted to process result before lobby/profile was ready.');
						return;
					}

					const currentPlayer = lobby
						.getPlayers()
						.find((p) => p.playerId === this.game.getProfileProperty('profile_id'));

					if (currentPlayer?.playerId === playerId) {
						lobby.setOutcome(result);
					}
					break;
				}

				case 'LOG:LOBBY:GAMEOVER': {
					const lobby = this.game.getLobby();
					if (lobby) {
						this.game.emit('LOBBY:GAMEOVER', lobby);
					} else {
						console.error('Attempted to end lobby before it was created.');
					}
					break;
				}

				case 'LOG:LOBBY:SESSIONID': {
					const { sessionId } = data as LogEvents['LOG:LOBBY:SESSIONID'];
					const lobby = this.game.getLobby();

					if (lobby) {
						lobby.setSessionId(sessionId);
					} else {
						console.error('Attempted to set session ID before lobby was created.');
					}

					break;
				}

				case 'LOG:LOBBY:DESTROYED': {
					this.game.emit('LOBBY:DESTROYED');
					break;
				}

				case 'LOG:ENDED': {
					this.game.setIsRunning(false);
					this.game.emit('GAME:CLOSED');
				}
			}
		});
	}

	/**
	 * Processes a single log line sequentially. Finds the trigger,
	 * infers data, and emits the event using emitSerial, waiting for
	 * the onAny handler to complete.
	 *
	 * @param line The log line string to process.
	 */
	private async processLine(line: string): Promise<void> {
		let trigger: keyof LogEvents;

		for (trigger in triggers) {
			if (Object.prototype.hasOwnProperty.call(triggers, trigger)) {
				const regex = triggers[trigger];
				const match = line.match(regex);

				if (match) {
					let data = match.groups ? inferTypes({ ...match.groups }) : undefined;

					try {
						if (data) {
							await this.emitSerial(trigger, data as LogEvents[typeof trigger]);
						} else {
							await this.emitSerial(trigger as DatalessEventNames<LogEvents>);
						}
					} catch (error) {
						console.error(`Error processing event ${trigger} for line "${line}":`, error);
					}

					break;
				}
			}
		}
	}

	/**
	 * Starts the file watcher and sets up event listeners for log lines.
	 * Ensures that log lines are processed sequentially.
	 */
	start() {
		this.watcher.start();

		this.watcher.on('log:line', (line) => {
			this.processingPromise = this.processingPromise
				.then(() => this.processLine(line))
				.catch((err) => {
					console.error('Error in processing chain:', err);
				});
		});

		this.watcher.on('error', (err) => {
			console.error(`Error reading file ${this.watcher.path}:`, err);
			this.processingPromise = this.processingPromise.then(() => {
				console.error('Stopping watcher due to error.');
				this.watcher.stop();
			});
		});
	}

	/**
	 * Stops the file watcher and cleans up resources associated with this Game instance.
	 */
	destroy() {
		this.processingPromise.finally(() => {
			this.watcher.stop();
			this.clearListeners();
			console.log('CoH instance destroyed.');
		});
	}
}
