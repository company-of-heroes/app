<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { useMatch } from '.';
	import { cn } from '$lib/utils';
	import { tooltip } from '$lib/attachments';
	import { app } from '$core/app';
	import CaretUp from 'phosphor-svelte/lib/CaretUp';
	import CaretDown from 'phosphor-svelte/lib/CaretDown';

	type Props = HTMLAttributes<HTMLSpanElement>;

	const { ...restProps }: Props = $props();
	const match = useMatch();
	const player = $derived.by(() => {
		const players = match.result?.players;
		if (!players?.length) {
			return null;
		}

		return players.find((p) => app.features.auth.user.steamIds.includes(p.steamId)) ?? null;
	});
</script>

<span
	{...restProps}
	class={cn('inline-flex items-center gap-2', restProps.class)}
	{@attach tooltip('Rating Change (elo)')}
>
	{#if player}
		{#if player.newrating < player.oldrating}
			<CaretDown class="inline-block text-red-400" weight="duotone" />
			{player.oldrating - player.newrating}
		{:else}
			<CaretUp class="inline-block text-green-400" weight="duotone" />
			{player.newrating - player.oldrating}
		{/if}
	{/if}
</span>
