<script lang="ts">
	import type { HTMLAnchorAttributes } from 'svelte/elements';
	import type { Snippet } from 'svelte';
	import { isEmpty } from 'lodash-es';
	import { createMatch } from '.';
	import { toMatchView, type MatchInput } from './match-view';

	type Props = {
		match: MatchInput;
		children: Snippet;
	} & HTMLAnchorAttributes;

	let { match, children, ...restProps }: Props = $props();
	createMatch(() => toMatchView(match));
</script>

{#if false === isEmpty(restProps)}
	<a {...restProps}>
		{@render children()}
	</a>
{:else}
	{@render children()}
{/if}
