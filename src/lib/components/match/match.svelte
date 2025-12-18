<script lang="ts">
	import type { LobbiesResponse } from '$core/pocketbase/types';
	import type { LobbyPlayer, Match } from '@fknoobs/app';
	import type { Snippet } from 'svelte';
	import { createMatch } from '.';

	type Props = {
		match: LobbiesResponse<LobbyPlayer[], Match | null>;
		children: Snippet;
	};

	let { match, children }: Props = $props();

	createMatch(match);
</script>

{@render children()}
