// Seeds PocketBase with guides (content in `scripts/guides/`, written from public community guides): a category tree per faction (1v1, 2v2, Team games plus a
// General category), guides with wiki links, inline-free markdown, generated covers, a few
// Spanish/Korean translations and one draft. Authors are existing users that have a Steam ID
// (so their labels and profile links show); without one a seed editor account is created.
// Skips categories and guides that already exist, so it is safe to run again. Local only
// unless `--url <url> --production` is passed.
// `--reset` deletes every guide first.
// Run: pnpm --filter @company-of-heroes/pocketbase seed:guides [--reset] [--dry-run]
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { BRITISH } from './guides/british.mjs';
import { GENERAL } from './guides/general.mjs';
import { PANZER_ELITE } from './guides/panzer-elite.mjs';
import { US_FORCES } from './guides/us-forces.mjs';
import { WEHRMACHT } from './guides/wehrmacht.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(DIR, '..', '.env'), quiet: true });

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name) => {
	const index = args.indexOf(`--${name}`);
	return index >= 0 ? args[index + 1] : undefined;
};
const URL_BASE = (option('url') || process.env.PB_PUBLIC_URL || 'http://127.0.0.1:8090').replace(
	/\/$/,
	''
);
const DRY_RUN = flag('dry-run');
/** Delete every guide first (local test data only). */
const RESET = flag('reset');
const EMAIL = process.env.PB_ADMIN_EMAIL;
const PASSWORD = process.env.PB_ADMIN_PASSWORD;

/** Top-level categories (factions) with their subcategories, and the cover tint per faction. */
const TREE = [
	{
		name: 'Wehrmacht',
		slug: 'wehrmacht',
		color: [120, 120, 125],
		children: ['1v1', '2v2', 'Team games']
	},
	{
		name: 'US Forces',
		slug: 'us-forces',
		color: [96, 120, 70],
		children: ['1v1', '2v2', 'Team games']
	},
	{
		name: 'British Commonwealth',
		slug: 'british-commonwealth',
		color: [150, 110, 70],
		children: ['1v1', '2v2']
	},
	{
		name: 'Panzer Elite',
		slug: 'panzer-elite',
		color: [70, 90, 120],
		children: ['1v1', 'Team games']
	},
	{ name: 'General', slug: 'general', color: [160, 130, 60], children: [] }
];

const slugify = (value) =>
	value
		.normalize('NFKD')
		.replace(/\p{Diacritic}/gu, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');

/** Guides written from public community guides (sources linked at the end of each). */
const GUIDES = [...WEHRMACHT, ...US_FORCES, ...BRITISH, ...PANZER_ELITE, ...GENERAL];

/** A small two-tone PNG cover (1200×630), tinted per faction. */
function cover([r, g, b], seed) {
	const width = 1200;
	const height = 630;
	const rows = [];
	for (let y = 0; y < height; y++) {
		const row = Buffer.alloc(1 + width * 3);
		for (let x = 0; x < width; x++) {
			const stripe = ((x + y + seed * 40) >> 6) % 2 === 0 ? 1 : 0.82;
			const fade = 0.55 + 0.45 * (1 - y / height);
			row[1 + x * 3] = Math.round(r * stripe * fade);
			row[2 + x * 3] = Math.round(g * stripe * fade);
			row[3 + x * 3] = Math.round(b * stripe * fade);
		}
		rows.push(row);
	}

	const crcTable = Array.from({ length: 256 }, (_, n) => {
		let c = n;
		for (let k = 0; k < 8; k++) {
			c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		}
		return c >>> 0;
	});
	const crc = (buffer) => {
		let c = 0xffffffff;
		for (const byte of buffer) {
			c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
		}
		return (c ^ 0xffffffff) >>> 0;
	};
	const chunk = (type, data) => {
		const length = Buffer.alloc(4);
		length.writeUInt32BE(data.length);
		const body = Buffer.concat([Buffer.from(type), data]);
		const sum = Buffer.alloc(4);
		sum.writeUInt32BE(crc(body));
		return Buffer.concat([length, body, sum]);
	};
	const header = Buffer.alloc(13);
	header.writeUInt32BE(width, 0);
	header.writeUInt32BE(height, 4);
	header[8] = 8;
	header[9] = 2;
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk('IHDR', header),
		chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))),
		chunk('IEND', Buffer.alloc(0))
	]);
}

async function request(pathname, options = {}, token) {
	const isForm = options.body instanceof FormData;
	const response = await fetch(`${URL_BASE}${pathname}`, {
		...options,
		headers: {
			...(isForm ? {} : { 'Content-Type': 'application/json' }),
			...(token ? { Authorization: token } : {}),
			...options.headers
		}
	});
	const body = await response.json().catch(() => null);
	if (!response.ok) {
		throw new Error(
			`${options.method ?? 'GET'} ${pathname}: ${response.status} ${JSON.stringify(body)}`
		);
	}

	return body;
}

const filter = (expression) => encodeURIComponent(expression);

async function authors(token) {
	const found = await request(
		`/api/collections/users/records?perPage=20&sort=-lastLogin&filter=${filter('steamIds != "[]" && steamIds != ""')}&fields=id,name`,
		{},
		token
	);
	if (found.items.length) {
		return found.items.slice(0, 4).map((user) => user.id);
	}

	const email = 'seed-guide-editor@fknoobs.com';
	const existing = await request(
		`/api/collections/users/records?filter=${filter(`email = "${email}"`)}`,
		{},
		token
	);
	if (existing.items[0]) {
		return [existing.items[0].id];
	}

	const password = `seed-${Math.random().toString(36).slice(2)}`;
	const user = await request(
		'/api/collections/users/records',
		{
			method: 'POST',
			body: JSON.stringify({
				email,
				password,
				passwordConfirm: password,
				name: 'Guide Editor',
				role: 'editor',
				verified: true
			})
		},
		token
	);
	return [user.id];
}

async function categories(token) {
	const existing = await request(
		'/api/collections/guide_categories/records?perPage=500',
		{},
		token
	);
	const find = (slug, parent) =>
		existing.items.find((item) => item.slug === slug && (item.parent || '') === (parent || ''));
	const paths = new Map();
	let created = 0;
	for (const [sort, top] of TREE.entries()) {
		let record = find(top.slug, '');
		if (!record && !DRY_RUN) {
			record = await request(
				'/api/collections/guide_categories/records',
				{ method: 'POST', body: JSON.stringify({ name: top.name, slug: top.slug, sort }) },
				token
			);
			created++;
		}

		paths.set(top.slug, { id: record?.id, color: top.color });
		for (const [childSort, name] of top.children.entries()) {
			const slug = slugify(name);
			let child = record && find(slug, record.id);
			if (!child && record && !DRY_RUN) {
				child = await request(
					'/api/collections/guide_categories/records',
					{
						method: 'POST',
						body: JSON.stringify({ name, slug, parent: record.id, sort: childSort })
					},
					token
				);
				created++;
			}

			paths.set(`${top.slug}/${slug}`, { id: child?.id, color: top.color });
		}
	}

	console.log(`categories: ${created} created`);
	return paths;
}

async function createGuide(token, data, image) {
	const form = new FormData();
	for (const [key, value] of Object.entries(data)) {
		if (value !== undefined && value !== null) {
			form.append(key, typeof value === 'boolean' ? String(value) : value);
		}
	}

	if (image) {
		form.append('cover', new Blob([image], { type: 'image/png' }), 'cover.png');
	}

	return request('/api/collections/guides/records', { method: 'POST', body: form }, token);
}

async function main() {
	const { hostname } = new URL(URL_BASE);
	if (!['localhost', '127.0.0.1', '::1'].includes(hostname) && !flag('production')) {
		throw new Error(`Refusing to seed ${URL_BASE}: pass --production for a remote PocketBase.`);
	}

	if (!EMAIL || !PASSWORD) {
		throw new Error('Set PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD in packages/pocketbase/.env.');
	}

	const { token } = await request('/api/collections/_superusers/auth-with-password', {
		method: 'POST',
		body: JSON.stringify({ identity: EMAIL, password: PASSWORD })
	});
	if (RESET && !DRY_RUN) {
		const all = await request('/api/collections/guides/records?perPage=500&fields=id', {}, token);
		// Translations point at their root guide: delete them first.
		for (const item of all.items) {
			await request(
				`/api/collections/guides/records/${item.id}`,
				{ method: 'DELETE' },
				token
			).catch(() => null);
		}

		const left = await request('/api/collections/guides/records?perPage=500&fields=id', {}, token);
		for (const item of left.items) {
			await request(`/api/collections/guides/records/${item.id}`, { method: 'DELETE' }, token);
		}

		console.log(`guides: ${all.items.length} deleted`);
	}

	const writers = await authors(token);
	const tree = await categories(token);
	const existing = await request(
		'/api/collections/guides/records?perPage=500&fields=id,slug,language',
		{},
		token
	);
	const taken = (slug, language) =>
		existing.items.find((item) => item.slug === slug && item.language === language);
	let created = 0;
	const day = 86_400_000;
	for (const [index, guide] of GUIDES.entries()) {
		const category = tree.get(guide.category);
		const slug = slugify(guide.title);
		const author = writers[index % writers.length];
		const publishedAt = new Date(Date.now() - (GUIDES.length - index) * 3 * day).toISOString();
		let root = taken(slug, 'en');
		if (!root && !DRY_RUN) {
			root = await createGuide(
				token,
				{
					title: guide.title,
					slug,
					excerpt: guide.excerpt,
					body: guide.body,
					category: category?.id,
					language: 'en',
					status: guide.draft ? 'draft' : 'published',
					publishedAt: guide.draft ? undefined : publishedAt,
					noindex: false,
					author,
					updatedBy: author
				},
				index % 3 === 2 ? null : cover(category?.color ?? [100, 100, 100], index)
			);
			created++;
		}

		for (const [language, translation] of Object.entries(guide.translations ?? {})) {
			const translatedSlug = slugify(translation.title) || `${slug}-${language}`;
			if (taken(translatedSlug, language) || DRY_RUN || !root) {
				continue;
			}

			await createGuide(
				token,
				{
					title: translation.title,
					slug: translatedSlug,
					excerpt: translation.excerpt,
					body: translation.body,
					category: category?.id,
					language,
					status: 'published',
					publishedAt,
					noindex: false,
					translationOf: root.id,
					author,
					updatedBy: author
				},
				cover(category?.color ?? [100, 100, 100], index)
			);
			created++;
		}
	}

	console.log(`guides: ${created} created${DRY_RUN ? ' (dry run)' : ''}`);
}

main().catch((error) => {
	console.error(error.message);
	process.exit(1);
});
