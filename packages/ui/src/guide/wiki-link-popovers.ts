import type { Attachment } from 'svelte/attachments';
import { unlocalizedPath } from '@company-of-heroes/i18n';
import type { GameDocs } from '@company-of-heroes/game-data';
import type { DocRef } from '@company-of-heroes/game-data/types';
import { popoverEntry } from '../docs/docs-popover.context';
import type { InfoPopover } from '../statistics/info-popover.svelte';

/** Wiki pages that have a stats popover: units, upgrades and commanders (doctrines). */
const WIKI_LINK = /^\/wiki\/(units|upgrades|commanders)\/([a-z0-9-]+)\/?$/;

let docs: Promise<GameDocs> | null = null;

/** The game data (about 800 KB) loads once, on the first hover over a wiki link. */
function loadDocs(): Promise<GameDocs> {
	docs ??= import('@company-of-heroes/game-data').then(({ loadGameDocs }) => loadGameDocs());
	return docs;
}

function refFor(game: GameDocs, kind: string, slug: string): DocRef | undefined {
	if (kind === 'units') {
		return game.unitRef(slug);
	}

	if (kind === 'commanders') {
		return game.commanderRef(slug);
	}

	const upgrade = game.upgrades.get(slug);
	return upgrade && game.upgradeRef(upgrade);
}

/** The wiki link under the pointer, with what it points to. */
function wikiLink(
	target: EventTarget | null
): { anchor: HTMLAnchorElement; kind: string; slug: string } | null {
	const anchor = target instanceof Element ? target.closest('a') : null;
	if (!anchor) {
		return null;
	}

	const href = anchor.getAttribute('href') ?? '';
	const match = WIKI_LINK.exec(unlocalizedPath(href.split(/[?#]/)[0]));
	return match ? { anchor, kind: match[1], slug: match[2] } : null;
}

/**
 * Hovering a unit, upgrade or commander link in rendered guide text shows the wiki's stats
 * popover (icon, cost, stats); a click still follows the link to the detail page.
 */
export function wikiLinkPopovers(popover: InfoPopover): Attachment<HTMLElement> {
	return (element) => {
		let current: HTMLAnchorElement | null = null;

		const over = (event: PointerEvent) => {
			if (event.pointerType !== 'mouse') {
				return;
			}

			const link = wikiLink(event.target);
			if (!link || link.anchor === current) {
				return;
			}

			current = link.anchor;
			void loadDocs().then((game) => {
				const ref = refFor(game, link.kind, link.slug);
				const entry = ref && popoverEntry(ref);
				if (entry && current === link.anchor) {
					popover.hover(entry, link.anchor);
				}
			});
		};

		const out = (event: PointerEvent) => {
			const link = wikiLink(event.target);
			if (!link || link.anchor.contains(event.relatedTarget as Node | null)) {
				return;
			}

			current = null;
			popover.leave();
		};

		element.addEventListener('pointerover', over);
		element.addEventListener('pointerout', out);
		return () => {
			element.removeEventListener('pointerover', over);
			element.removeEventListener('pointerout', out);
		};
	};
}
