<script lang="ts">
	import { LinkPreview } from 'bits-ui';
	import type { Snippet } from 'svelte';
	import type { HTMLAnchorAttributes } from 'svelte/elements';
	import { cn } from '@company-of-heroes/ui/cn';
	import { getCachedPlayerPreview } from './player-preview-cache';
	import { tryUseHost } from '../host/host.context';
	import PlayerPreviewCard from './player-preview-card.svelte';
	import type { PlayerFactionPreview, PlayerPreviewData } from './types';

	type Props = {
		href: string;
		playerId: string;
		/** When set, skip profile fetch and show local faction/match stats. */
		preview?: PlayerFactionPreview | null;
		class?: string;
		children: Snippet;
		openDelay?: number;
		closeDelay?: number;
	} & Omit<HTMLAnchorAttributes, 'href' | 'children' | 'class'>;

	let {
		href,
		playerId,
		preview = null,
		class: className,
		children,
		openDelay = 700,
		closeDelay = 300,
		...restProps
	}: Props = $props();

	const host = tryUseHost();
	const snapshotMode = $derived(Boolean(preview));
	const previewEnabled = $derived(Boolean(host && playerId.trim()));

	let open = $state(false);
	let loading = $state(false);
	let error = $state(false);
	let player = $state.raw<PlayerPreviewData | null>(null);
	let requestId = 0;

	async function loadPreview(id: string) {
		if (!host) {
			return;
		}

		const current = ++requestId;
		loading = true;
		error = false;

		try {
			const data = await getCachedPlayerPreview(id, host.api.players.getPreview);
			if (current !== requestId) {
				return;
			}

			player = data;
			error = data == null;
		} catch {
			if (current !== requestId) {
				return;
			}

			player = null;
			error = true;
		} finally {
			if (current === requestId) {
				loading = false;
			}
		}
	}

	function onOpenChange(next: boolean) {
		open = next;
		if (!next) {
			return;
		}

		const id = playerId.trim();
		if (!id) {
			return;
		}

		void loadPreview(id);
	}
</script>

{#if previewEnabled}
	<LinkPreview.Root bind:open {openDelay} {closeDelay} {onOpenChange}>
		<LinkPreview.Trigger {href} class={cn(className)} {...restProps as Record<string, unknown>}>
			{@render children()}
		</LinkPreview.Trigger>
		<LinkPreview.Portal>
			<LinkPreview.Content class="z-50 outline-none" side="top" sideOffset={8} align="start">
				<PlayerPreviewCard
					{player}
					faction={snapshotMode ? preview : null}
					loading={loading && !snapshotMode}
					error={error && !snapshotMode}
				/>
			</LinkPreview.Content>
		</LinkPreview.Portal>
	</LinkPreview.Root>
{:else}
	<a {href} class={cn(className)} {...restProps}>
		{@render children()}
	</a>
{/if}
