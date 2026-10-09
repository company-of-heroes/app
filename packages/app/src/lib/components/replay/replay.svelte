<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { Root as ReplayDataRoot, type ReplayData } from '@company-of-heroes/ui/replay';
	import { createReplay } from '.';

	type Props = {
		file: Uint8Array;
	} & HTMLAttributes<HTMLDivElement>;

	const { file, children, ...restProps }: Props = $props();
	const replay = createReplay(() => file);
	/** Parser output is structurally the shared replay shape the ui pieces read. */
	const replayData = replay as unknown as ReplayData;
</script>

<div {...restProps}>
	<ReplayDataRoot replay={replayData}>
		{@render children?.()}
	</ReplayDataRoot>
</div>
