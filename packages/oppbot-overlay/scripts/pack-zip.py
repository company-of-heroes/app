import json
import sys
import zipfile
from pathlib import Path
from typing import Any

PACKAGE_ROOT = Path(__file__).resolve().parent.parent
DIST_DIR = PACKAGE_ROOT / 'dist'
ZIP_PATH = (
	PACKAGE_ROOT.parent
	/ 'app'
	/ 'src'
	/ 'lib'
	/ 'core'
	/ 'app'
	/ 'features'
	/ 'twitch-overlays'
	/ 'overlays'
	/ 'oppbot'
	/ 'oppbot.zip'
)
OVERLAY_VERSION = '7'

ROOT_FILES = (
	'index.html',
	'package.json',
	'vite.config.ts',
	'svelte.config.js',
	'tsconfig.json',
	'README.md',
	'overlay-version.json',
)
INCLUDE_DIRS = ('src', 'public', 'dist')
EXCLUDE_DIR_NAMES = {'node_modules', 'scripts', '.git', '__pycache__'}


def write_overlay_version() -> None:
	version_path = PACKAGE_ROOT / 'overlay-version.json'
	version_path.write_text(
		json.dumps({'version': OVERLAY_VERSION}, indent=2),
		encoding='utf-8',
	)


def user_package_json() -> str:
	"""
	The monorepo package.json runs extra build steps (copy-to-pb + pack-zip).
	Those scripts are intentionally NOT shipped into the user overlay folder in AppData.
	For users, npm run build should only run Vite.
	"""
	raw = (PACKAGE_ROOT / 'package.json').read_text(encoding='utf-8')
	data: dict[str, Any] = json.loads(raw)
	scripts = dict(data.get('scripts') or {})
	scripts['build'] = 'vite build'
	scripts.pop('pack:zip', None)
	data['scripts'] = scripts
	return json.dumps(data, indent=2) + '\n'


def should_skip(relative: Path) -> bool:
	return any(part in EXCLUDE_DIR_NAMES for part in relative.parts)


def add_tree(zf: zipfile.ZipFile, root_dir: Path, prefix: str) -> None:
	for path in sorted(root_dir.rglob('*')):
		if not path.is_file():
			continue
		relative = path.relative_to(root_dir)
		if should_skip(relative):
			continue
		zf.write(path, f'{prefix}/{relative.as_posix()}')


def main() -> None:
	if not DIST_DIR.is_dir():
		print(f'Dist directory not found: {DIST_DIR}', file=sys.stderr)
		sys.exit(1)

	write_overlay_version()
	ZIP_PATH.parent.mkdir(parents=True, exist_ok=True)

	with zipfile.ZipFile(ZIP_PATH, 'w', zipfile.ZIP_DEFLATED) as zf:
		for name in ROOT_FILES:
			file_path = PACKAGE_ROOT / name
			if file_path.is_file():
				if name == 'package.json':
					zf.writestr('package.json', user_package_json())
				else:
					zf.write(file_path, name)

		for dirname in INCLUDE_DIRS:
			dir_path = PACKAGE_ROOT / dirname
			if dir_path.is_dir():
				add_tree(zf, dir_path, dirname)

	size_kb = ZIP_PATH.stat().st_size / 1024
	print(f'Created {ZIP_PATH} ({size_kb:.1f} KB)')


if __name__ == '__main__':
	main()
