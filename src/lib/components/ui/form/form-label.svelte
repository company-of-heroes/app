<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Label, type LabelProps } from '../label';

	type Props = {
		children: Snippet;
	} & LabelProps;
	let { children, ...restProps }: Props = $props();
</script>

<Label {...restProps}>{@render children()}</Label>
