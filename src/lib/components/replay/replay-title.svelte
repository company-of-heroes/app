<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { H } from '../ui/h';
	import { useReplay } from '.';

	type Props = {} & HTMLAttributes<HTMLHeadingElement>;

	let { ...restProps }: Props = $props();
	let replay = $derived(useReplay());
</script>

<H level="1" {...restProps}>{replay.replayName || '-'}</H>
