<script lang="ts">
	import { Button } from '@company-of-heroes/ui/button';
	import { PlayerCard } from '@company-of-heroes/ui/supporter';
	import type { PlayerCardData } from '@company-of-heroes/ui/supporter/types';
	import { tick, untrack } from 'svelte';
	import {
		CARD_LAYOUT_HEIGHT,
		CARD_LAYOUT_WIDTH,
		downloadPng,
		renderCardPng,
		saveUrl,
		uploadCardPng
	} from '$lib/card/render-card';
	import { CARD_REFRESH_MS, type CardImageState } from '$lib/card/size';
	import Seo from '$lib/components/seo/seo.svelte';
	import { href, useI18n } from '$lib/i18n';
	import { SITE_URL } from '$lib/site/urls';
	import DownloadSimpleIcon from 'phosphor-svelte/lib/DownloadSimpleIcon';
	import UserIcon from 'phosphor-svelte/lib/UserIcon';
	import type { PageData } from './$types';
	import CardShareCopy from './card-share-copy.svelte';

	let { data }: { data: PageData } = $props();
	const { t } = useI18n();

	const card = $derived(data.card);
	const pngPath = $derived(`/api/v1/players/${card.steamId}/card.png`);
	const filename = $derived(`coh1stats-card-${card.steamId}.png`);
	/** The hidden fixed-size copy the PNG is drawn from; only mounted while drawing. */
	let copy = $state<HTMLElement>();
	let drawing = $state(0);
	let downloading = $state(false);
	/** One drawing per card data: the owner's upload and the download share it. */
	let drawn: { card: PlayerCardData; png: Promise<Blob> } | null = null;

	async function render(): Promise<Blob> {
		drawing++;
		try {
			await tick();
			if (!copy) {
				throw new Error('The card copy is not mounted');
			}

			return await renderCardPng(copy);
		} finally {
			drawing--;
		}
	}

	function draw(): Promise<Blob> {
		if (drawn?.card !== card) {
			const png = render();
			drawn = { card, png };
			png.catch(() => {
				if (drawn?.png === png) {
					drawn = null;
				}
			});
		}

		return drawn.png;
	}

	function outdated(image: CardImageState): boolean {
		if (!image.stored || image.stored.hash !== image.hash) {
			return true;
		}

		return Date.now() - Date.parse(image.stored.updatedAt) > CARD_REFRESH_MS;
	}

	async function download() {
		downloading = true;
		try {
			downloadPng(await draw(), filename);
		} catch (error) {
			console.error('[card] could not draw the PNG', error);
			saveUrl(pngPath, filename);
		} finally {
			downloading = false;
		}
	}

	// The owner's browser keeps the shared PNG current: drawn and uploaded in the background.
	$effect(() => {
		const image = data.image;
		const steamId = card.steamId;
		if (!image || !outdated(image)) {
			return;
		}

		untrack(draw)
			.then((png) => uploadCardPng(steamId, png, image.hash))
			.catch((error) => console.error('[card] could not update the PNG', error));
	});
</script>

<Seo
	title={t('{alias} — Player card', { alias: card.alias })}
	description={t('Company of Heroes supporter card of {alias}: best ELO and rank per army.', {
		alias: card.alias
	})}
	type="profile"
	image={`${SITE_URL}${pngPath}`}
/>

<div class="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-8 sm:py-12">
	<PlayerCard {card} />
	<div class="flex flex-wrap items-center justify-end gap-2">
		<Button href={href(`/players/${card.steamId}`)} variant="secondary" size="sm">
			<UserIcon size={16} />
			{t('View profile')}
		</Button>
		<Button size="sm" loading={downloading} onclick={download}>
			<DownloadSimpleIcon size={16} />
			{t('Download PNG')}
		</Button>
	</div>
</div>

{#if drawing > 0}
	<div class="pointer-events-none fixed top-0 -left-[10000px]" aria-hidden="true" inert>
		<div
			bind:this={copy}
			class="overflow-hidden"
			style:width="{CARD_LAYOUT_WIDTH}px"
			style:height="{CARD_LAYOUT_HEIGHT}px"
		>
			<CardShareCopy {card} />
		</div>
	</div>
{/if}
