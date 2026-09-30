<script lang="ts">
	import { onMount } from 'svelte';
	import { usePlayer } from './context';
	import { steam } from '$core/steam';
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';
	import { useI18n } from '$lib/i18n';

	type Props = HTMLAttributes<HTMLElement>;

	let { player } = usePlayer();
	let { ...restProps }: Props = $props();
	const { t } = useI18n();
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
	<img
		src={imgSrc}
		alt={player.profile?.alias || t('Player Avatar')}
		{...restProps}
		class={cn('size-full object-cover', restProps.class)}
	/>
{:else}
	<div
		{...restProps}
		class={cn('flex size-full items-center justify-center bg-gray-600', restProps.class)}
	>
		<span class="text-xl text-white">?</span>
	</div>
{/if}
