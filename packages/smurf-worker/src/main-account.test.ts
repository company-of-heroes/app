import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	aliasSimilarity,
	MAIN_CONFIDENCE_THRESHOLD,
	rankMainCandidates,
	type CandidateFacts,
	type SuspectFacts
} from './main-account.ts';
import type { RelicStats } from './relic.ts';

function relicStats(overrides: Partial<RelicStats> = {}): RelicStats {
	return {
		profileId: 1,
		alias: 'Player',
		level: 10,
		xp: 5000,
		totalGames: 500,
		totalWins: 275,
		winrate: 0.55,
		bestRank: 100,
		lastMatchAt: null,
		...overrides
	};
}

function candidate(overrides: Partial<CandidateFacts> = {}): CandidateFacts {
	return {
		steamId: '76561198000000002',
		fromFriendList: false,
		friendSince: null,
		sharedTeammates: 0,
		lobbiesWithSuspect: 0,
		alias: null,
		avatarhash: null,
		timecreated: null,
		relic: null,
		...overrides
	};
}

const suspect: SuspectFacts = {
	steamId: '76561198000000001',
	alias: 'ProGamer',
	avatarhash: 'abc123',
	timecreated: 1700000000,
	bestRank: 120
};

describe('aliasSimilarity', () => {
	it('returns 1 for identical aliases (case/symbol insensitive)', () => {
		assert.equal(aliasSimilarity('ProGamer', 'pro_gamer'), 1);
	});

	it('returns high similarity for containment', () => {
		assert.equal(aliasSimilarity('ProGamer', 'ProGamer2'), 0.85);
	});

	it('returns low similarity for unrelated names', () => {
		assert.ok(aliasSimilarity('ProGamer', 'xXSniperXx') < 0.5);
	});

	it('returns 0 for missing or too short aliases', () => {
		assert.equal(aliasSimilarity(null, 'ProGamer'), 0);
		assert.equal(aliasSimilarity('ab', 'ProGamer'), 0);
	});
});

describe('rankMainCandidates', () => {
	it('ranks an old friend with matching avatar and similar alias on top', () => {
		const main = candidate({
			steamId: '76561198000000002',
			fromFriendList: true,
			alias: 'ProGamer_Main',
			avatarhash: 'abc123',
			timecreated: 1400000000,
			relic: relicStats({ bestRank: 150 })
		});
		const randomFriend = candidate({
			steamId: '76561198000000003',
			fromFriendList: true,
			alias: 'SomeoneElse',
			timecreated: 1800000000
		});

		const ranked = rankMainCandidates(suspect, [randomFriend, main]);

		assert.equal(ranked[0].steamId, main.steamId);
		assert.ok(ranked[0].confidence >= MAIN_CONFIDENCE_THRESHOLD);
		assert.ok(ranked[0].signals.some((signal) => signal.id === 'avatar_match'));
		assert.ok(ranked[0].signals.some((signal) => signal.id === 'alias_similar'));
	});

	it('penalizes candidates that play together with the suspect', () => {
		const teammate = candidate({
			steamId: '76561198000000004',
			fromFriendList: true,
			alias: 'ProGamer_Main',
			timecreated: 1400000000,
			lobbiesWithSuspect: 10,
			relic: relicStats()
		});
		const exclusive = candidate({
			steamId: '76561198000000005',
			fromFriendList: true,
			alias: 'ProGamer_Main',
			timecreated: 1400000000,
			lobbiesWithSuspect: 0,
			relic: relicStats()
		});

		const ranked = rankMainCandidates(suspect, [teammate, exclusive]);

		assert.equal(ranked[0].steamId, exclusive.steamId);
		const teammateRank = ranked.find((entry) => entry.steamId === teammate.steamId);
		assert.ok(!teammateRank || teammateRank.confidence < ranked[0].confidence);
	});

	it('penalizes accounts younger than the suspect', () => {
		const younger = candidate({
			steamId: '76561198000000006',
			fromFriendList: true,
			timecreated: suspect.timecreated! + 1000,
			relic: relicStats()
		});
		const older = candidate({
			steamId: '76561198000000007',
			fromFriendList: true,
			timecreated: suspect.timecreated! - 1000,
			relic: relicStats()
		});

		const ranked = rankMainCandidates(suspect, [younger, older]);

		assert.equal(ranked[0].steamId, older.steamId);
	});

	it('excludes the suspect itself and empty-signal candidates', () => {
		const self = candidate({ steamId: suspect.steamId });
		const noSignals = candidate({ steamId: '76561198000000008' });

		const ranked = rankMainCandidates(suspect, [self, noSignals]);

		assert.equal(ranked.length, 0);
	});
});
