// Generates 50 distinct WWII-style service ribbons per faction (ribbon bars as worn on a uniform) into
// ../ribbons. Each faction has its own colours, signature pattern and devices. Then ranked series:
// the same ribbon with 1 to 5 devices for levels 1 to 5. Two batches of 25 singles and 3 series each.
// Every ribbon of a faction shares the same wide national edge stripes, so the faction reads at a
// glance; the files go into a folder per faction (`ribbons/americans/ribbon-001.svg`).
// Seeded, so running it again gives the same files. Run: node scripts/generate-ribbons.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'ribbons');
/** Ribbons per faction in the first batch; 4 factions plus the global set give 125. */
const PER_FACTION = 25;
/** Ranked series per faction, each with `LEVELS` ribbons (1 to 5 devices). */
const SERIES_PER_FACTION = 3;
/** Second batch, appended after the first so its numbers do not shift. */
const EXTRA_PER_FACTION = 25;
const EXTRA_SERIES_PER_FACTION = 3;
const LEVELS = 5;
const ROMAN = ['I', 'II', 'III', 'IV', 'V'];
const LEVEL_METALS = ['bronze', 'bronze', 'silver', 'silver', 'gold'];
const WIDTH = 70;
const HEIGHT = 20;
/** Dark line between a faction's edge stripes and the pattern. */
const EDGE_DIVIDER = 0.4;

let state = 20261011;
const rand = () => {
	state = (state * 1103515245 + 12345) % 2 ** 31;
	return state / 2 ** 31;
};
const pick = (list) => list[Math.floor(rand() * list.length)];
const round = (n) => Math.round(n * 100) / 100;

/** Ribbon colours; each faction draws from its own subset (see `FACTIONS`). */
const COLORS = {
	crimson: '#8f2232',
	red: '#c23b3b',
	navy: '#24406b',
	blue: '#3f6fb0',
	sky: '#7fb0d8',
	olive: '#56622e',
	green: '#2f5a34',
	khaki: '#b8924a',
	sand: '#cfb07a',
	gold: '#e0b23a',
	yellow: '#d9b43a',
	bone: '#e6dfcc',
	white: '#f4f1e8',
	silver: '#a9adb1',
	black: '#1c1c1c',
	purple: '#6b2d5c',
	orange: '#c8642a',
	brown: '#6b4226',
	feldgrau: '#5d6450',
	forest: '#34452c',
	slate: '#4d545c',
	rose: '#cf7792',
	bordeaux: '#5e1d2a',
	burgundy: '#6e1f2e',
	cream: '#efe6cf'
};

/** A colour from `pool` that differs from `previous` (neighbouring stripes never share a colour). */
const next = (pool, previous) => {
	let name = pick(pool);
	while (name === previous) {
		name = pick(pool);
	}

	return name;
};
const without = (pool, ...names) => pool.filter((name) => !names.includes(name));

/** Mirrors half a ribbon (outside edge → centre) into a full symmetric list of [colour, width]. */
const mirror = (half, centre) => [...half, centre, ...half.slice().reverse()];

// Each pattern gets the faction's colours and returns [colour name, relative width] from left to right.
const PATTERNS = {
	/** Wide symmetric bands, 3 to 9 stripes. */
	bands: (pool) => {
		const count = pick([1, 2, 2, 3, 3, 4]);
		const half = [];
		for (let i = 0; i < count; i++) {
			half.push([next(pool, half.at(-1)?.[0]), 1 + Math.floor(rand() * 4)]);
		}

		return mirror(half, [next(pool, half.at(-1)[0]), 2 + Math.floor(rand() * 6)]);
	},
	/** One field colour with thin edge stripes. */
	edged: (pool) => {
		const field = pick(pool);
		const edge = next(pool, field);
		const inner = rand() < 0.5 ? [[next(without(pool, field), edge), 0.6]] : [];
		return mirror([[edge, 1.4], [field, 0.6], ...inner], [field, 12]);
	},
	/** A field with a group of thin pinstripes in the centre. */
	pinstripes: (pool) => {
		const field = pick(pool);
		const pin = next(pool, field);
		const pins = pick([1, 2, 3]);
		const half = [[field, 10]];
		for (let i = 0; i < pins; i++) {
			if (i > 0) {
				half.push([field, 0.6]);
			}

			half.push([pin, 0.6]);
		}

		return mirror(half, [field, pins === 1 ? 0.8 : 1.2]);
	},
	/** Two-colour ribbon split down the middle, with a thin centre stripe. */
	split: (pool) => {
		const left = pick(pool);
		const right = next(pool, left);
		const centre = next(without(pool, left), right);
		return [
			[left, 14],
			[centre, 1.2],
			[right, 14]
		];
	},
	/** Asymmetric campaign ribbon: field with a flag-like stripe group left and right of centre. */
	campaign: (pool) => {
		const field = pick(pool);
		const a = next(pool, field);
		const b = next(without(pool, field), a);
		const c = next(without(pool, field), b);
		return [
			[field, 6],
			[a, 0.8],
			[b, 0.8],
			[c, 0.8],
			[field, 4],
			[a, 1.4],
			[field, 4],
			[c, 0.8],
			[a, 0.8],
			[b, 0.8],
			[field, 6]
		];
	},
	/** Several equal stripes of alternating colours. */
	striped: (pool) => {
		const a = pick(pool);
		const b = next(pool, a);
		const count = pick([5, 7, 9, 11]);
		const edge = rand() < 0.5 ? next(without(pool, b), a) : null;
		const stripes = Array.from({ length: count }, (_, i) => [i % 2 ? b : a, 1]);
		return edge ? [[edge, 0.6], ...stripes, [edge, 0.6]] : stripes;
	},
	/** US: field with navy, white and red flag stripes along both edges. */
	flag: (pool) => {
		const field = pick(without(pool, 'navy', 'white', 'red'));
		const centre = rand() < 0.5 ? [field, 1] : [next(without(pool, field), 'white'), 1.4];
		return mirror(
			[
				['navy', 1],
				['white', 0.5],
				['red', 0.5],
				['white', 0.5],
				[field, 9]
			],
			centre
		);
	},
	/** Wehrmacht: field-grey or dark green field with black and white edges. */
	fieldgrey: (pool) => {
		const field = pick(['feldgrau', 'forest', 'brown', 'feldgrau']);
		const [outer, inner] = rand() < 0.5 ? ['black', 'white'] : ['white', 'black'];
		const centre = rand() < 0.5 ? [field, 1] : [pick(without(pool, field, 'black', 'white')), 1.6];
		return mirror(
			[
				[outer, 1],
				[inner, 0.6],
				[field, 10]
			],
			centre
		);
	},
	/** British: a theatre star ribbon, a sand or khaki field with a three-colour centre. */
	theatre: (pool) => {
		const field = pick(['sand', 'khaki', 'navy', 'green', 'sand']);
		const middle = next(without(pool, field), field);
		const side = next(without(pool, field, middle), middle);
		return mirror(
			[
				[field, 10],
				[side, 1.4]
			],
			[middle, 2]
		);
	},
	/** British: Victory-medal rainbow, mirrored from a red centre. */
	rainbow: () => {
		const order = ['crimson', 'red', 'orange', 'gold', 'green', 'blue', 'purple'];
		const start = Math.floor(rand() * 2);
		const half = order
			.slice(start + 1)
			.reverse()
			.map((c) => [c, 1]);
		return mirror(half, [order[start], 1.4]);
	},
	/** Panzer Elite: black field piped in rose (the Panzer arm colour). */
	piped: (pool) => {
		const field = pick(['black', 'black', 'slate']);
		const pipe = pick(['rose', 'rose', 'silver']);
		const centre =
			rand() < 0.5 ? [field, 1] : [next(without(pool, field, pipe), pipe), pick([1.2, 2.4])];
		return mirror(
			[
				[pipe, 0.6],
				[field, 1.2],
				[pipe, 0.6],
				[field, 10]
			],
			centre
		);
	}
};

/** One block of ribbons per faction, in `raceId` order (0 US, 1 Wehrmacht, 2 British, 3 Panzer Elite), then global ones. */
const FACTIONS = [
	{
		raceId: 0,
		key: 'americans',
		/** Device that counts the level on ranked ribbons. */
		rank: 'star',
		colors: [
			'red',
			'white',
			'navy',
			'blue',
			'sky',
			'olive',
			'gold',
			'khaki',
			'orange',
			'green',
			'brown'
		],
		patterns: ['flag', 'flag', 'flag', 'campaign', 'campaign', 'bands', 'edged', 'striped'],
		/** Edge stripes on both sides, outside → in, in ribbon units. */
		edge: [
			['navy', 4.8],
			['white', 1.3],
			['red', 2.6],
			['white', 1.3]
		],
		/** Edge width (divider included) before the wide edges; only the duplicate check uses it. */
		legacyEdge: 4.8,
		devices: ['star', 'star', 'star', 'oak', 'v', 'arrowhead'],
		metals: ['bronze', 'bronze', 'silver', 'gold']
	},
	{
		raceId: 1,
		key: 'wehrmacht',
		/** Device that counts the level on ranked ribbons. */
		rank: 'pip',
		// No red in the pattern: the black-white-red edge alone marks the faction.
		colors: ['feldgrau', 'forest', 'black', 'white', 'yellow', 'silver', 'brown', 'bone', 'slate'],
		patterns: ['fieldgrey', 'fieldgrey', 'fieldgrey', 'edged', 'bands', 'pinstripes', 'split'],
		/** Edge stripes on both sides, outside → in, in ribbon units. */
		edge: [
			['black', 3.5],
			['white', 2.2],
			['red', 4.2]
		],
		/** Edge width (divider included) before the wide edges; only the duplicate check uses it. */
		legacyEdge: 4.8,
		devices: ['oak', 'swords', 'swords'],
		metals: ['silver', 'silver', 'gold']
	},
	{
		raceId: 2,
		key: 'british',
		/** Device that counts the level on ranked ribbons. */
		rank: 'rosette',
		colors: [
			'navy',
			'red',
			'sky',
			'sand',
			'khaki',
			'green',
			'purple',
			'gold',
			'black',
			'white',
			'crimson'
		],
		patterns: ['theatre', 'theatre', 'theatre', 'rainbow', 'bands', 'edged', 'split', 'campaign'],
		/** Edge stripes on both sides, outside → in, in ribbon units. */
		edge: [
			['khaki', 4.8],
			['crimson', 2.6],
			['navy', 1.9]
		],
		/** Edge width (divider included) before the wide edges; only the duplicate check uses it. */
		legacyEdge: 4.4,
		devices: ['oak', 'rosette', 'rosette'],
		metals: ['bronze', 'silver', 'silver']
	},
	{
		raceId: 3,
		key: 'panzer_elite',
		/** Device that counts the level on ranked ribbons. */
		rank: 'pip',
		colors: ['black', 'rose', 'slate', 'silver', 'white', 'bordeaux', 'feldgrau', 'navy'],
		patterns: ['piped', 'piped', 'piped', 'pinstripes', 'pinstripes', 'striped', 'edged', 'split'],
		/** Edge stripes on both sides, outside → in, in ribbon units. */
		edge: [
			['black', 4.8],
			['rose', 2.2],
			['black', 1.3],
			['rose', 1]
		],
		/** Edge width (divider included) before the wide edges; only the duplicate check uses it. */
		legacyEdge: 4,
		devices: ['swords', 'tank', 'tank', 'oak'],
		metals: ['silver', 'silver', 'gold']
	},
	{
		// Not tied to a faction; generated last so the faction ribbons keep their numbers.
		raceId: null,
		key: 'global',
		/** Device that counts the level on ranked ribbons. */
		rank: 'star',
		colors: [
			'crimson',
			'red',
			'navy',
			'blue',
			'sky',
			'olive',
			'green',
			'khaki',
			'gold',
			'white',
			'black',
			'purple',
			'orange',
			'brown'
		],
		patterns: ['bands', 'bands', 'edged', 'pinstripes', 'split', 'campaign', 'striped'],
		/** Edge stripes on both sides, outside → in, in ribbon units. */
		edge: [
			['gold', 4.8],
			['white', 1.3]
		],
		/** Edge width (divider included) before the wide edges; only the duplicate check uses it. */
		legacyEdge: 4.2,
		devices: ['star', 'oak', 'rosette'],
		metals: ['bronze', 'silver', 'gold']
	}
];
/** Width of a faction's edge stripes on one side, divider included. */
const edgeWidth = (faction) => faction.edge.reduce((sum, [, w]) => sum + w, 0) + EDGE_DIVIDER;

/** Turns [colour, weight] into absolute stripes across the ribbon, between edges `edge` wide. */
function layout(pattern, faction, edge = edgeWidth(faction)) {
	const merged = [];
	for (const [color, w] of pattern) {
		if (merged.at(-1)?.[0] === color) {
			merged.at(-1)[1] += w;
		} else {
			merged.push([color, w]);
		}
	}

	const total = merged.reduce((sum, [, w]) => sum + w, 0);
	let x = edge;
	return merged.map(([color, w]) => {
		const width = (w / total) * (WIDTH - 2 * edge);
		const stripe = { color, x: round(x), width: round(width) };
		x += width;
		return stripe;
	});
}

const METALS = {
	bronze: { light: '#f6c79a', mid: '#b4733a', deep: '#3f230b' },
	silver: { light: '#ffffff', mid: '#bfc5cc', deep: '#3d434a' },
	gold: { light: '#fff1bf', mid: '#d6a640', deep: '#4f3a0c' }
};

const star = (cx, r) =>
	`M${Array.from({ length: 10 }, (_, i) => {
		const deg = -90 + 36 * i;
		const radius = i % 2 ? r * 0.4 : r;
		return `${round(cx + radius * Math.cos((deg * Math.PI) / 180))},${round(HEIGHT / 2 + radius * Math.sin((deg * Math.PI) / 180))}`;
	}).join(' L')} Z`;

// Devices are pinned to the ribbon, centred on x.
const DEVICES = {
	star: (x, fill, deep) =>
		`<path d="${star(x, 4.4)}" fill="${fill}" stroke="${deep}" stroke-width="0.4" stroke-linejoin="round"/>`,
	oak: (x, fill, deep) =>
		`<g transform="translate(${round(x)} ${HEIGHT / 2})" fill="${fill}" stroke="${deep}" stroke-width="0.35">` +
		[-50, 0, 50]
			.map(
				(deg) =>
					`<path transform="rotate(${deg})" d="M0,0.5 Q-1.6,-0.8 -1.2,-2 Q-2.1,-2.6 -1.4,-3.6 Q-1.8,-4.6 -0.6,-4.8 Q0,-5.8 0.6,-4.8 Q1.8,-4.6 1.4,-3.6 Q2.1,-2.6 1.2,-2 Q1.6,-0.8 0,0.5 Z"/>`
			)
			.join('') +
		'<circle cx="-1.1" cy="2.2" r="1"/><circle cx="1.1" cy="2.2" r="1"/></g>',
	v: (x, fill, deep) =>
		`<path d="M${round(x - 3.6)},5 L${round(x - 1.8)},5 L${round(x)},12.4 L${round(x + 1.8)},5 L${round(x + 3.6)},5 L${round(x + 1)},15 L${round(x - 1)},15 Z" fill="${fill}" stroke="${deep}" stroke-width="0.4" stroke-linejoin="round"/>`,
	arrowhead: (x, fill, deep) =>
		`<path d="M${round(x)},4.2 L${round(x + 3.2)},13 L${round(x + 1)},12 L${round(x + 1)},15.8 L${round(x - 1)},15.8 L${round(x - 1)},12 L${round(x - 3.2)},13 Z" fill="${fill}" stroke="${deep}" stroke-width="0.4" stroke-linejoin="round"/>`,
	swords: (x, fill, deep) =>
		`<g transform="translate(${round(x)} ${HEIGHT / 2})" fill="${fill}" stroke="${deep}" stroke-width="0.3">` +
		[40, -40]
			.map(
				(deg) =>
					`<g transform="rotate(${deg})"><path d="M-0.6,-6.4 L0,-7.4 L0.6,-6.4 L0.6,3 L-0.6,3 Z"/><rect x="-2.2" y="3" width="4.4" height="0.9" rx="0.3"/><rect x="-0.45" y="3.9" width="0.9" height="2.4"/></g>`
			)
			.join('') +
		'</g>',
	rosette: (x, fill, deep) =>
		`<g transform="translate(${round(x)} ${HEIGHT / 2})" fill="${fill}" stroke="${deep}" stroke-width="0.35">` +
		Array.from(
			{ length: 8 },
			(_, i) => `<ellipse cy="-2.6" rx="1.3" ry="2" transform="rotate(${i * 45})"/>`
		).join('') +
		'<circle r="1.6"/></g>',
	/** Square rank pip, as on German shoulder boards. */
	pip: (x, fill, deep) =>
		`<g transform="translate(${round(x)} ${HEIGHT / 2}) rotate(45)" fill="${fill}" stroke="${deep}" stroke-width="0.35"><rect x="-2.6" y="-2.6" width="5.2" height="5.2" rx="0.4"/><rect x="-1.1" y="-1.1" width="2.2" height="2.2" fill="none"/></g>`,
	tank: (x, fill, deep) =>
		`<g transform="translate(${round(x)} ${HEIGHT / 2})" fill="${fill}" stroke="${deep}" stroke-width="0.3"><rect x="-6" y="0.6" width="12" height="3.4" rx="1.7"/><rect x="-4.8" y="-1.6" width="9.6" height="2.4" rx="0.5"/><rect x="-2.6" y="-4" width="5" height="2.6" rx="0.9"/><rect x="2" y="-3.3" width="5.4" height="0.9" rx="0.3"/></g>`
};

/** Optional device(s) from the faction's set; a third of the ribbons carry one, a few US ones two or three stars. */
function devices(faction) {
	if (rand() >= 0.35) {
		return null;
	}

	const kind = pick(faction.devices);
	const metal = kind === 'v' || kind === 'arrowhead' ? 'bronze' : pick(faction.metals);
	const count = kind === 'star' ? pick([1, 1, 2, 3]) : 1;
	return { kind, metal, count };
}

/** The faction's edge stripes on the left, mirrored on the right, each closed by a dark divider. */
function edges(faction) {
	const rects = [];
	let x = 0;
	for (const [color, w] of faction.edge) {
		rects.push([COLORS[color], x, w], [COLORS[color], WIDTH - x - w, w]);
		x += w;
	}

	const divider = [x, WIDTH - x - EDGE_DIVIDER].map(
		(dx) =>
			`<rect x="${round(dx)}" y="0" width="${EDGE_DIVIDER}" height="${HEIGHT}" fill="#000" fill-opacity="0.55"/>`
	);
	return [
		...rects.map(
			([fill, rx, w]) =>
				`<rect x="${round(rx)}" y="0" width="${round(w)}" height="${HEIGHT}" fill="${fill}"/>`
		),
		...divider
	].join('');
}

function ribbon(index, faction, spec) {
	const id = `r${String(index).padStart(3, '0')}`;
	const stripes = spec.stripes
		.map(
			(s) =>
				`<rect x="${s.x}" y="0" width="${s.width}" height="${HEIGHT}" fill="${COLORS[s.color]}"/>`
		)
		.join('');
	let pins = '';
	if (spec.device) {
		const metal = METALS[spec.device.metal];
		const gap = 10;
		const first = WIDTH / 2 - ((spec.device.count - 1) * gap) / 2;
		pins = `<g filter="url(#${id}-shadow)">${Array.from({ length: spec.device.count }, (_, i) =>
			DEVICES[spec.device.kind](first + i * gap, `url(#${id}-metal)`, metal.deep)
		).join('')}</g>`;
	}

	const metal = spec.device ? METALS[spec.device.metal] : null;
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}">
	<title>${spec.title}</title>
	<defs>
		<linearGradient id="${id}-shade" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0" stop-color="#fff" stop-opacity="0.28"/>
			<stop offset="0.25" stop-color="#fff" stop-opacity="0"/>
			<stop offset="0.7" stop-color="#000" stop-opacity="0"/>
			<stop offset="1" stop-color="#000" stop-opacity="0.35"/>
		</linearGradient>
		<pattern id="${id}-weave" width="1.2" height="1.2" patternUnits="userSpaceOnUse">
			<rect width="0.5" height="1.2" fill="#000" opacity="0.1"/>
		</pattern>${
			metal
				? `
		<linearGradient id="${id}-metal" x1="0" y1="0" x2="1" y2="1">
			<stop offset="0" stop-color="${metal.light}"/>
			<stop offset="1" stop-color="${metal.mid}"/>
		</linearGradient>
		<filter id="${id}-shadow" x="-20%" y="-20%" width="140%" height="140%">
			<feDropShadow dx="0" dy="0.6" stdDeviation="0.5" flood-color="#000" flood-opacity="0.6"/>
		</filter>`
				: ''
		}
	</defs>
	${edges(faction)}${stripes}
	<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#${id}-weave)"/>
	<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#${id}-shade)"/>
	<rect x="0.25" y="0.25" width="${WIDTH - 0.5}" height="${HEIGHT - 0.5}" fill="none" stroke="#000" stroke-opacity="0.45" stroke-width="0.5"/>
	${pins}
</svg>
`;
	return { id, svg };
}

function title(spec) {
	const main = [...new Set(spec.stripes.map((s) => s.color))].slice(0, 3);
	const colors = main.length > 1 ? `${main.slice(0, -1).join(', ')} and ${main.at(-1)}` : main[0];
	const name = `${colors[0].toUpperCase()}${colors.slice(1)} ${spec.pattern} ribbon`;
	if (!spec.device) {
		return name;
	}

	const { kind, metal, count } = spec.device;
	const device = {
		star: 'star',
		oak: 'oak leaf cluster',
		v: 'V device',
		arrowhead: 'arrowhead',
		swords: 'swords',
		rosette: 'rosette',
		tank: 'tank badge',
		pip: 'pip'
	}[kind];
	return `${name} with ${count > 1 ? `${count} ${metal} ${device}s` : `${metal} ${device}`}`;
}

// Old files: flat ones from before the faction folders, and every folder's ribbons.
fs.mkdirSync(OUT, { recursive: true });
for (const file of fs.readdirSync(OUT, { recursive: true })) {
	if (/^ribbon-\d+\.svg$/.test(path.basename(file))) {
		fs.unlinkSync(path.join(OUT, file));
	}
}

const seen = new Set();
const manifest = [];

/** Stripes for a faction that no other ribbon has yet. */
function uniqueStripes(faction) {
	while (true) {
		const pattern = pick(faction.patterns);
		const weights = PATTERNS[pattern](faction.colors);
		// Measured between the old narrow edges, so the same ribbons count as duplicates and
		// every ribbon keeps the centre it had before the wide edges.
		const key = layout(weights, faction, faction.legacyEdge)
			.map((s) => `${s.color}:${Math.round(s.width)}`)
			.join('/');
		if (!seen.has(key)) {
			seen.add(key);
			return { pattern, stripes: layout(weights, faction) };
		}
	}
}

function write(faction, spec, extra = {}) {
	const index = manifest.length + 1;
	const { id, svg } = ribbon(index, faction, spec);
	// The number stays unique across folders: rewards store `ribbon-NNN` without the folder.
	const file = `${faction.key}/ribbon-${String(index).padStart(3, '0')}.svg`;
	fs.mkdirSync(path.join(OUT, faction.key), { recursive: true });
	fs.writeFileSync(path.join(OUT, file), svg);
	manifest.push({
		id,
		file,
		title: spec.title,
		faction: faction.key,
		raceId: faction.raceId,
		pattern: spec.pattern,
		stripes: spec.stripes.map((s) => COLORS[s.color]),
		device: spec.device,
		...extra
	});
}

/** Writes one batch: `singles` ribbons per faction, then `seriesCount` ranked series per faction numbered from `firstSeries`. */
function batch(singles, seriesCount, firstSeries) {
	for (const faction of FACTIONS) {
		for (let made = 0; made < singles; made++) {
			const spec = { ...uniqueStripes(faction), device: devices(faction) };
			spec.title = title(spec);
			write(faction, spec);
		}
	}

	// Ranked series come after the single ribbons so those keep their numbers: one ribbon
	// with 1 to 5 of the faction's rank device, bronze → silver → gold as the level rises.
	for (const faction of FACTIONS) {
		for (let made = 0; made < seriesCount; made++) {
			const base = uniqueStripes(faction);
			const series = `${faction.key}-${firstSeries + made}`;
			for (let level = 1; level <= LEVELS; level++) {
				const spec = {
					...base,
					device: { kind: faction.rank, metal: LEVEL_METALS[level - 1], count: level }
				};
				spec.title = `${title({ ...base, device: null })}, level ${level}`;
				write(faction, spec, { series, level });
			}
		}
	}
}

// Later batches are appended, so ribbons already stored on rewards keep their file names.
batch(PER_FACTION, SERIES_PER_FACTION, 1);
batch(EXTRA_PER_FACTION, EXTRA_SERIES_PER_FACTION, SERIES_PER_FACTION + 1);

// Supporter ribbons come last and are built without the RNG, so ribbons 001 to 400 stay as they were.
const SUPPORTER = {
	raceId: null,
	key: 'supporter',
	edge: [
		['burgundy', 4.8],
		['gold', 1.9]
	]
};
const supporterSpecs = [
	...Array.from({ length: LEVELS }, (_, i) => ({
		title: `Supporter ${ROMAN[i]}`,
		pattern: 'pinstripes',
		stripes: [
			['burgundy', 10],
			['gold', 0.6],
			['cream', 1.2],
			['gold', 0.6],
			['burgundy', 10]
		],
		device: { kind: 'star', metal: LEVEL_METALS[i], count: i + 1 },
		extra: { series: 'supporter', level: i + 1 }
	})),
	{
		title: 'Founding Supporter',
		pattern: 'bands',
		stripes: [
			['gold', 3],
			['burgundy', 4],
			['cream', 2],
			['burgundy', 4],
			['gold', 3]
		],
		device: { kind: 'star', metal: 'gold', count: 1 }
	},
	{
		title: 'Supporter Service',
		pattern: 'edged',
		stripes: [
			['cream', 1.4],
			['burgundy', 12],
			['cream', 1.4]
		],
		device: null
	},
	{
		title: 'Supporter Honour',
		pattern: 'split',
		stripes: [
			['burgundy', 14],
			['gold', 1.2],
			['cream', 14]
		],
		device: { kind: 'oak', metal: 'gold', count: 1 }
	}
];
for (const { extra, stripes, ...spec } of supporterSpecs) {
	write(SUPPORTER, { ...spec, stripes: layout(stripes, SUPPORTER) }, extra);
}

fs.writeFileSync(path.join(OUT, 'ribbons.json'), `${JSON.stringify(manifest, null, '\t')}\n`);
console.log(`Wrote ${manifest.length} ribbons to ${OUT}`);
