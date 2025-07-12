import { createRegExp, digit, exactly, oneOrMore, char, whitespace, word } from 'magic-regexp';
import type { LogEvents } from './types.js';

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
		exactly('AutoMatchForm - Starting game')
			.or(exactly('GameSetupForm - Starting game'))
			.groupedAs('type')
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
