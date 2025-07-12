import { createRegExp, digit, exactly, oneOrMore, char, whitespace, word } from 'magic-regexp';
import type { CoHMaps } from './game';

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
	'LOG:LOBBY:GAMEOVER': undefined;
	'LOG:LOBBY:DESTROYED': undefined;
	'LOG:LOBBY:STARTED': undefined;
};

/**
 * Regular expressions used to parse log lines and trigger corresponding events.
 * The keys match the event names defined in LogEventData.
 * Named capture groups in the regex should correspond to the properties in the LogEventData payload objects.
 */
export const triggers: Record<keyof LogEvents, RegExp> = {
	'LOG:STARTED': createRegExp(exactly('RELICCOH started')),
	'LOG:ENDED': createRegExp(exactly('Application closed without errors')),
	'LOG:FOUND:PROFILE': createRegExp(
		oneOrMore(digit).after('Found 1 profiles for account /steam/').as('steamId')
	),
	'LOG:LOBBY:JOINED': createRegExp(exactly('RLINK -- JoinAsync: AsyncJob Complete')),
	'LOG:LOBBY:POPULATING': createRegExp(exactly('RLINK -- starting online hosting')),
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
export function addEvent(name: keyof LogEvents, matcher: RegExp) {
	triggers[name] = matcher;
}

// Auto match game type
// AutoMatchForm - Starting game
