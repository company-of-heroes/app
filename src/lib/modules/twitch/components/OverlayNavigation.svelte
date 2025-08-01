<script lang="ts">
	import { cn } from '$lib/utils';

	interface Overlay {
		name: string;
		isActive: boolean;
	}

	interface Props {
		overlays: Overlay[];
		onSelectOverlay: (overlay: Overlay) => void;
	}

	let { overlays, onSelectOverlay }: Props = $props();
</script>

<nav class="mb-6 flex items-center gap-4">
	{#each overlays as overlay}
		<button
			class={cn(
				'text-secondary-500 hover:text-secondary-300 cursor-pointer font-bold',
				overlay.isActive && 'text-primary hover:text-primary hover:cursor-default'
			)}
			onclick={() => onSelectOverlay(overlay)}
		>
			{overlay.name}
		</button>
	{/each}
</nav>
