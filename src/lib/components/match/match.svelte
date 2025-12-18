<script lang="ts">
	import type { LobbiesResponse } from '$core/pocketbase/types';
	import type { LobbyPlayer, Match } from '@fknoobs/app';
	import type { Snippet } from 'svelte';
	import { createMatch } from '.';
	import type { HTMLAttributes } from 'svelte/elements';
	import { isEmpty } from 'lodash-es';

	type Props = {
		match: LobbiesResponse<LobbyPlayer[], Match | null>;
		children: Snippet;
	} & HTMLAttributes<HTMLDivElement>;

	let { match, children, ...restProps }: Props = $props();
	createMatch(match);
</script>

{#if false === isEmpty(restProps)}
	<div {...restProps}>
		{@render children()}
	</div>
{:else}
	{@render children()}
{/if}
