import { initWasm, Resvg } from '@resvg/resvg-wasm';
import satori, { init as initSatori, type Font } from 'satori/standalone';
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm?module';
import yogaWasm from 'satori/yoga.wasm?module';
import nunitoRegular from '@fontsource/nunito-sans/files/nunito-sans-latin-400-normal.woff?inline';
import nunitoBold from '@fontsource/nunito-sans/files/nunito-sans-latin-800-normal.woff?inline';
import usFlag from '../../../../../shared-assets/factions/us.png?inline';
import wmFlag from '../../../../../shared-assets/factions/wm.png?inline';
import cwFlag from '../../../../../shared-assets/factions/cw.png?inline';
import peFlag from '../../../../../shared-assets/factions/pe.png?inline';
import medalSvg from '../../../../../shared-assets/supporter/medal.svg?raw';
import { labelHex, sortPlayerLabels } from '@company-of-heroes/ui/format/labels';
import { getRaceLabel } from '@company-of-heroes/ui/format/player-format';
import { LEADERBOARD_MODES } from '@company-of-heroes/ui/leaderboard/modes';
import type { PlayerCardData, PlayerCardFaction } from '@company-of-heroes/ui/supporter/types';

/** Open Graph size. */
export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

/** Theme colours (`ui/theme.css`) as hex: satori and resvg do not read oklch. */
const COLOR = {
	background: '#131315',
	panel: '#1b1b1e',
	line: '#3a3a3d',
	muted: '#929295',
	soft: '#adadb0',
	text: '#ffffff',
	primary: '#fec766'
};

const FLAGS: Record<number, string> = { 0: usFlag, 1: wmFlag, 2: cwFlag, 3: peFlag };

/** Ribbon SVGs load on demand: one module each, so only the five on a card are read. */
const ribbonSvgs = import.meta.glob<string>('../../../../../shared-assets/ribbons/*.svg', {
	query: '?raw',
	import: 'default'
});

type Node = { type: string; props: Record<string, unknown> & { children?: unknown } };

function h(type: string, style: Record<string, unknown>, children?: unknown, extra = {}): Node {
	return { type, props: { style, children, ...extra } };
}

function img(
	src: string,
	width: number,
	height: number,
	style: Record<string, unknown> = {}
): Node {
	return { type: 'img', props: { src, width, height, style: { width, height, ...style } } };
}

/** Wasm and fonts are set up once per isolate. */
let ready: Promise<Font[]> | null = null;

function dataUrlBytes(url: string): ArrayBuffer {
	const binary = atob(url.slice(url.indexOf(',') + 1));
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}

	return bytes.buffer;
}

function base64(bytes: Uint8Array): string {
	let binary = '';
	for (let i = 0; i < bytes.length; i += 0x8000) {
		binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	}

	return btoa(binary);
}

function svgDataUrl(svg: string): string {
	return `data:image/svg+xml;base64,${base64(new TextEncoder().encode(svg))}`;
}

function setup(): Promise<Font[]> {
	ready ??= Promise.all([initWasm(resvgWasm), initSatori(yogaWasm)])
		.then((): Font[] => [
			{ name: 'Nunito Sans', data: dataUrlBytes(nunitoRegular), weight: 400, style: 'normal' },
			{ name: 'Nunito Sans', data: dataUrlBytes(nunitoBold), weight: 800, style: 'normal' }
		])
		.catch((error) => {
			ready = null;
			throw error;
		});
	return ready;
}

/** The Steam avatar as a data URL; null when it is missing or does not load in time. */
async function loadAvatar(url: string | null, fetcher: typeof fetch): Promise<string | null> {
	if (!url) {
		return null;
	}

	try {
		const response = await fetcher(url, { signal: AbortSignal.timeout(4000) });
		const type = response.headers.get('content-type') ?? '';
		if (!response.ok || !/^image\/(jpeg|png)/.test(type)) {
			return null;
		}

		return `data:${type.split(';')[0]};base64,${base64(new Uint8Array(await response.arrayBuffer()))}`;
	} catch {
		return null;
	}
}

async function loadRibbons(keys: string[]): Promise<string[]> {
	const svgs = await Promise.all(
		keys.map((key) => {
			const load = Object.entries(ribbonSvgs).find(([path]) => path.endsWith(`/${key}.svg`))?.[1];
			return load ? load().catch(() => null) : Promise.resolve(null);
		})
	);
	return svgs.flatMap((svg) => (svg ? [svgDataUrl(svg)] : []));
}

function modeLabel(leaderboardId: number | null): string | null {
	return (
		LEADERBOARD_MODES.find(
			(mode) =>
				leaderboardId !== null && leaderboardId >= mode.value && leaderboardId < mode.value + 4
		)?.label ?? null
	);
}

function monthYear(iso: string): string | null {
	const date = new Date(iso);
	return Number.isNaN(date.getTime())
		? null
		: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function avatarNode(alias: string, avatar: string | null): Node {
	const frame = {
		width: 176,
		height: 176,
		borderRadius: 12,
		border: `3px solid ${COLOR.primary}`
	};
	if (avatar) {
		return img(avatar, 176, 176, { ...frame, objectFit: 'cover' });
	}

	return h(
		'div',
		{
			...frame,
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			backgroundColor: COLOR.panel,
			color: COLOR.primary,
			fontSize: 88,
			fontWeight: 800
		},
		(alias.trim()[0] ?? '?').toUpperCase()
	);
}

function factionNode(faction: PlayerCardFaction, last: boolean): Node {
	const mode = modeLabel(faction.leaderboardId);
	const rank = faction.rank !== null ? `Rank #${faction.rank}${mode ? ` · ${mode}` : ''}` : null;
	const unranked = faction.elo === null && rank === null;
	return h(
		'div',
		{
			display: 'flex',
			flexDirection: 'column',
			flex: 1,
			padding: '22px 28px',
			gap: 10,
			borderRight: last ? 'none' : `1px solid ${COLOR.line}`
		},
		[
			h('div', { display: 'flex', alignItems: 'center', gap: 12 }, [
				img(FLAGS[faction.raceId], 40, 24, { borderRadius: 3 }),
				h('div', { color: COLOR.soft, fontSize: 22 }, getRaceLabel(faction.raceId))
			]),
			h(
				'div',
				{
					display: 'flex',
					color: unranked ? COLOR.muted : COLOR.text,
					fontSize: 40,
					fontWeight: 800
				},
				unranked
					? 'Unranked'
					: faction.elo !== null
						? `${faction.elo} ELO`
						: `Rank #${faction.rank}`
			),
			h(
				'div',
				{ display: 'flex', color: COLOR.muted, fontSize: 20 },
				unranked
					? 'No ranked games'
					: faction.elo !== null
						? (rank ?? 'No ladder rank')
						: (mode ?? '')
			)
		]
	);
}

function cardNode(data: PlayerCardData, avatar: string | null, ribbons: string[]): Node {
	const since = monthYear(data.supporterSince);
	const months = data.supporterMonths === 1 ? '1 month' : `${data.supporterMonths} months`;
	const labels = sortPlayerLabels(data.labels).slice(0, 4);
	const record =
		data.winRate !== null
			? `${Math.round(data.winRate * 100)}% win rate · ${data.matches} ranked games`
			: 'Unranked';
	return h(
		'div',
		{
			width: CARD_WIDTH,
			height: CARD_HEIGHT,
			display: 'flex',
			flexDirection: 'column',
			backgroundColor: COLOR.background,
			color: COLOR.text,
			fontFamily: 'Nunito Sans',
			borderTop: `6px solid ${COLOR.primary}`
		},
		[
			h('div', { display: 'flex', alignItems: 'center', gap: 40, padding: '48px 56px 40px' }, [
				avatarNode(data.alias, avatar),
				h('div', { display: 'flex', flexDirection: 'column', flex: 1, gap: 14, minWidth: 0 }, [
					h('div', { display: 'flex', alignItems: 'center', gap: 12 }, [
						img(svgDataUrl(medalSvg), 22, 40),
						h(
							'div',
							{ color: COLOR.primary, fontSize: 24, fontWeight: 800, letterSpacing: 1 },
							`SUPPORTER · ${months.toUpperCase()}`
						)
					]),
					h(
						'div',
						{
							display: 'block',
							fontSize: 68,
							fontWeight: 800,
							lineHeight: 1.1,
							maxWidth: 840,
							overflow: 'hidden',
							whiteSpace: 'nowrap',
							textOverflow: 'ellipsis'
						},
						data.alias
					),
					labels.length > 0
						? h(
								'div',
								{ display: 'flex', gap: 8 },
								labels.map((label) =>
									h(
										'div',
										{
											display: 'flex',
											padding: '3px 12px',
											borderRadius: 6,
											fontSize: 18,
											fontWeight: 800,
											color: labelHex(label.color),
											border: `1px solid ${labelHex(label.color)}`
										},
										label.name
									)
								)
							)
						: h('div', { display: 'flex' }, [])
				])
			]),
			h(
				'div',
				{
					display: 'flex',
					borderTop: `1px solid ${COLOR.line}`,
					borderBottom: `1px solid ${COLOR.line}`,
					backgroundColor: COLOR.panel
				},
				data.factions.map((faction, index) =>
					factionNode(faction, index === data.factions.length - 1)
				)
			),
			h(
				'div',
				{
					display: 'flex',
					flex: 1,
					alignItems: 'center',
					justifyContent: 'space-between',
					padding: '0 56px'
				},
				[
					h('div', { display: 'flex', flexDirection: 'column', gap: 6 }, [
						h('div', { display: 'flex', fontSize: 28, fontWeight: 800 }, record),
						h(
							'div',
							{ display: 'flex', color: COLOR.muted, fontSize: 20 },
							since ? `Supporter since ${since} · coh1stats.com` : 'coh1stats.com'
						)
					]),
					h(
						'div',
						{ display: 'flex', gap: 10 },
						ribbons.map((src) => img(src, 105, 30, { borderRadius: 2 }))
					)
				]
			)
		]
	);
}

/** The supporter card as a 1200×630 PNG (satori lays it out, resvg rasterizes it). */
export async function renderCardPng(
	data: PlayerCardData,
	options: { fetch: typeof fetch }
): Promise<Uint8Array> {
	const [fonts, avatar, ribbons] = await Promise.all([
		setup(),
		loadAvatar(data.avatarUrl, options.fetch),
		loadRibbons(data.ribbons.map((ribbon) => ribbon.key))
	]);
	const svg = await satori(cardNode(data, avatar, ribbons), {
		width: CARD_WIDTH,
		height: CARD_HEIGHT,
		fonts
	});
	const resvg = new Resvg(svg, { fitTo: { mode: 'original' } });
	try {
		const image = resvg.render();
		try {
			return image.asPng();
		} finally {
			image.free();
		}
	} finally {
		resvg.free();
	}
}
