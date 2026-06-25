import { describe, expect, it, vi } from 'vitest';
import { LogSession, type SessionDeps } from './session';
import { parseLogLine } from './parser';
import type { Lobby } from '../lobby';
import fixture from '../../../../tests/fixtures/warnings/ranked-1v1.log?raw';

const PROFILES = [
	{ profile_id: 8666, name: '/steam/76561198000000001', alias: 'LocalHero' },
	{ profile_id: 9777, name: '/steam/76561198000000002', alias: 'Opponent' }
];

function makeDeps(overrides: Partial<SessionDeps> = {}): SessionDeps {
	return {
		getProfileBySteamId: vi.fn(async (steamId: string) =>
			PROFILES.find((p) => p.name.endsWith(steamId))
		),
		getSteamProfile: vi.fn(async () => ({ personaname: 'LocalHero' })),
		getProfileByIds: vi.fn(async (ids: number[]) =>
			PROFILES.filter((p) => ids.includes(p.profile_id))
		),
		...overrides
	};
}

async function replay(session: LogSession, content: string) {
	for (const line of content.split(/\r?\n/)) {
		if (line.trim() === '') continue;

		const event = parseLogLine(line);

		if (event) {
			await session.handle(event);
		}
	}
}

describe('LogSession', () => {
	it('replays a full ranked 1v1 and emits the domain event sequence', async () => {
		const session = new LogSession(makeDeps());
		const events: string[] = [];
		let startedLobby: Lobby | undefined;
		let destroyedLobby: Lobby | undefined;
		let result: { playerId: number; result: string } | undefined;

		session.onAny((name, data) => {
			events.push(name as string);

			if (name === 'lobby.started') startedLobby = data as Lobby;
			if (name === 'lobby.destroyed') destroyedLobby = data as Lobby;
			if (name === 'lobby.result') result = data as typeof result;
		});

		await replay(session, fixture);

		expect(events).toEqual([
			'authenticated',
			'lobby.joined',
			'lobby.started',
			'lobby.gameover',
			'lobby.result',
			'lobby.destroyed',
			'logout'
		]);

		expect(startedLobby).toBeDefined();
		expect(startedLobby!.sessionId).toBe(987654);
		expect(startedLobby!.isRanked).toBe(true);
		expect(startedLobby!.map).toBe('2p_semois');
		expect(startedLobby!.started).toBe(true);
		expect(startedLobby!.players).toHaveLength(2);

		// Profiles resolved and attached
		expect(startedLobby!.players[0].profile?.alias).toBe('LocalHero');
		expect(startedLobby!.players[1].profile?.alias).toBe('Opponent');

		// Steam slots assigned
		expect(startedLobby!.players[0].steamId).toBe('76561198000000001');
		expect(startedLobby!.players[0].ranking).toBe(25);
		expect(startedLobby!.players[1].ranking).toBe(-1);

		// Local player resolution via injected steam id
		expect(startedLobby!.me?.playerId).toBe(8666);

		// Match meta
		expect(startedLobby!.matchType).toBe(1);
		expect(startedLobby!.type).toBe('1 VS. 1');
		expect(startedLobby!.mapName).toBe('Semois (2)');

		expect(result).toEqual({ playerId: 8666, result: 'PS_WON' });
		expect(destroyedLobby).toBeDefined();

		// Session cleaned up after destroy
		expect(session.lobby).toBeUndefined();
		expect(session.sessionId).toBeNull();
	});

	it('does not emit authenticated when profiles cannot be resolved', async () => {
		const session = new LogSession(
			makeDeps({ getProfileBySteamId: vi.fn(async () => null) })
		);
		const authenticated = vi.fn();

		session.on('authenticated', authenticated);

		await session.handle(parseLogLine('RLINK -- Found profile: /steam/76561198000000001')!);

		expect(authenticated).not.toHaveBeenCalled();
	});

	it('survives profile lookup network errors', async () => {
		const session = new LogSession(
			makeDeps({
				getProfileBySteamId: vi.fn(async () => {
					throw new Error('offline');
				})
			})
		);

		await expect(
			session.handle(parseLogLine('RLINK -- Found profile: /steam/76561198000000001')!)
		).resolves.toBeUndefined();
	});

	it('still starts the lobby when player profile resolution fails', async () => {
		const session = new LogSession(
			makeDeps({
				getProfileByIds: vi.fn(async () => {
					throw new Error('offline');
				})
			})
		);
		const started = vi.fn();
		session.on('lobby.started', started);

		await replay(
			session,
			[
				'19:02:11.32  AutoMatchForm - Starting game',
				'19:02:12.00 GAME -- PopulateGameInfoInternal - Player #0, Name x, Id 8666, Type 0, Team 0, Race 1',
				'19:02:12.01 GAME -- PopulateGameInfoInternal - Player #1, Name y, Id 9777, Type 0, Team 1, Race 0',
				'19:02:14.00 GAME -- Starting mission'
			].join('\n')
		);

		expect(started).toHaveBeenCalledOnce();
	});

	it('detects skirmishes against CPU players', async () => {
		const session = new LogSession(makeDeps());
		let lobby: Lobby | undefined;

		session.on('lobby.started', (l) => {
			lobby = l;
		});

		await replay(
			session,
			[
				'19:02:11.32  GameSetupForm - Starting game',
				'GAME -- PopulateGameInfoInternal - Player #0, Name me, Id 8666, Type 0, Team 0, Race 1',
				'GAME -- PopulateGameInfoInternal - Player #1, Name cpu, Id -1, Type 1, Team 1, Race 0',
				'GAME -- Starting mission'
			].join('\n')
		);

		expect(lobby).toBeDefined();
		expect(lobby!.isSkirmish).toBe(true);
		expect(lobby!.matchType).toBe(14);
		expect(lobby!.type).toBe('Skirmish');
	});

	it('resets cleanly on truncation', async () => {
		const session = new LogSession(makeDeps());

		await replay(
			session,
			[
				'19:02:11.32  AutoMatchForm - Starting game',
				'GAME -- PopulateGameInfoInternal - Player #0, Name x, Id 8666, Type 0, Team 0, Race 1'
			].join('\n')
		);

		expect(session.lobby).toBeDefined();

		session.reset();

		expect(session.lobby).toBeUndefined();
		expect(session.sessionId).toBeNull();
	});
});
