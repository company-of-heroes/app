import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(__dirname, '..');
const distDir = join(packageRoot, 'dist');
const targetDir = join(packageRoot, '..', 'pocketbase', 'pb_hooks', 'public', 'overlay-default');

rmSync(targetDir, { recursive: true, force: true });
mkdirSync(targetDir, { recursive: true });
cpSync(distDir, targetDir, { recursive: true });

writeFileSync(
	join(targetDir, 'overlay-version.json'),
	JSON.stringify({ version: '7' }, null, 2),
	'utf8'
);

console.log(`Copied overlay build to ${targetDir}`);
