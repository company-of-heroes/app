<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { useMatch } from '.';
	import { cn } from '$lib/utils';
	import { tooltip } from '$lib/attachments';
	import Ranking from 'phosphor-svelte/lib/Ranking';

	type Props = HTMLAttributes<HTMLSpanElement>;

	const { ...restProps }: Props = $props();
	const match = useMatch();
	const title = $derived(
		match.isRanked ? match.title : match.result ? (match.result as any).description : match.title
	);
</script>

<span {...restProps} class={cn('flex items-center gap-2 font-medium', restProps.class)}>
	{#if match.isRanked}
		<span {@attach tooltip('Ranked match')}>
			<Ranking class="text-primary-100" weight="duotone" />
		</span>
	{/if}
	{title}
</span>
