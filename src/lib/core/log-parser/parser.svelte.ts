import type { CoHMaps } from '@fknoobs/app';
import emittery, { type DatalessEventNames } from 'emittery';
import { createRegExp, digit, exactly, oneOrMore, char, whitespace, word } from 'magic-regexp';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { watch as track, watchOnce as trackOnce } from 'runed';
import { inferTypes } from '$lib/utils';
import { app } from '$core/app';
import { Lobby } from '$core/company-of-heroes';
import { relic } from '$lib/relic';
import { isEmpty } from 'lodash-es';

let lobby: Lobby | undefined;
let matchType: number = 0;

export class Log extends emittery<LogEvents> {
	private lines: string[] = [];

	private oldLength = 0;

	private newLength = 0;

	private interval: number | null = null;

	private isReady: boolean | undefined = $state(undefined);

	constructor() {
		super();

		this.onAny(async (event, data) => {
			switch (event) {
				case 'LOG:FOUND:PROFILE': {
					const { steamId } = data as LogEvents[typeof event];
					const profile = await relic.getProfileBySteamId(steamId);

					if (!profile) {
						return;
					}

					app.game.isRunning = true;
					app.game.steamId = steamId.toString();
					app.game.profile = profile;

					app.game.emit('GAME:LAUNCHED');

					break;
				}

				case 'LOG:LOBBY:POPULATING': {
					lobby = new Lobby('', [], 0);

					break;
				}

				case 'LOG:LOBBY:POPULATING:PLAYER': {
					const { index, playerId, type, race, team } = data as LogEvents[typeof event];

					lobby?.addPlayer({
						index,
						playerId,
						type,
						race,
						team
					});

					break;
				}

				case 'LOG:LOBBY:POPULATING:PLAYER:STEAM': {
					const { ranking, slot, steamId } = data as LogEvents[typeof event];
					const player = lobby?.getPlayerBySlot(slot);

					if (!player) {
						break;
					}

					player.steamId = steamId.toString();
					player.ranking = ranking;

					break;
				}

				case 'LOG:LOBBY:POPULATING:MATCH:TYPE': {
					const { type } = data as LogEvents[typeof event];
					matchType = type;

					break;
				}

				case 'LOG:LOBBY:POPULATING:MAP': {
					const { map } = data as LogEvents[typeof event];

					if (lobby) {
						lobby.map = map;
					}

					break;
				}

				case 'LOG:LOBBY:STARTED': {
					if (lobby) {
						const profileIds = lobby.getPlayerIds();

						if (profileIds.length === 0) {
							return;
						}

						const profiles = await relic.getProfileByIds(profileIds);

						lobby.players.forEach((player) => {
							player.profile = profiles.find((profile) => profile.profile_id === player.playerId);
						});

						lobby.matchType = matchType;
						app.game.lobby = lobby;
						app.game.isIngame = true;
						app.game.emit('LOBBY:STARTED', lobby);
					}

					break;
				}

				case 'LOG:LOBBY:SESSIONID': {
					const { sessionId } = data as LogEvents[typeof event];

					if (lobby) {
						lobby.sessionId = sessionId;
					}

					break;
				}

				case 'LOG:LOBBY:PLAYER:RESULT': {
					if (!app.game.profile || !lobby) {
						return;
					}

					const { playerId, result } = data as LogEvents[typeof event];
					const player = lobby?.getPlayerById(app.game.profile.profile_id);

					if (!player) {
						return;
					}

					if (player.playerId === playerId) {
						lobby.outcome = result;
					}

					break;
				}

				case 'LOG:LOBBY:GAMEOVER': {
					app.game.isIngame = false;
					app.game.emit('LOBBY:GAMEOVER');

					matchType = 0;

					break;
				}

				case 'LOG:LOBBY:DESTROYED': {
					if (lobby) {
						app.game.playedLobbies.push(lobby);
					}

					app.game.emit('LOBBY:DESTROYED');

					app.game.lobby = undefined;
					lobby = undefined;
					matchType = 0;

					break;
				}

				// case 'LOG:ENDED': {
				// 	app.game.isRunning = false;

				// 	app.game.emit('GAME:CLOSED');

				// 	break;
				// }
			}
		});
	}

	start() {
		if (!app.settings.companyOfHeroesConfigPath) {
			app.toast.error('Company of Heroes config path is not set in settings.');
			return;
		}

		$effect.root(() => {
			$effect(() => {
				track(
					() => app.settings.companyOfHeroesConfigPath,
					() => {
						if (isEmpty(app.settings.companyOfHeroesConfigPath)) {
							return;
						}

						if (this.interval) {
							clearInterval(this.interval);
						}

						this.oldLength = 0;
						this.newLength = 0;

						app.game.reset();
						this.createWatcher();
					}
				);
				trackOnce(
					() => this.isReady,
					() => this.emit('ISREADY') as never
				);
			});
		});
	}

	private async createWatcher() {
		this.interval = window.setInterval(async () => {
			const contents = await readTextFile(app.settings.companyOfHeroesConfigPath + '/warnings.log');
			const lines = contents.split(/\r\n|\r|\n/).filter((line) => line.trim() !== '');

			this.oldLength = this.newLength;
			this.newLength = lines.length;

			if (this.newLength <= this.oldLength) {
				return;
			}

			this.lines = lines.slice(this.oldLength);

			for (const line of this.lines) {
				await this.processLine(line);
			}

			if (this.isReady === undefined) {
				this.isReady = true;
			}
		}, 500);
	}

	private async processLine(line: string): Promise<void> {
		for (const [trigger, regex] of Object.entries(triggers)) {
			const match = line.match(regex);

			if (match) {
				const data = match.groups ? inferTypes({ ...match.groups }) : undefined;

				try {
					if (data) {
						await this.emitSerial(trigger as keyof LogEvents, data as LogEvents[keyof LogEvents]);
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

export const log = new Log();

export type LogEvents = {
	'LOG:STARTED': undefined;
	'LOG:ENDED': undefined;
	'LOG:FOUND:PROFILE': { steamId: bigint };
	'LOG:LOBBY:JOINED': undefined;
	'LOG:LOBBY:POPULATING': undefined;
	'LOG:LOBBY:POPULATING:MAP': { map: CoHMaps };
	'LOG:LOBBY:POPULATING:PLAYER': {
		index: number;
		playerId: number;
		type: number;
		team: number;
		race: number;
	};
	'LOG:LOBBY:POPULATING:PLAYER:COUNT': { count: number };
	'LOG:LOBBY:POPULATING:PLAYER:STEAM': { steamId: bigint; slot: number; ranking: number };
	'LOG:LOBBY:POPULATING:MATCH:TYPE': { type: number };
	'LOG:LOBBY:POPULATING:COMPLETE': undefined;
	'LOG:LOBBY:PLAYER:RESULT': { playerId: number; result: 'PS_WON' | 'PS_KILLED' };
	'LOG:LOBBY:SESSIONID': { sessionId: number };
	'LOG:LOBBY:GAMEOVER': undefined;
	'LOG:LOBBY:DESTROYED': undefined;
	'LOG:LOBBY:STARTED': undefined;
	ISREADY: undefined;
};

/**
 * Regular expressions used to parse log lines and trigger corresponding events.
 * The keys match the event names defined in LogEventData.
 * Named capture groups in the regex should correspond to the properties in the LogEventData payload objects.
 */
export const triggers: Record<keyof Omit<LogEvents, 'ISREADY'>, RegExp> = {
	'LOG:STARTED': createRegExp(exactly('RELICCOH started')),
	'LOG:ENDED': createRegExp(exactly('Application closed without errors')),
	'LOG:FOUND:PROFILE': createRegExp(
		oneOrMore(digit).after('Found 1 profiles for account /steam/').as('steamId')
	),
	'LOG:LOBBY:JOINED': createRegExp(exactly('RLINK -- JoinAsync: AsyncJob Complete')),
	'LOG:LOBBY:POPULATING': createRegExp(exactly('Form - Starting game')),
	'LOG:LOBBY:POPULATING:MAP': createRegExp(
		exactly('GAME -- *** Beginning mission ').and(oneOrMore(char).before(' (').groupedAs('map'))
	),
	'LOG:LOBBY:POPULATING:PLAYER': createRegExp(
		oneOrMore(digit)
			.after('PopulateGameInfoInternal - Player #')
			.groupedAs('index')
			.and(oneOrMore(char))
			.and(oneOrMore(digit).or('-1').after('Id ').groupedAs('playerId'))
			.and(oneOrMore(char))
			.and(oneOrMore(digit).after('Type ').groupedAs('type'))
			.and(oneOrMore(char))
			.and(oneOrMore(digit).after('Team ').groupedAs('team'))
			.and(oneOrMore(char))
			.and(oneOrMore(digit).after('Race ').groupedAs('race'))
	),
	'LOG:LOBBY:POPULATING:PLAYER:COUNT': createRegExp(
		oneOrMore(digit).after('GetMaxFrameTimeFromProfile: players=').groupedAs('count')
	),
	'LOG:LOBBY:POPULATING:PLAYER:STEAM': createRegExp(
		exactly('/steam/')
			.and(oneOrMore(digit).groupedAs('steamId'))
			.and(oneOrMore(char))
			.and(digit.after('slot =  ').groupedAs('slot'))
			.and(oneOrMore(char))
			.and(
				exactly('ranking = '),
				oneOrMore(whitespace),
				oneOrMore(digit).or('-1').groupedAs('ranking')
			)
	),
	'LOG:LOBBY:POPULATING:MATCH:TYPE': createRegExp(
		exactly(
			'RLINK -- GetRequestInfoBySearchID - matchType ',
			oneOrMore(digit).groupedAs('type')
		).or(exactly('Setting match type to ', oneOrMore(digit).groupedAs('type')))
	),
	'LOG:LOBBY:POPULATING:COMPLETE': createRegExp(exactly('GAME -- *** Beginning mission')),
	'LOG:LOBBY:PLAYER:RESULT': createRegExp(
		exactly('ReportMatchResults - '),
		exactly(word, ':', oneOrMore(digit), ', ').times(3),
		exactly('uid:', oneOrMore(digit), ':'),
		oneOrMore(digit).groupedAs('playerId'),
		exactly(', ', 'result:', oneOrMore(digit), ':'),
		exactly(word).groupedAs('result') // Captures 'PS_WON' or 'PS_KILLED'
	),
	'LOG:LOBBY:SESSIONID': createRegExp(
		exactly(
			'ReportMatchResults - reporting normal game results for match ',
			oneOrMore(digit),
			exactly(':'),
			oneOrMore(digit).groupedAs('sessionId')
		)
	),
	'LOG:LOBBY:STARTED': createRegExp(exactly('GAME -- Starting mission')),
	'LOG:LOBBY:GAMEOVER': createRegExp(exactly('GameObj::DoGameOverPopup')),
	'LOG:LOBBY:DESTROYED': createRegExp(exactly('APP -- Game Stop'))
};

/**
 * Add a new trigger, if it already exists the existing one will be overwritten
 *
 * @param name
 * @param matcher
 */
export function addEvent(name: keyof Omit<LogEvents, 'ISREADY'>, matcher: RegExp) {
	triggers[name] = matcher;
}
