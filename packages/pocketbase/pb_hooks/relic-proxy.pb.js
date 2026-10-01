/// <reference path="../pb_data/types.d.ts" />

'use strict';

// Relic's API serves a certificate Cloudflare Workers refuse, so the website
// fetches it through here. This route only forwards; all logic lives on the website.
//
// POST /api/_relic  { "urls": ["https://coh1-lobby.reliclink.com/..."] }
// -> { "results": [{ "url", "ok": true, "body" } | { "url", "ok": false, "error" }] }
routerAdd('POST', '/api/_relic', (e) => {
	const token = $os.getenv('SERVICE_TOKEN') || '';
	const header = e.request.header.get('Authorization') || '';
	if (!token || !$security.equal(header, `Bearer ${token}`)) {
		return e.json(401, { message: 'Unauthorized' });
	}

	const urls = e.requestInfo().body?.urls;
	if (!Array.isArray(urls) || urls.length === 0 || urls.length > 100) {
		return e.json(400, { message: 'Expected 1-100 urls' });
	}

	if (
		!urls.every(
			(url) => typeof url === 'string' && url.startsWith('https://coh1-lobby.reliclink.com/')
		)
	) {
		return e.json(400, { message: 'Only coh1-lobby.reliclink.com urls are allowed' });
	}

	const output = toString(
		$os
			.cmd('python3', `${__hooks}/lib/fetch-insecure.py`, '--ndjson', JSON.stringify(urls))
			.output()
	);
	const results = output
		.split('\n')
		.filter((line) => line.trim())
		.map((line) => JSON.parse(line));

	return e.json(200, { results });
});
