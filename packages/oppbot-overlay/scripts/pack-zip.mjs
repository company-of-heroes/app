import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(__dirname, '..');

console.log('Packing oppbot.zip for desktop app...');
execSync('python scripts/pack-zip.py', { cwd: packageRoot, stdio: 'inherit' });
