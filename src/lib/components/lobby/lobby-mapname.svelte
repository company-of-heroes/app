<script lang="ts">
	import { H, type HeadingProps } from '../ui/h';
	import { useLobby } from '.';

	type Props = {} & Omit<HeadingProps, 'children'>;

	let { ...restProps }: Props = $props();
	let lobby = $derived(useLobby());
</script>

<H {...restProps}>{lobby.map}</H>
