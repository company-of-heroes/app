'use strict';

const USER_ID_PATTERN = /^[a-z0-9]{15}$/;

function overlayStorageRoot() {
	return `${__hooks}/../pb_data/storage/overlays`;
}

function defaultBuildRoot() {
	return `${__hooks}/public/overlay-default`;
}

function userOverlayDir(userId) {
	return `${overlayStorageRoot()}/${userId}`;
}

function isValidUserId(userId) {
	return USER_ID_PATTERN.test(userId);
}

function contentType(filePath) {
	const ext = filePath.split('.').pop()?.toLowerCase();
	const map = {
		html: 'text/html; charset=utf-8',
		js: 'application/javascript; charset=utf-8',
		mjs: 'application/javascript; charset=utf-8',
		css: 'text/css; charset=utf-8',
		json: 'application/json; charset=utf-8',
		png: 'image/png',
		jpg: 'image/jpeg',
		jpeg: 'image/jpeg',
		gif: 'image/gif',
		svg: 'image/svg+xml',
		webp: 'image/webp',
		woff: 'font/woff',
		woff2: 'font/woff2',
		ico: 'image/x-icon'
	};
	return map[ext] || 'application/octet-stream';
}

function fileExists(path) {
	try {
		$os.stat(path);
		return true;
	} catch {
		return false;
	}
}

function normalizeRelativePath(relPath) {
	const normalized = (relPath || '').replace(/^\/+/, '').replace(/\\/g, '/');
	return normalized || 'index.html';
}

function resolveOverlayFile(userId, relPath) {
	const normalized = normalizeRelativePath(relPath);
	const userPath = `${userOverlayDir(userId)}/${normalized}`;

	if (fileExists(userPath)) {
		return { root: userOverlayDir(userId), path: normalized };
	}

	const defaultPath = `${defaultBuildRoot()}/${normalized}`;
	if (fileExists(defaultPath)) {
		return { root: defaultBuildRoot(), path: normalized };
	}

	return null;
}

function serveOverlayFile(e, userId, relPath) {
	if (!isValidUserId(userId)) {
		throw new BadRequestError('Invalid user id');
	}

	const resolved = resolveOverlayFile(userId, relPath);
	if (!resolved) {
		throw new NotFoundError('File not found');
	}

	const isHtml = resolved.path.endsWith('.html');
	if (isHtml) {
		e.response.header().set('Cache-Control', 'no-cache, no-store, must-revalidate');
	} else {
		e.response.header().set('Cache-Control', 'public, max-age=31536000, immutable');
	}

	e.response.header().set('Content-Type', contentType(resolved.path));

	if (resolved.path === 'index.html') {
		const filePath = `${resolved.root}/${resolved.path}`;
		let content = toString($os.readFile(filePath));
		const baseHref = `/overlay/${userId}/`;

		if (!content.includes('<base ')) {
			content = content.replace('<head>', `<head>\n\t\t<base href="${baseHref}" />`);
		}

		return e.string(200, content);
	}

	return e.fileFS($os.dirFS(resolved.root), resolved.path);
}

function extractZip(zipPath, destDir) {
	$os.removeAll(destDir);
	$os.mkdirAll(destDir, 0o755);

	try {
		$os.cmd('unzip', '-o', zipPath, '-d', destDir).run();
		return;
	} catch (unzipError) {
		console.warn('[overlay] unzip failed, trying python3:', unzipError);
	}

	try {
		$os
			.cmd(
				'python3',
				'-c',
				'import zipfile,sys; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])',
				zipPath,
				destDir
			)
			.run();
		return;
	} catch (pythonError) {
		throw new Error(`Failed to extract overlay bundle: ${pythonError}`);
	}
}

function hasIndexHtml(dir) {
	return fileExists(`${dir}/index.html`);
}

function readOverlayVersion(dir) {
	try {
		const versionContent = toString($os.readFile(`${dir}/overlay-version.json`));
		const parsed = JSON.parse(versionContent);
		return parsed.version || '';
	} catch {
		return '';
	}
}

function saveUploadedBundle(bundle, tempZip) {
	const reader = bundle.reader.open();
	try {
		const bytes = toBytes(reader);
		$os.writeFile(tempZip, bytes, 0o644);
	} finally {
		reader.close();
	}
}

function handlePublish(e) {
	const auth = e.auth;
	if (!auth) {
		return e.json(401, { message: 'Unauthorized' });
	}

	const userId = auth.id;
	let files;

	try {
		files = e.findUploadedFiles('bundle');
	} catch {
		return e.json(400, { message: 'Missing bundle file' });
	}

	if (!files || files.length === 0) {
		return e.json(400, { message: 'Missing bundle file' });
	}

	const bundle = files[0];
	const tempZip = `${$os.tempDir()}/overlay-${userId}-${Date.now()}.zip`;
	const extractDir = userOverlayDir(userId);

	try {
		saveUploadedBundle(bundle, tempZip);
		extractZip(tempZip, extractDir);
	} finally {
		try {
			$os.remove(tempZip);
		} catch {
			// ignore cleanup errors
		}
	}

	if (!hasIndexHtml(extractDir)) {
		$os.removeAll(extractDir);
		return e.json(400, { message: 'Bundle must contain index.html' });
	}

	const version = readOverlayVersion(extractDir);
	const collection = $app.findCollectionByNameOrId('user_overlays');
	let record;

	try {
		record = $app.findFirstRecordByFilter('user_overlays', `user = "${userId}"`);
	} catch {
		record = new Record(collection);
		record.set('user', userId);
	}

	record.set('bundle', bundle);
	record.set('version', version);
	$app.save(record);

	return e.json(200, {
		success: true,
		version,
		updatedAt: record.get('updated')
	});
}

function handleGetOverlay(e) {
	const userId = e.request.pathValue('userId');
	const path = e.request.pathValue('path');
	return serveOverlayFile(e, userId, path);
}

function handleGetOverlayIndex(e) {
	const userId = e.request.pathValue('userId');
	return serveOverlayFile(e, userId, 'index.html');
}

module.exports = {
	handleGetOverlay,
	handleGetOverlayIndex,
	handlePublish,
	isValidUserId,
	serveOverlayFile
};
