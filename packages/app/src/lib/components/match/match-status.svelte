<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { useMatch } from '.';
	import { tooltip } from '$lib/attachments';
	import HourGlass from 'phosphor-svelte/lib/Hourglass';
	import Checks from 'phosphor-svelte/lib/Checks';

	type Props = HTMLAttributes<HTMLSpanElement>;

	const { ...restProps }: Props = $props();
	const match = useMatch();
</script>

<span {...restProps}>
	{#if match.needsResult}
		<HourGlass class="text-primary ms-auto" {@attach tooltip('Result pending')} />
	{:else}
		<Checks class="ms-auto text-green-400" {@attach tooltip('Result saved')} />
	{/if}
</span>
