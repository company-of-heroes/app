import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rewrite, type RouteRule } from './routes.ts';

const rules: RouteRule[] = [
	{ method: 'GET', legacy: '/api/leaderboard/:id', v1: '/api/v1/leaderboards/:id' },
	{ method: 'GET', legacy: '/api/player/search', v1: '/api/v1/players/search' },
	{ method: 'GET', legacy: '/api/player/:id', v1: '/api/v1/players/:id' }
];

test('rewrites a matching path with params', () => {
	assert.equal(rewrite('GET', '/api/leaderboard/4', rules), '/api/v1/leaderboards/4');
});

test('first matching rule wins', () => {
	assert.equal(rewrite('GET', '/api/player/search', rules), '/api/v1/players/search');
	assert.equal(rewrite('GET', '/api/player/123', rules), '/api/v1/players/123');
});

test('method, length and empty params must match', () => {
	assert.equal(rewrite('POST', '/api/leaderboard/4', rules), null);
	assert.equal(rewrite('GET', '/api/leaderboard/4/extra', rules), null);
	assert.equal(rewrite('GET', '/api/leaderboard/', rules), null);
	assert.equal(rewrite('GET', '/api/collections/lobbies/records', rules), null);
});

test('the real table routes collection writes and nothing else', async () => {
	const { ROUTES } = await import('./routes.ts');
	assert.equal(
		rewrite('POST', '/api/collections/lobby_likes/records', ROUTES),
		'/api/v1/compat/collections/lobby_likes/records'
	);
	assert.equal(
		rewrite('PATCH', '/api/collections/lobby_comments/records/abc', ROUTES),
		'/api/v1/compat/collections/lobby_comments/records/abc'
	);
	assert.equal(rewrite('GET', '/api/collections/lobby_likes/records', ROUTES), null);
	assert.equal(
		rewrite('POST', '/api/collections/lobbies/records', ROUTES),
		'/api/v1/compat/collections/lobbies/records'
	);
	assert.equal(
		rewrite('DELETE', '/api/collections/lobbies_live/records/x', ROUTES),
		'/api/v1/compat/collections/lobbies_live/records/x'
	);
	assert.equal(
		rewrite('POST', '/api/lobbies/abc/attach-replay', ROUTES),
		'/api/v1/lobbies/abc/replay'
	);
	assert.equal(rewrite('POST', '/api/collections/users/records', ROUTES), null);
	assert.equal(rewrite('GET', '/api/leaderboard/4', ROUTES), '/api/v1/leaderboards/4');
});

test('preflight knows every rewritten path', async () => {
	const { ROUTES, rewritesPath } = await import('./routes.ts');
	assert.equal(rewritesPath('/api/player-card/76561198000000001', ROUTES), true);
	assert.equal(rewritesPath('/api/collections/lobbies/records/abc', ROUTES), true);
	assert.equal(rewritesPath('/api/realtime', ROUTES), false);
});
