import { char, createRegExp, digit, exactly, oneOrMore, whitespace, word } from 'magic-regexp';

/**
 * Pure warnings.log line parser.
 *
 * The trigger regexes are battle-tested and ported verbatim from the previous
 * implementation. `parseLogLine` maps a raw log line to a typed trigger event
 * (or null); it has no IO and no state, making it fully unit-testable.
 */

export type TriggerEvents = {
	'LOG:STARTED': undefined;
	'LOG:ENDED': undefined;
	'LOG:FOUND:PROFILE': { steamId: string };
	'LOG:LOBBY:JOINED': undefined;
	'LOG:LOBBY:POPULATING': { startedAt: string; form: string };
	'LOG:LOBBY:POPULATING:MAP': { map: string };
	'LOG:LOBBY:POPULATING:PLAYER': {
		index: number;
		name?: string;
		playerId: number;
		type: number;
		team: number;
		race: number;
	};
	'LOG:LOBBY:POPULATING:PLAYER:RACE': { index: number; faction: string };
	'LOG:LOBBY:POPULATING:SCENARIO': { scenario: string };
	'LOG:LOBBY:PLAYBACK': undefined;
	'LOG:LOBBY:POPULATING:PLAYER:COUNT': { count: number };
	'LOG:LOBBY:POPULATING:PLAYER:STEAM': { steamId: string; slot: number; ranking: number };
	'LOG:LOBBY:POPULATING:MATCH:TYPE': { type: number };
	'LOG:LOBBY:POPULATING:COMPLETE': undefined;
	'LOG:LOBBY:PLAYER:RESULT': { playerId: number; result: 'PS_WON' | 'PS_KILLED' };
	'LOG:LOBBY:SESSIONID': { sessionId: number };
	'LOG:LOBBY:GAMEOVER': undefined;
	'LOG:LOBBY:DESTROYED': undefined;
	'LOG:LOBBY:STARTED': undefined;
};

export type TriggerName = keyof TriggerEvents;

export type TriggerEvent = {
	[K in TriggerName]: { type: K; data: TriggerEvents[K] };
}[TriggerName];

/**
 * Trigger table. Order matters: the first matching trigger wins
 * (e.g. POPULATING:MAP must be evaluated before POPULATING:COMPLETE).
 */
export const triggers: Record<TriggerName, RegExp> = {
	'LOG:STARTED': createRegExp(exactly('RELICCOH started')),
	'LOG:ENDED': createRegExp(exactly('Application closed without errors')),
	'LOG:FOUND:PROFILE': createRegExp(oneOrMore(digit).after('Found profile: /steam/').as('steamId')),
	'LOG:LOBBY:JOINED': createRegExp(exactly('RLINK -- JoinAsync: AsyncJob Complete')),
	'LOG:LOBBY:POPULATING': createRegExp(
		oneOrMore(char)
			.groupedAs('startedAt')
			.and(oneOrMore(whitespace))
			.and(oneOrMore(char).and(exactly('Form')).groupedAs('form').and(exactly(' - Starting game')))
	),
	'LOG:LOBBY:POPULATING:MAP': createRegExp(
		exactly('GAME -- *** Beginning mission ').and(oneOrMore(char).before(' (').groupedAs('map'))
	),
	'LOG:LOBBY:POPULATING:PLAYER':
		/PopulateGameInfoInternal - Player #(?<index>\d+)(?:, Name (?<name>.+?))?(?:, Id | - \[Id )(?<playerId>-?\d+), Type (?<type>\d+), Team (?<team>\d+), Race (?<race>\d+)/,
	'LOG:LOBBY:POPULATING:PLAYER:RACE': createRegExp(
		oneOrMore(digit)
			.after('MOD - Setting player (')
			.groupedAs('index')
			.and(exactly(') race to: '))
			.and(oneOrMore(char).groupedAs('faction'))
	),
	'LOG:LOBBY:POPULATING:SCENARIO': createRegExp(
		exactly("MOD -- Locating MOD for scenario '").and(
			oneOrMore(char).before("'").groupedAs('scenario')
		)
	),
	'LOG:LOBBY:PLAYBACK': createRegExp(exactly('GAME -- Beginning playback')),
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
	'LOG:LOBBY:POPULATING:MATCH:TYPE':
		/(?:RLINK -- GetRequestInfoBySearchID - matchType |TeamAutomatchUIInfo::Trace - matchType=\[|GameSetupForm - UpdateMatchType: Setting match type to )(?<type>\d+)/,
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

/** Keys that must remain strings (e.g. Steam IDs exceed Number.MAX_SAFE_INTEGER). */
const STRING_KEYS = new Set([
	'steamId',
	'startedAt',
	'form',
	'name',
	'map',
	'result',
	'faction',
	'scenario'
]);

function coerce(value: string): string | number {
	const parsed = Number(value);
	return Number.isFinite(parsed) && value.trim() !== '' ? parsed : value;
}

/**
 * Parses a single log line into a trigger event, or null when no trigger matches.
 */
export function parseLogLine(line: string): TriggerEvent | null {
	for (const [name, regex] of Object.entries(triggers) as [TriggerName, RegExp][]) {
		const match = line.match(regex);

		if (!match) {
			continue;
		}

		if (!match.groups) {
			return { type: name, data: undefined } as TriggerEvent;
		}

		const data: Record<string, string | number> = {};

		for (const [key, value] of Object.entries(match.groups)) {
			if (value == null || value === '') continue;
			data[key] = STRING_KEYS.has(key) ? value : coerce(value);
		}

		return { type: name, data } as unknown as TriggerEvent;
	}

	return null;
}
