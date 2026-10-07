<script lang="ts">
	import type { DocRef } from '@company-of-heroes/game-data/types';
	import { cn } from '@company-of-heroes/ui/cn';
	import DocsRefRow from './docs-ref-row.svelte';

	type Props = {
		refs: DocRef[];
		/** Small grey line under every name (e.g. "Upgrade"). */
		note?: string;
		/** Classes for the grid itself (e.g. column overrides). */
		class?: string;
	};

	let { refs, note, class: className }: Props = $props();
</script>

<!-- Stats rows in columns: every cell draws its right and bottom line. The wrapper clips the right
edge and overlaps the panel's bottom border by a pixel, so short columns still end in a line
without a double line under the longest one. -->
<div class="-mb-px overflow-hidden">
	<ul class={cn('-mr-px grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3', className)}>
		{#each refs as ref (`${ref.kind}:${ref.slug}`)}
			<li class="border-secondary-800 min-w-0 border-r border-b">
				<DocsRefRow {ref} {note} />
			</li>
		{/each}
	</ul>
</div>
