// Generates 100 distinct WWII-style medals (ribbon + suspension + medal + emblem) into ../medals.
// Seeded, so running it again gives the same files. Run: node scripts/generate-medals.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'medals');
const COUNT = 100;

let state = 20260408;
const rand = () => {
	state = (state * 1103515245 + 12345) % 2 ** 31;
	return state / 2 ** 31;
};
const pick = (list) => list[Math.floor(rand() * list.length)];
const round = (n) => Math.round(n * 100) / 100;

const METALS = {
	gold: { light: '#fff1bf', mid: '#d6a640', dark: '#86601a', deep: '#4f3a0c' },
	silver: { light: '#ffffff', mid: '#bfc5cc', dark: '#6b737c', deep: '#3d434a' },
	bronze: { light: '#f6c79a', mid: '#b4733a', dark: '#6b3d18', deep: '#3f230b' }
};

const ENAMELS = {
	red: '#a3202f',
	blue: '#1f4f9a',
	green: '#2f6b3a',
	white: '#ece8dc',
	navy: '#1b2a4a'
};

/** Service-ribbon colours. */
const RIBBON = [
	'#8f2232', // crimson
	'#c23b3b', // red
	'#24406b', // navy
	'#3f6fb0', // blue
	'#56622e', // olive
	'#2f5a34', // green
	'#b8924a', // khaki
	'#e0b23a', // gold
	'#e6dfcc', // bone
	'#f4f1e8', // white
	'#1c1c1c', // black
	'#6b2d5c', // purple
	'#c8642a' // orange
];

// Shapes are drawn around (0, 0) with a radius of about 25.
const polar = (r, deg) => [
	r * Math.cos((deg * Math.PI) / 180),
	r * Math.sin((deg * Math.PI) / 180)
];
const poly = (points) => `M${points.map(([x, y]) => `${round(x)},${round(y)}`).join(' L')} Z`;
const rotate = ([x, y], quarter) => {
	for (let i = 0; i < quarter; i++) {
		[x, y] = [-y, x];
	}

	return [x, y];
};
const fourArms = (arm) => poly([0, 1, 2, 3].flatMap((q) => arm.map((p) => rotate(p, q))));
const regular = (sides, r, offset = -90) =>
	poly(Array.from({ length: sides }, (_, i) => polar(r, offset + (360 / sides) * i)));
const star = (spikes, outer, inner) =>
	poly(
		Array.from({ length: spikes * 2 }, (_, i) =>
			polar(i % 2 ? inner : outer, -90 + (180 / spikes) * i)
		)
	);

const SHAPES = {
	disc: { d: 'M-24,0 A24,24 0 1 0 24,0 A24,24 0 1 0 -24,0 Z', centre: false },
	oval: { d: 'M-20,0 A20,26 0 1 0 20,0 A20,26 0 1 0 -20,0 Z', centre: false },
	star: { d: star(5, 28, 12), centre: true },
	burst: { d: star(16, 27, 19), centre: true },
	cross: {
		d: fourArms([
			[-12, -26],
			[12, -26],
			[5, -5]
		]),
		centre: true
	},
	maltese: {
		d: fourArms([
			[-13, -26],
			[0, -18],
			[13, -26],
			[3, -3]
		]),
		centre: true
	},
	shield: { d: 'M-21,-24 H21 V0 Q21,17 0,28 Q-21,17 -21,0 Z', centre: false },
	hexagon: { d: regular(6, 26), centre: false },
	octagon: { d: regular(8, 25, -67.5), centre: false },
	diamond: {
		d: poly([
			[0, -29],
			[22, 0],
			[0, 29],
			[-22, 0]
		]),
		centre: true
	}
};

// Emblems are drawn around (0, 0) inside a radius of about 10.
const EMBLEMS = {
	star: () => `<path d="${star(5, 9.5, 3.8)}"/>`,
	wreath: () => {
		const leaves = [];
		for (const side of [-1, 1]) {
			// Laurel branches joined at the bottom, open at the top.
			for (let i = 0; i < 5; i++) {
				const angle = 100 + i * 32;
				const [x, y] = polar(9.5, side === 1 ? 180 - angle : angle);
				const tilt = side === 1 ? 180 - angle : angle;
				leaves.push(
					`<ellipse cx="${round(x)}" cy="${round(y)}" rx="1.2" ry="2.8" transform="rotate(${round(tilt)} ${round(x)} ${round(y)})"/>`
				);
			}

			leaves.push(
				`<path d="M${side},9.5 A9.5,9.5 0 0 ${side === 1 ? 0 : 1} ${side * 9.3},-2" fill="none" stroke="currentColor" stroke-width="0.8"/>`
			);
		}

		return `${leaves.join('')}<path d="${star(5, 4.2, 1.7)}"/>`;
	},
	swords: () =>
		[45, -45]
			.map(
				(deg) =>
					`<g transform="rotate(${deg})"><path d="M-1.1,-11 L0,-12.8 L1.1,-11 L1.1,5 L-1.1,5 Z"/><rect x="-4" y="5" width="8" height="1.6" rx="0.6"/><rect x="-0.8" y="6.6" width="1.6" height="4"/><circle cx="0" cy="11.4" r="1.2"/></g>`
			)
			.join(''),
	chevrons: () =>
		[-5, 0, 5]
			.map(
				(y) =>
					`<path d="M-9,${y + 2} L0,${y - 4} L9,${y + 2} L9,${y + 5} L0,${y - 1} L-9,${y + 5} Z"/>`
			)
			.join(''),
	helmet: () =>
		'<path d="M-10,3 Q-10,-9 0,-9 Q10,-9 10,3 L13,4.5 L13,6 L-13,6 L-13,4.5 Z"/><rect x="-7" y="7.5" width="14" height="1.2" rx="0.6"/>',
	tank: () =>
		'<rect x="-11" y="2" width="22" height="6" rx="3"/><rect x="-9" y="-2.5" width="18" height="4" rx="1"/><rect x="-5" y="-7" width="9" height="4.5" rx="1.5"/><rect x="3" y="-5.6" width="10" height="1.6" rx="0.5"/>',
	parachute: () =>
		'<path d="M-11,-1 Q-11,-11 0,-11 Q11,-11 11,-1 Q8,-3 5.5,-1 Q3,-3 0,-1 Q-3,-3 -5.5,-1 Q-8,-3 -11,-1 Z"/><path d="M-11,-1 L-1,8 M11,-1 L1,8 M-5.5,-1 L-0.5,8 M5.5,-1 L0.5,8" fill="none" stroke="currentColor" stroke-width="0.7"/><rect x="-1.6" y="7.5" width="3.2" height="3.5" rx="1"/>',
	crosshair: () =>
		'<circle r="7.5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle r="1.6"/><rect x="-0.7" y="-11" width="1.4" height="6"/><rect x="-0.7" y="5" width="1.4" height="6"/><rect x="-11" y="-0.7" width="6" height="1.4"/><rect x="5" y="-0.7" width="6" height="1.4"/>',
	shell: () =>
		'<path d="M-3.5,-4 Q-3.5,-11 0,-12 Q3.5,-11 3.5,-4 Z"/><rect x="-3.5" y="-3" width="7" height="10"/><rect x="-4.2" y="7.5" width="8.4" height="3" rx="0.6"/>',
	oak: () =>
		'<path d="M0,10 L0,-2"  fill="none" stroke="currentColor" stroke-width="1"/>' +
		[-38, 0, 38]
			.map(
				(deg) =>
					`<path transform="rotate(${deg} 0 0)" d="M0,-1 Q-3.5,-3 -2.5,-5 Q-4.5,-6 -3,-8 Q-4,-10 -1.5,-10.5 Q0,-13 1.5,-10.5 Q4,-10 3,-8 Q4.5,-6 2.5,-5 Q3.5,-3 0,-1 Z"/>`
			)
			.join('') +
		'<ellipse cx="-3" cy="4" rx="1.8" ry="2.2"/><ellipse cx="3" cy="4" rx="1.8" ry="2.2"/>',
	numeral: () => {
		const n = pick(['I', 'II', 'III', 'IV', 'V']);
		return `<text y="5" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="${n.length > 2 ? 11 : 14}">${n}</text>`;
	},
	torch: () =>
		'<path d="M0,-12 Q4,-8 2.5,-5 Q4,-6 3.5,-3 L-3.5,-3 Q-4,-7 -1,-8 Q-2,-10 0,-12 Z"/><path d="M-3.5,-2 L3.5,-2 L1.5,11 L-1.5,11 Z"/>'
};

/** A symmetric ribbon of 3, 5, 7 or 9 stripes across 40 units. */
function ribbonStripes() {
	const half = pick([1, 2, 2, 3, 3, 4]);
	const colors = [];
	while (colors.length < half + 1) {
		const color = pick(RIBBON);
		if (colors.at(-1) !== color) {
			colors.push(color);
		}
	}

	const widths = colors.map(() => 1 + Math.floor(rand() * 4));
	const stripes = [
		...colors.slice(0, -1).map((c, i) => [c, widths[i]]),
		[colors.at(-1), widths.at(-1) * 1.5]
	];
	const full = [...stripes, ...stripes.slice(0, -1).reverse()];
	const total = full.reduce((sum, [, w]) => sum + w, 0);
	let x = 12;
	return full.map(([color, w]) => {
		const width = (w / total) * 40;
		const stripe = { color, x: round(x), width: round(width) };
		x += width;
		return stripe;
	});
}

const RIBBON_SHAPES = {
	vcut: '12,0 52,0 52,40 32,47 12,40',
	straight: '12,0 52,0 52,44 12,44',
	tapered: '12,0 52,0 42,46 22,46',
	swallow: '12,0 52,0 52,46 32,38 12,46'
};

const SUSPENSIONS = ['ring', 'bar', 'ball', 'loop'];

function suspension(kind, id, ribbonBottom, deep) {
	const metal = `url(#${id}-rim)`;
	if (kind === 'bar') {
		return `<rect x="20" y="${ribbonBottom - 2}" width="24" height="6" rx="1.5" fill="${metal}" stroke="${deep}" stroke-width="0.8"/><circle cx="32" cy="${ribbonBottom + 7}" r="3" fill="none" stroke="${metal}" stroke-width="1.8"/>`;
	}

	if (kind === 'ball') {
		return `<circle cx="32" cy="${ribbonBottom + 1}" r="3.4" fill="url(#${id}-metal)" stroke="${deep}" stroke-width="0.6"/><circle cx="32" cy="${ribbonBottom + 7}" r="2.6" fill="none" stroke="${metal}" stroke-width="1.6"/>`;
	}

	if (kind === 'loop') {
		return `<ellipse cx="32" cy="${ribbonBottom + 4}" rx="6" ry="4.5" fill="none" stroke="${metal}" stroke-width="2"/>`;
	}

	return `<circle cx="32" cy="${ribbonBottom + 4}" r="4" fill="none" stroke="${metal}" stroke-width="2"/>`;
}

function medal(index, spec) {
	const id = `m${String(index).padStart(3, '0')}`;
	const metal = METALS[spec.metal];
	const shape = SHAPES[spec.shape];
	const enamel = spec.enamel ? ENAMELS[spec.enamel] : null;
	const ribbonBottom = spec.ribbon === 'straight' ? 44 : spec.ribbon === 'swallow' ? 42 : 46;
	const cy = 84;
	const emblemColor = enamel && !shape.centre && spec.enamel !== 'white' ? metal.light : metal.deep;
	const emblemScale = shape.centre ? 0.78 : 1.15;

	const body = [
		`<path d="${shape.d}" fill="url(#${id}-metal)" stroke="${metal.deep}" stroke-width="1"/>`,
		enamel
			? `<path d="${shape.d}" transform="scale(${shape.centre ? 0.8 : 0.72})" fill="${enamel}" stroke="${metal.dark}" stroke-width="1"/><path d="${shape.d}" transform="scale(${shape.centre ? 0.8 : 0.72})" fill="url(#${id}-gloss)"/>`
			: `<path d="${shape.d}" transform="scale(0.82)" fill="none" stroke="${metal.dark}" stroke-width="0.9" opacity="0.8"/>`,
		shape.centre
			? `<circle r="11" fill="url(#${id}-metal)" stroke="${metal.deep}" stroke-width="0.8"/><circle r="9.2" fill="none" stroke="${metal.dark}" stroke-width="0.6"/>`
			: ''
	].join('');

	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 116" width="64" height="116">
	<title>${spec.title}</title>
	<defs>
		<radialGradient id="${id}-metal" cx="35%" cy="28%" r="80%">
			<stop offset="0" stop-color="${metal.light}"/>
			<stop offset="0.5" stop-color="${metal.mid}"/>
			<stop offset="1" stop-color="${metal.dark}"/>
		</radialGradient>
		<linearGradient id="${id}-rim" x1="0" y1="0" x2="1" y2="1">
			<stop offset="0" stop-color="${metal.light}"/>
			<stop offset="1" stop-color="${metal.dark}"/>
		</linearGradient>
		<linearGradient id="${id}-gloss" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0" stop-color="#fff" stop-opacity="0.35"/>
			<stop offset="0.45" stop-color="#fff" stop-opacity="0"/>
		</linearGradient>
		<linearGradient id="${id}-fold" x1="0" y1="0" x2="1" y2="0">
			<stop offset="0" stop-color="#000" stop-opacity="0.35"/>
			<stop offset="0.2" stop-color="#000" stop-opacity="0"/>
			<stop offset="0.8" stop-color="#000" stop-opacity="0"/>
			<stop offset="1" stop-color="#000" stop-opacity="0.35"/>
		</linearGradient>
		<pattern id="${id}-weave" width="1.6" height="1.6" patternUnits="userSpaceOnUse">
			<rect width="0.6" height="1.6" fill="#000" opacity="0.12"/>
		</pattern>
		<clipPath id="${id}-ribbon"><polygon points="${RIBBON_SHAPES[spec.ribbon]}"/></clipPath>
		<filter id="${id}-shadow" x="-30%" y="-30%" width="160%" height="160%">
			<feDropShadow dx="0" dy="1.5" stdDeviation="1.2" flood-color="#000" flood-opacity="0.55"/>
		</filter>
	</defs>
	<g>
		<g clip-path="url(#${id}-ribbon)">
			${spec.stripes.map((s) => `<rect x="${s.x}" y="0" width="${s.width}" height="48" fill="${s.color}"/>`).join('')}
			<rect x="12" y="0" width="40" height="48" fill="url(#${id}-weave)"/>
			<rect x="12" y="0" width="40" height="48" fill="url(#${id}-fold)"/>
		</g>
		${suspension(spec.suspension, id, ribbonBottom, metal.deep)}
		<g transform="translate(32 ${cy})" filter="url(#${id}-shadow)">
			${body}
			<g transform="scale(${emblemScale})" fill="${emblemColor}" color="${emblemColor}">${spec.emblemSvg}</g>
		</g>
	</g>
</svg>
`;
	return { id, svg };
}

function title(spec) {
	const shape = {
		disc: 'medal',
		oval: 'oval medal',
		star: 'star',
		burst: 'sunburst',
		cross: 'cross',
		maltese: 'Maltese cross',
		shield: 'shield',
		hexagon: 'hexagon',
		octagon: 'octagon',
		diamond: 'diamond'
	}[spec.shape];
	const enamel = spec.enamel ? `${spec.enamel} enamel ` : '';
	return `${spec.metal[0].toUpperCase()}${spec.metal.slice(1)} ${enamel}${shape} with ${spec.emblem}`;
}

fs.mkdirSync(OUT, { recursive: true });
for (const file of fs.readdirSync(OUT)) {
	if (/^medal-\d+\.svg$/.test(file)) {
		fs.unlinkSync(path.join(OUT, file));
	}
}

const seen = new Set();
const manifest = [];
while (manifest.length < COUNT) {
	const shape = pick(Object.keys(SHAPES));
	const spec = {
		metal: pick(Object.keys(METALS)),
		shape,
		// Crosses only get colour enamel, never black (no Iron Cross look-alikes).
		enamel: rand() < 0.45 ? pick(Object.keys(ENAMELS)) : null,
		emblem: pick(Object.keys(EMBLEMS)),
		ribbon: pick(Object.keys(RIBBON_SHAPES)),
		suspension: pick(SUSPENSIONS)
	};
	const key = `${spec.metal}/${spec.shape}/${spec.enamel}/${spec.emblem}`;
	if (seen.has(key)) {
		continue;
	}

	seen.add(key);
	spec.stripes = ribbonStripes();
	spec.emblemSvg = EMBLEMS[spec.emblem]();
	spec.title = title(spec);
	const index = manifest.length + 1;
	const { id, svg } = medal(index, spec);
	const file = `medal-${String(index).padStart(3, '0')}.svg`;
	fs.writeFileSync(path.join(OUT, file), svg);
	manifest.push({
		id,
		file,
		title: spec.title,
		metal: spec.metal,
		shape: spec.shape,
		enamel: spec.enamel,
		emblem: spec.emblem,
		ribbon: { shape: spec.ribbon, stripes: spec.stripes.map((s) => s.color) },
		suspension: spec.suspension
	});
}

fs.writeFileSync(path.join(OUT, 'medals.json'), `${JSON.stringify(manifest, null, '\t')}\n`);
console.log(`Wrote ${manifest.length} medals to ${OUT}`);
