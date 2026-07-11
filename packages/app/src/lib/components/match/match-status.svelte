<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { useMatch } from '.';
	import { cn } from '$lib/utils';
	import { tooltip } from '$lib/attachments';
	import HourGlass from 'phosphor-svelte/lib/Hourglass';
	import Checks from 'phosphor-svelte/lib/Checks';

	type Props = HTMLAttributes<HTMLSpanElement>;

	const { ...restProps }: Props = $props();
	const match = useMatch();
</script>

<span {...restProps} class={cn('inline-flex items-center', restProps.class)}>
	{#if match.needsResult}
		<HourGlass class="text-primary" {@attach tooltip('Result pending')} />
	{:else}
		<Checks class="text-green-400" {@attach tooltip('Result saved')} />
	{/if}
</span>
