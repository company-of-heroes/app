import assert from 'node:assert/strict';
import { test } from 'node:test';
import { limitFileDownload, type FilesEnv } from './files.ts';

const limiter = (allow: boolean) => ({ limit: async () => ({ success: allow }) });
const env = (allow: boolean): FilesEnv => ({
	FILE_BURST: limiter(allow),
	FILE_MINUTE: limiter(allow),
	FILE_AUTH_BURST: limiter(allow),
	FILE_AUTH_MINUTE: limiter(allow),
	REPLAY_PROXY_SECRET: 's3cret'
});
const file = (headers: Record<string, string> = {}) =>
	new Request('https://api.coh1stats.com/api/files/lobbies/abc/replay.rec', { headers });

test('limits replay files per IP', async () => {
	assert.equal(await limitFileDownload(file(), env(true)), null);
	assert.equal((await limitFileDownload(file(), env(false)))?.status, 429);
});

test('other paths and the website proxy are not limited', async () => {
	assert.equal(
		await limitFileDownload(
			new Request('https://api.coh1stats.com/api/files/users/a/b.png'),
			env(false)
		),
		null
	);
	assert.equal(await limitFileDownload(file({ 'x-replay-proxy': 's3cret' }), env(false)), null);
});
