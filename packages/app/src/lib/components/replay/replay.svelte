<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { createReplay } from '.';

	type Props = {
		file: Uint8Array;
	} & HTMLAttributes<HTMLDivElement>;

	const { file, children, ...restProps }: Props = $props();
	const replay = createReplay(() => file);

	console.log(replay);
</script>

<div {...restProps}>
	{@render children?.()}
</div>
