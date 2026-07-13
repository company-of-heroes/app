import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	COH_APP_ID,
	interpretOwnedGamesResponse,
	isPlayingCoH,
	isProfilePrivate,
	parseCohStatsLenderFromHtml
} from './detect.ts';

describe('parseCohStatsLenderFromHtml', () => {
	it('extracts lender from infoSmurfText anchor', () => {
		const html = `
			<table>
				<tr>
					<td>Smurf detected!</td>
					<td id="infoSmurfText"><a href="?steamid=76561199677855789">link</a></td>
				</tr>
			</table>
		`;

		assert.equal(parseCohStatsLenderFromHtml(html), '76561199677855789');
	});

	it('returns null when infoSmurfText has no lender link', () => {
		const html = `<td id="infoSmurfText">Smurf detected!</td>`;
		assert.equal(parseCohStatsLenderFromHtml(html), null);
	});

	it('ignores steamid outside infoSmurfText', () => {
		const html = `
			<td id="other"><a href="?steamid=76561198000000000">other</a></td>
			<td id="infoSmurfText"></td>
		`;

		assert.equal(parseCohStatsLenderFromHtml(html), null);
	});

	it('returns null when infoSmurfText cell is missing', () => {
		const html = `<a href="?steamid=76561199677855789">orphan</a>`;
		assert.equal(parseCohStatsLenderFromHtml(html), null);
	});
});

describe('isPlayingCoH', () => {
	it('returns true when playing CoH by gameid and online', () => {
		assert.equal(
			isPlayingCoH({
				gameid: String(COH_APP_ID),
				personastate: 1
			}),
			true
		);
	});

	it('returns true when in-game with away personastate', () => {
		assert.equal(
			isPlayingCoH({
				gameid: String(COH_APP_ID),
				personastate: 3
			}),
			true
		);
	});

	it('returns true when gameid is set even with personastate 0', () => {
		assert.equal(
			isPlayingCoH({
				gameid: String(COH_APP_ID),
				personastate: 0
			}),
			true
		);
	});

	it('returns true for the New Steam Version game name', () => {
		assert.equal(
			isPlayingCoH({
				gameextrainfo: 'Company of Heroes (New Steam Version)',
				personastate: 1
			}),
			true
		);
	});

	it('returns true when playing CoH by gameextrainfo', () => {
		assert.equal(
			isPlayingCoH({
				gameextrainfo: 'Company of Heroes',
				personastate: 1
			}),
			true
		);
	});

	it('returns false for CoH 2', () => {
		assert.equal(
			isPlayingCoH({
				gameid: '231430',
				gameextrainfo: 'Company of Heroes 2',
				personastate: 1
			}),
			false
		);
	});

	it('returns false when online but playing another game', () => {
		assert.equal(
			isPlayingCoH({
				gameid: '730',
				gameextrainfo: 'Counter-Strike 2',
				personastate: 1
			}),
			false
		);
	});

	it('returns false when summary is undefined', () => {
		assert.equal(isPlayingCoH(undefined), false);
	});
});

describe('isProfilePrivate', () => {
	it('returns false for public profiles', () => {
		assert.equal(isProfilePrivate({ personastate: 1, communityvisibilitystate: 3 }), false);
	});

	it('returns true for private profiles', () => {
		assert.equal(isProfilePrivate({ personastate: 0, communityvisibilitystate: 1 }), true);
	});

	it('returns false when visibility is unknown', () => {
		assert.equal(isProfilePrivate({ personastate: 0 }), false);
		assert.equal(isProfilePrivate(undefined), false);
	});
});

describe('interpretOwnedGamesResponse', () => {
	it('detects ownership with playtime', () => {
		const result = interpretOwnedGamesResponse({
			game_count: 1,
			games: [{ appid: COH_APP_ID, playtime_forever: 1234 }]
		});

		assert.equal(result.owns, true);
		assert.equal(result.playtimeMinutes, 1234);
	});

	it('treats explicit game_count 0 as not owning', () => {
		const result = interpretOwnedGamesResponse({ game_count: 0 });

		assert.equal(result.owns, false);
		assert.equal(result.playtimeMinutes, null);
	});

	it('treats an empty response (private profile) as inconclusive', () => {
		assert.equal(interpretOwnedGamesResponse({}).owns, null);
		assert.equal(interpretOwnedGamesResponse(undefined).owns, null);
	});
});
