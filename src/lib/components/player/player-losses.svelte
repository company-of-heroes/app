<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { usePlayer } from '.';

	type Props = HTMLAttributes<HTMLSpanElement>;

	const { ...restProps }: Props = $props();

	const player = usePlayer();
</script>

<span class="text-center text-red-100" {...restProps}>{player.losses}</span>
