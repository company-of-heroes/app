<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { H } from '../ui/h';
	import { useLobby } from '.';

	type Props = {} & HTMLAttributes<HTMLHeadingElement>;

	let lobby = useLobby();
	let { ...restProps }: Props = $props();
</script>

<H level={4} {...restProps}>{lobby.map}</H>
