#!/usr/bin/env node
/**
 * `tauri dev` with the first free port from 1430 up, so it runs next to the companion app
 * (1420) or a leftover dev server. Vite reads `REPLAY_PARSER_PORT`; Tauri gets the matching
 * `devUrl` through a `--config` override. Other commands pass straight through.
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';

const FIRST_PORT = 1430;

function isFree(port) {
	return new Promise((resolve) => {
		const server = createServer()
			.once('error', () => resolve(false))
			.once('listening', () => server.close(() => resolve(true)))
			.listen(port, 'localhost');
	});
}

async function freePort(from) {
	for (let port = from; port < from + 100; port += 2) {
		// The port above is for HMR when TAURI_DEV_HOST is set.
		if ((await isFree(port)) && (await isFree(port + 1))) {
			return port;
		}
	}

	throw new Error(`No free port found from ${from}`);
}

const args = process.argv.slice(2);
if (args[0] === 'dev') {
	const port = await freePort(FIRST_PORT);
	process.env.REPLAY_PARSER_PORT = String(port);
	args.push('--config', JSON.stringify({ build: { devUrl: `http://localhost:${port}` } }));
	console.log(`[replay-parser] dev server on port ${port}`);
}

const require = createRequire(import.meta.url);
const cli = require.resolve('@tauri-apps/cli/tauri.js');
const child = spawn(process.execPath, [cli, ...args], {
	stdio: 'inherit',
	env: process.env
});

child.on('exit', (code, signal) => {
	if (signal) {
		process.kill(process.pid, signal);
	} else {
		process.exit(code ?? 1);
	}
});
