<script lang="ts">
	import { onMount } from 'svelte';
	import { usePlayer } from './context';
	import { steam } from '$core/steam';
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';

	type Props = HTMLAttributes<HTMLElement>;

	let { player } = usePlayer();
	let { ...restProps }: Props = $props();
	let imgSrc: string | null = $state(null);

	onMount(() => {
		if (!player.steamId) {
			return;
		}

		steam.getUserProfile(player.steamId).then((profile) => {
			imgSrc = profile?.avatarfull || null;
		});
	});
</script>

{#if imgSrc}
	<div class="w-full overflow-clip">
		<img
			src={imgSrc}
			alt={player.profile?.alias || 'Player Avatar'}
			{...restProps}
			class={cn('relative -m-0.5 w-full', restProps.class)}
		/>
	</div>
{:else}
	<div {...restProps} class={cn('flex items-center justify-center bg-gray-600', restProps.class)}>
		<span class="text-xl text-white">?</span>
	</div>
{/if}
