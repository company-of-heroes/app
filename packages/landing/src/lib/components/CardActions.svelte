<script lang="ts">
	import type { PlayerCardData } from '$lib/player-card.svelte';
	import { cn, interactive } from '$lib/cn';
	import { inlineImagesForExport } from '$lib/inline-images';
	import { SITE_URL } from '$lib/urls';
	import DownloadSimpleIcon from 'phosphor-svelte/lib/DownloadSimple';
	import LinkIcon from 'phosphor-svelte/lib/Link';
	import ShareNetworkIcon from 'phosphor-svelte/lib/ShareNetwork';

	type Props = {
		cardElement: HTMLElement | null;
		data: PlayerCardData;
	};

	let { cardElement, data }: Props = $props();

	let copying = $state(false);
	let downloading = $state(false);
	let statusMessage = $state<string | null>(null);

	const shareUrl = $derived(`${SITE_URL}/card/${data.steamId}`);

	async function downloadPng() {
		if (!cardElement) {
			return;
		}

		downloading = true;
		statusMessage = null;

		try {
			const { toPng } = await import('html-to-image');
			const restoreImages = await inlineImagesForExport(cardElement);

			try {
				const dataUrl = await toPng(cardElement, {
					pixelRatio: 2
				});

				const link = document.createElement('a');
				link.download = `${data.alias.replace(/[^\w.-]+/g, '_')}-coh-card.png`;
				link.href = dataUrl;
				link.click();
				statusMessage = 'Card downloaded.';
			} finally {
				restoreImages();
			}
		} catch {
			statusMessage = 'Could not export the card image.';
		} finally {
			downloading = false;
		}
	}

	async function copyLink() {
		copying = true;
		statusMessage = null;

		try {
			await navigator.clipboard.writeText(shareUrl);
			statusMessage = 'Link copied to clipboard.';
		} catch {
			statusMessage = 'Could not copy the link.';
		} finally {
			copying = false;
		}
	}

	async function shareCard() {
		if (!navigator.share) {
			await copyLink();
			return;
		}

		try {
			await navigator.share({
				title: `${data.alias} — Company of Heroes Companion`,
				text: 'Check out my Company of Heroes player card.',
				url: shareUrl
			});
			statusMessage = 'Share dialog opened.';
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') {
				return;
			}
			statusMessage = 'Could not open the share dialog.';
		}
	}
</script>

<div class="flex w-full max-w-4xl flex-col items-center gap-3">
	<div class="flex flex-wrap items-center justify-center gap-3">
		<button
			type="button"
			class={cn(
				interactive,
				'border-primary/30 bg-primary/10 text-primary-100 hover:bg-primary/20 inline-flex items-center rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60'
			)}
			disabled={!cardElement || downloading}
			onclick={downloadPng}
		>
			<DownloadSimpleIcon size={18} weight="duotone" class="mr-2" />
			{downloading ? 'Exporting…' : 'Download PNG'}
		</button>
		<button
			type="button"
			class={cn(
				interactive,
				'border-secondary-700 bg-secondary-800/40 text-secondary-100 hover:bg-secondary-800/70 inline-flex items-center rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60'
			)}
			disabled={copying}
			onclick={copyLink}
		>
			<LinkIcon size={18} weight="duotone" class="mr-2" />
			{copying ? 'Copying…' : 'Copy link'}
		</button>
		<button
			type="button"
			class={cn(
				interactive,
				'border-secondary-700 bg-secondary-800/40 text-secondary-100 hover:bg-secondary-800/70 inline-flex items-center rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors'
			)}
			onclick={shareCard}
		>
			<ShareNetworkIcon size={18} weight="duotone" class="mr-2" />
			Share
		</button>
	</div>
	{#if statusMessage}
		<p class="text-secondary-400 text-sm">{statusMessage}</p>
	{/if}
</div>
