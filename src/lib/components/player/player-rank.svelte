<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { upperCase } from 'lodash-es';
	import { usePlayer } from '.';
	import { getRankImage } from '$lib/utils';

	type Props = HTMLAttributes<HTMLSpanElement>;

	const { ...restProps }: Props = $props();
	const player = usePlayer();
</script>

<!-- <span class="flex items-center">
{#if player.profile}
	<img src={getRankImage(player.race, player.)}
{/if}
</span> -->
