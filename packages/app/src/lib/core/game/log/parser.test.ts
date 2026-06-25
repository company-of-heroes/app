import { describe, expect, it } from 'vitest';
import { parseLogLine } from './parser';
import fixture from '../../../../tests/fixtures/warnings/ranked-1v1.log?raw';

const lines = fixture.split(/\r?\n/).filter((line) => line.trim() !== '');

describe('parseLogLine', () => {
	it('parses RELICCOH started', () => {
		expect(parseLogLine(lines[0])).toEqual({ type: 'LOG:STARTED', data: undefined });
	});

	it('ignores unknown lines', () => {
		expect(parseLogLine('19:00:02.10 MOD -- Loading data')).toBeNull();
		expect(parseLogLine('')).toBeNull();
	});

	it('parses the local profile with the Steam ID kept as string', () => {
		const event = parseLogLine('19:00:05.10 RLINK -- Found profile: /steam/76561198000000001');

		expect(event).toEqual({
			type: 'LOG:FOUND:PROFILE',
			data: { steamId: '76561198000000001' }
		});
	});

	it('parses lobby populating with ranked detection', () => {
		const ranked = parseLogLine('19:02:11.32  AutoMatchForm - Starting game');

		expect(ranked?.type).toBe('LOG:LOBBY:POPULATING');
		expect(ranked?.data).toMatchObject({ isRanked: 'AutoMatchForm' });

		const custom = parseLogLine('19:02:11.32  GameSetupForm - Starting game');

		expect(custom?.data).toMatchObject({ isRanked: 'GameSetupForm' });
	});

	it('parses players with numeric fields coerced', () => {
		const event = parseLogLine(
			'19:02:12.00 GAME -- PopulateGameInfoInternal - Player #0, Name player one, Id 8666, Type 0, Team 0, Race 1'
		);

		expect(event).toEqual({
			type: 'LOG:LOBBY:POPULATING:PLAYER',
			data: { index: 0, playerId: 8666, type: 0, team: 0, race: 1 }
		});
	});

	it('parses CPU players with Id -1', () => {
		const event = parseLogLine(
			'GAME -- PopulateGameInfoInternal - Player #1, Name CPU, Id -1, Type 1, Team 1, Race 1'
		);

		expect(event?.data).toMatchObject({ playerId: -1 });
	});

	it('parses player steam assignments including unranked (-1)', () => {
		const ranked = parseLogLine(
			'19:02:12.20 RLINK -- MatchStartInfo /steam/76561198000000001 info slot =  0 info ranking =  25'
		);

		expect(ranked).toEqual({
			type: 'LOG:LOBBY:POPULATING:PLAYER:STEAM',
			data: { steamId: '76561198000000001', slot: 0, ranking: 25 }
		});

		const unranked = parseLogLine(
			'19:02:12.21 RLINK -- MatchStartInfo /steam/76561198000000002 info slot =  1 info ranking =  -1'
		);

		expect(unranked?.data).toMatchObject({ slot: 1, ranking: -1 });
	});

	it('parses the map before the generic mission-complete trigger', () => {
		const event = parseLogLine(
			'19:02:13.00 GAME -- *** Beginning mission 2p_semois (RGM - Multiplayer/Skirmish Game)'
		);

		expect(event).toEqual({
			type: 'LOG:LOBBY:POPULATING:MAP',
			data: { map: '2p_semois' }
		});
	});

	it('parses the session id', () => {
		const event = parseLogLine('19:02:00.00 RLINK -- Created Matchinfo for sessionID 987654');

		expect(event).toEqual({ type: 'LOG:LOBBY:SESSIONID', data: { sessionId: 987654 } });
	});

	it('parses mission start, gameover and destroy', () => {
		expect(parseLogLine('19:02:14.00 GAME -- Starting mission')?.type).toBe('LOG:LOBBY:STARTED');
		expect(parseLogLine('19:25:33.00 GameObj::DoGameOverPopup')?.type).toBe('LOG:LOBBY:GAMEOVER');
		expect(parseLogLine('19:25:40.00 APP -- Game Stop')?.type).toBe('LOG:LOBBY:DESTROYED');
	});

	it('parses match results', () => {
		const event = parseLogLine(
			'19:25:35.00 RLINK -- ReportMatchResults - matchid:123, race:1, team:0, uid:0:8666, result:1:PS_WON'
		);

		expect(event).toEqual({
			type: 'LOG:LOBBY:PLAYER:RESULT',
			data: { playerId: 8666, result: 'PS_WON' }
		});
	});

	it('parses application end', () => {
		expect(parseLogLine('19:30:00.00 Application closed without errors')?.type).toBe('LOG:ENDED');
	});

	it('recognizes every relevant line of the full fixture', () => {
		const parsed = lines.map(parseLogLine);
		const recognized = parsed.filter(Boolean);

		// All lines except the one "MOD -- Loading data" noise line.
		expect(recognized).toHaveLength(lines.length - 1);
	});
});
