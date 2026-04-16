import type { CoHMaps, RelicProfile } from '@fknoobs/app';
import type { SteamPlayerSummary } from '$core/steam';
import Emittery, { type DatalessEventNames } from 'emittery';
import { steam } from '$core/steam';
import { relic } from '$lib/relic';
import { inferTypes } from '$lib/utils';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { isEmpty } from 'lodash-es';
import { char, createRegExp, digit, exactly, oneOrMore, whitespace, word } from 'magic-regexp';
import { watch } from 'runed';
import { Lobby } from '$core/app/context';

export type LogParserEvents = {
	'LOG:STARTED': undefined;
	'LOG:ENDED': undefined;
	'LOG:FOUND:PROFILE': { steamId: string };
	'LOG:LOBBY:JOINED': undefined;
	'LOG:LOBBY:POPULATING': { startedAt: string; isRanked: string };
	'LOG:LOBBY:POPULATING:MAP': { map: CoHMaps };
	'LOG:LOBBY:POPULATING:PLAYER': {
		index: number;
		playerId: number;
		type: number;
		team: number;
		race: number;
	};
	'LOG:LOBBY:POPULATING:PLAYER:COUNT': { count: number };
	'LOG:LOBBY:POPULATING:PLAYER:STEAM': { steamId: string; slot: number; ranking: number };
	'LOG:LOBBY:POPULATING:MATCH:TYPE': { type: number };
	'LOG:LOBBY:POPULATING:COMPLETE': undefined;
	'LOG:LOBBY:PLAYER:RESULT': { playerId: number; result: 'PS_WON' | 'PS_KILLED' };
	'LOG:LOBBY:SESSIONID': { sessionId: number };
	'LOG:LOBBY:GAMEOVER': undefined;
	'LOG:LOBBY:DESTROYED': undefined;
	'LOG:LOBBY:STARTED': undefined;
	ISREADY: undefined;
};

export type LogDomainEvents = {
	'log.authenticated': {
		steamId: string;
		relicProfile: RelicProfile;
		steamProfile: SteamPlayerSummary;
	};
	'log.logout': undefined;
	'log.lobby.joined': Lobby;
	'log.lobby.started': Lobby;
	'log.lobby.gameover': Lobby;
	'log.lobby.destroyed': Lobby;
	'log.lobby.result': {
		playerId: number;
		result: 'PS_WON' | 'PS_KILLED';
	};
	'log.ready': undefined;
};

export class Log extends Emittery<LogParserEvents & LogDomainEvents> {
	private path = $state<string>('');
	private lines: string[] = [];
	private oldLength = 0;
	private newLength = 0;
	private interval: number | null = null;

	public isReady = $state<boolean>(false);

	// Internal state
	private lobby: Lobby | undefined;
	private sessionId: number | null = null;

	constructor() {
		super();
		this.setupListeners();
	}

	private setupListeners() {
		this.on('LOG:FOUND:PROFILE', this.handleFoundProfile.bind(this));
		this.on('LOG:LOBBY:POPULATING', this.handleLobbyPopulating.bind(this));
		this.on('LOG:LOBBY:POPULATING:PLAYER', this.handleLobbyPlayer.bind(this));
		this.on('LOG:LOBBY:POPULATING:PLAYER:STEAM', this.handleLobbyPlayerSteam.bind(this));
		this.on('LOG:LOBBY:POPULATING:MAP', this.handleLobbyMap.bind(this));
		this.on('LOG:LOBBY:STARTED', this.handleLobbyStarted.bind(this));
		this.on('LOG:LOBBY:SESSIONID', this.handleLobbySessionId.bind(this));
		this.on('LOG:LOBBY:PLAYER:RESULT', this.handleLobbyPlayerResult.bind(this));
		this.on('LOG:LOBBY:GAMEOVER', this.handleLobbyGameOver.bind(this));
		this.on('LOG:LOBBY:DESTROYED', this.handleLobbyDestroyed.bind(this));
		this.on('LOG:ENDED', this.handleLogEnded.bind(this));
	}

	start(path: string) {
		this.path = path;

		if (isEmpty(this.path)) {
			return;
		}

		this.reset();
		this.createWatcher();

		watch(
			() => this.isReady,
			(isReady) => {
				if (isReady) this.emit('ISREADY');
			}
		);
	}

	private reset() {
		if (this.interval) clearInterval(this.interval);
		this.isReady = false;
		this.oldLength = 0;
		this.newLength = 0;
		this.lines = [];
	}

	private createWatcher() {
		this.interval = window.setInterval(async () => {
			try {
				const contents = await readTextFile(this.path);
				const lines = contents.split(/\r\n|\r|\n/).filter((line) => line.trim() !== '');

				this.oldLength = this.newLength;
				this.newLength = lines.length;

				if (this.newLength <= this.oldLength) return;

				this.lines = lines.slice(this.oldLength);

				for (const line of this.lines) {
					await this.processLine(line);
				}

				if (!this.isReady) {
					this.isReady = true;
					await this.emitSerial('log.ready');

                    /**
                     * This can happen we we open de app while already in a lobby.
                     * Before the app would not display data until the next game.
                     */
                    if (this.lobby) {
                        this.emit('log.lobby.started', this.lobby);
                    }
				}
			} catch (error) {
				console.error('Error reading log file:', error);
			}
		}, 500);
	}

	private async processLine(line: string): Promise<void> {
		for (const [trigger, regex] of Object.entries(triggers)) {
			const match = line.match(regex);

			if (match) {
				const data = match.groups ? inferTypes({ ...match.groups }, ['steamId']) : undefined;

				try {
					if (data) {
						await this.emitSerial(trigger as keyof LogParserEvents, data as any);
					} else {
						await this.emitSerial(trigger as DatalessEventNames<LogParserEvents>);
					}
				} catch (error) {
					console.error(`Error processing event ${trigger} for line "${line}":`, error);
				}
				break;
			}
		}
	}

	// Handlers

	private async handleFoundProfile({ steamId }: LogParserEvents['LOG:FOUND:PROFILE']) {
		const [relicProfile, steamProfile] = await Promise.all([
			relic.getProfileBySteamId(steamId),
			steam.getUserProfile(steamId.toString())
		]);

		if (relicProfile && steamProfile) {
			await this.emitSerial('log.authenticated', { steamId, relicProfile, steamProfile });
		}
	}

	private handleLobbyPopulating({ isRanked, startedAt }: LogParserEvents['LOG:LOBBY:POPULATING']) {
		this.lobby = new Lobby(startedAt.trim(), isRanked === 'AutoMatchForm');
		this.emitSerial('log.lobby.joined', this.lobby);
	}

	private handleLobbyPlayer(data: LogParserEvents['LOG:LOBBY:POPULATING:PLAYER']) {
		this.lobby?.addPlayer({
			index: data.index,
			playerId: data.playerId,
			type: data.type,
			race: data.race,
			team: data.team
		});
	}

	private handleLobbyPlayerSteam({
		ranking,
		slot,
		steamId
	}: LogParserEvents['LOG:LOBBY:POPULATING:PLAYER:STEAM']) {
		const player = this.lobby?.getPlayerBySlot(slot);
		if (player) {
			player.steamId = steamId.toString();
			player.ranking = ranking;
			player.slot = slot;
		}
	}

	private handleLobbyMap({ map }: LogParserEvents['LOG:LOBBY:POPULATING:MAP']) {
		if (this.lobby) {
			this.lobby.map = map;
		}
	}

	private async handleLobbyStarted() {
		if (!this.lobby) return;

		const profileIds = this.lobby.getPlayerIds();
		if (profileIds.length === 0) return;

		const profiles = await relic.getProfileByIds(profileIds);

		this.lobby.players.forEach((player) => {
			player.profile = profiles.find((profile) => profile.profile_id === player.playerId);
		});

		this.lobby.sessionId = this.sessionId;
		this.lobby.started = true;

		await this.emitSerial('log.lobby.started', this.lobby);
	}

	private handleLobbySessionId({ sessionId }: LogParserEvents['LOG:LOBBY:SESSIONID']) {
		this.sessionId = sessionId;
	}

	private async handleLobbyPlayerResult({
		playerId,
		result
	}: LogParserEvents['LOG:LOBBY:PLAYER:RESULT']) {
		await this.emitSerial('log.lobby.result', { playerId, result });
	}

	private async handleLobbyGameOver() {
		if (this.lobby) {
			await this.emitSerial('log.lobby.gameover', this.lobby);
		}
	}

	private async handleLobbyDestroyed() {
		if (this.lobby) {
			await this.emitSerial('log.lobby.destroyed', this.lobby);
		}
		this.lobby = undefined;
		this.sessionId = null;
	}

	private async handleLogEnded() {
		await this.emitSerial('log.logout');
	}
}

export const log = new Log();

export const triggers: Record<keyof Omit<LogParserEvents, 'ISREADY'>, RegExp> = {
	'LOG:STARTED': createRegExp(exactly('RELICCOH started')),
	'LOG:ENDED': createRegExp(exactly('Application closed without errors')),
	'LOG:FOUND:PROFILE': createRegExp(oneOrMore(digit).after('Found profile: /steam/').as('steamId')),
	'LOG:LOBBY:JOINED': createRegExp(exactly('RLINK -- JoinAsync: AsyncJob Complete')),
	'LOG:LOBBY:POPULATING': createRegExp(
		oneOrMore(char)
			.groupedAs('startedAt')
			.and(oneOrMore(whitespace))
			.and(
				exactly('AutoMatchForm')
					.or(exactly('GameSetupForm'))
					.groupedAs('isRanked')
					.and(exactly(' - Starting game'))
			)
	),
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
		exactly(word).groupedAs('result')
	),
	'LOG:LOBBY:SESSIONID': createRegExp(
		exactly('Created Matchinfo for sessionID ', oneOrMore(digit).groupedAs('sessionId'))
	),
	'LOG:LOBBY:STARTED': createRegExp(exactly('GAME -- Starting mission')),
	'LOG:LOBBY:GAMEOVER': createRegExp(exactly('GameObj::DoGameOverPopup')),
	'LOG:LOBBY:DESTROYED': createRegExp(exactly('APP -- Game Stop'))
};
