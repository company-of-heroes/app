import json
import os
import sys
import zipfile
from pathlib import Path

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
OVERLAY_VERSION = '2'


def main() -> None:
	if not DIST_DIR.is_dir():
		print(f'Dist directory not found: {DIST_DIR}', file=sys.stderr)
		sys.exit(1)

	version_path = DIST_DIR / 'overlay-version.json'
	version_path.write_text(json.dumps({'version': OVERLAY_VERSION}, indent=2), encoding='utf-8')

	ZIP_PATH.parent.mkdir(parents=True, exist_ok=True)

	with zipfile.ZipFile(ZIP_PATH, 'w', zipfile.ZIP_DEFLATED) as zf:
		for path in DIST_DIR.rglob('*'):
			if path.is_file():
				zf.write(path, path.relative_to(DIST_DIR).as_posix())

	size_kb = ZIP_PATH.stat().st_size / 1024
	print(f'Created {ZIP_PATH} ({size_kb:.1f} KB)')


if __name__ == '__main__':
	main()
