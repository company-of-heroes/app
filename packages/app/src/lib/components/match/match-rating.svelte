<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { useMatch } from '.';
	import { cn } from '$lib/utils';
	import { tooltip } from '$lib/attachments';
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

		return players.find((p) => match.user.steamIds?.includes(p.steamId)) ?? null;
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
			<span class="text-red-200">{player.oldrating - player.newrating}</span>
		{:else}
			<CaretUp class="inline-block text-green-400" weight="duotone" />
			<span class="text-green-100">{player.newrating - player.oldrating}</span>
		{/if}
	{/if}
</span>
