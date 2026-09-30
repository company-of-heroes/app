import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(__dirname, '..');
const distDir = join(packageRoot, 'dist');
const versionPath = join(packageRoot, 'overlay-version.json');
const targetDir = join(packageRoot, '..', 'pocketbase', 'pb_hooks', 'public', 'overlay-default');

const versionFile = readFileSync(versionPath, 'utf8');

rmSync(targetDir, { recursive: true, force: true });
mkdirSync(targetDir, { recursive: true });
cpSync(distDir, targetDir, { recursive: true });
writeFileSync(join(targetDir, 'overlay-version.json'), versionFile, 'utf8');

const { version } = JSON.parse(versionFile);
console.log(`Copied overlay build to ${targetDir} (version ${version})`);
