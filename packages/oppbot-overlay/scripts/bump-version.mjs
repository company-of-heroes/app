import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(__dirname, '..');
const versionPath = join(packageRoot, 'overlay-version.json');
const oppbotClassPath = join(
	packageRoot,
	'..',
	'app',
	'src',
	'lib',
	'core',
	'app',
	'features',
	'twitch-overlays',
	'overlays',
	'oppbot',
	'oppbot.svelte.ts'
);

const current = JSON.parse(readFileSync(versionPath, 'utf8'));
const prev = String(current.version ?? '0');
const next = String((Number.parseInt(prev, 10) || 0) + 1);

writeFileSync(versionPath, `${JSON.stringify({ version: next }, null, 2)}\n`, 'utf8');

const oppbotSource = readFileSync(oppbotClassPath, 'utf8');
const updated = oppbotSource.replace(/version\s*=\s*['"]\d+['"]/, `version = '${next}'`);
if (updated === oppbotSource) {
	throw new Error(`Could not update version in ${oppbotClassPath}`);
}

writeFileSync(oppbotClassPath, updated, 'utf8');

console.log(`Overlay version bumped: ${prev} → ${next}`);
