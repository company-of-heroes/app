import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeSmurfScore } from './score.ts';
import type { RelicStats } from './relic.ts';

const NOW = Date.parse('2026-07-13T00:00:00Z');
const DAY_SEC = 24 * 60 * 60;

function createdDaysAgo(days: number): number {
	return Math.floor(NOW / 1000) - days * DAY_SEC;
}

function relicStats(overrides: Partial<RelicStats> = {}): RelicStats {
	return {
		profileId: 1,
		alias: 'Player',
		level: 5,
		xp: 1000,
		totalGames: 50,
		totalWins: 25,
		winrate: 0.5,
		bestRank: 500,
		lastMatchAt: Math.floor(NOW / 1000),
		...overrides
	};
}

describe('computeSmurfScore', () => {
	it('returns confirmed_shared with score 100 when a lender is known', () => {
		const result = computeSmurfScore({
			lenderSteamId: '76561198000000001',
			ownsCoH: false,
			profilePrivate: false,
			accountCreatedAt: null,
			cohPlaytimeMinutes: null,
			vacBanned: false,
			gameBans: 0,
			relic: null,
			now: NOW
		});

		assert.equal(result.score, 100);
		assert.equal(result.verdict, 'confirmed_shared');
		assert.equal(result.signals[0].id, 'confirmed_lender');
	});

	it('flags a fresh account with low playtime and high winrate as likely_smurf', () => {
		const result = computeSmurfScore({
			lenderSteamId: null,
			ownsCoH: true,
			profilePrivate: false,
			accountCreatedAt: createdDaysAgo(14),
			cohPlaytimeMinutes: 20 * 60,
			vacBanned: false,
			gameBans: 0,
			relic: relicStats({ totalGames: 40, totalWins: 30, winrate: 0.75 }),
			now: NOW
		});

		assert.equal(result.verdict, 'likely_smurf');
		assert.ok(result.score >= 65, `score ${result.score} should be >= 65`);
		assert.ok(result.signals.some((signal) => signal.id === 'account_age'));
		assert.ok(result.signals.some((signal) => signal.id === 'low_playtime_high_winrate'));
	});

	it('marks a veteran account with average winrate as clean', () => {
		const result = computeSmurfScore({
			lenderSteamId: null,
			ownsCoH: true,
			profilePrivate: false,
			accountCreatedAt: createdDaysAgo(3000),
			cohPlaytimeMinutes: 900 * 60,
			vacBanned: false,
			gameBans: 0,
			relic: relicStats({ totalGames: 2000, totalWins: 1050, winrate: 0.525 }),
			now: NOW
		});

		assert.equal(result.verdict, 'clean');
		assert.equal(result.signals.length, 0);
	});

	it('returns unknown when no data is available', () => {
		const result = computeSmurfScore({
			lenderSteamId: null,
			ownsCoH: null,
			profilePrivate: true,
			accountCreatedAt: null,
			cohPlaytimeMinutes: null,
			vacBanned: false,
			gameBans: 0,
			relic: null,
			now: NOW
		});

		assert.equal(result.verdict, 'unknown');
	});

	it('treats a private profile with data as a light signal only', () => {
		const result = computeSmurfScore({
			lenderSteamId: null,
			ownsCoH: null,
			profilePrivate: true,
			accountCreatedAt: createdDaysAgo(2000),
			cohPlaytimeMinutes: null,
			vacBanned: false,
			gameBans: 0,
			relic: relicStats(),
			now: NOW
		});

		assert.equal(result.verdict, 'clean');
		assert.ok(result.signals.some((signal) => signal.id === 'private_profile'));
	});

	it('counts game bans and young age up to suspicious', () => {
		const result = computeSmurfScore({
			lenderSteamId: null,
			ownsCoH: true,
			profilePrivate: false,
			accountCreatedAt: createdDaysAgo(60),
			cohPlaytimeMinutes: 100 * 60,
			vacBanned: false,
			gameBans: 1,
			relic: relicStats(),
			now: NOW
		});

		assert.equal(result.verdict, 'suspicious');
		assert.ok(result.signals.some((signal) => signal.id === 'game_bans'));
	});

	it('caps heuristic scores below 100', () => {
		const result = computeSmurfScore({
			lenderSteamId: null,
			ownsCoH: true,
			profilePrivate: true,
			accountCreatedAt: createdDaysAgo(5),
			cohPlaytimeMinutes: 60,
			vacBanned: true,
			gameBans: 3,
			relic: relicStats({ totalGames: 30, totalWins: 27, winrate: 0.9 }),
			now: NOW
		});

		assert.ok(result.score <= 95);
		assert.equal(result.verdict, 'likely_smurf');
	});
});
