import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { COH_APP_ID, isPlayingCoH, parseCohStatsLenderFromHtml } from './detect.ts';

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
	it('returns true when playing CoH by gameid and in-game', () => {
		assert.equal(
			isPlayingCoH({
				gameid: String(COH_APP_ID),
				personastate: 1
			}),
			true
		);
	});

	it('returns true when playing CoH by gameextrainfo and in-game', () => {
		assert.equal(
			isPlayingCoH({
				gameextrainfo: 'Company of Heroes',
				personastate: 1
			}),
			true
		);
	});

	it('returns false when offline with CoH gameid', () => {
		assert.equal(
			isPlayingCoH({
				gameid: String(COH_APP_ID),
				personastate: 0
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
