<script lang="ts">
	import type { MatchExpanded } from '$core/app/database/matches';
	import type { HTMLAnchorAttributes } from 'svelte/elements';
	import type { Snippet } from 'svelte';
	import { createMatch } from '.';
	import { isEmpty } from 'lodash-es';

	type Props = {
		match: MatchExpanded;
		children: Snippet;
	} & HTMLAnchorAttributes;

	let { match, children, ...restProps }: Props = $props();
	createMatch(() => match);
</script>

{#if false === isEmpty(restProps)}
	<a {...restProps}>
		{@render children()}
	</a>
{:else}
	{@render children()}
{/if}
