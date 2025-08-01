<script lang="ts">
	import { cn } from '$lib/utils';
	import X from 'phosphor-svelte/lib/X';
	import type { EditorTab } from '../composables/useEditorTabs.svelte';

	interface Props {
		tabs: EditorTab[];
		activeTabIndex: number;
		onSwitchTab: (index: number) => void;
		onCloseTab: (index: number) => void;
	}

	let { tabs, activeTabIndex, onSwitchTab, onCloseTab }: Props = $props();
</script>

{#if tabs.length > 0}
	<div class="flex">
		{#each tabs as tab, index}
			<div
				class={cn(
					'flex items-center gap-2',
					'hover:bg-secondary-800',
					index === activeTabIndex ? 'bg-secondary-700 text-primary' : 'bg-secondary-900'
				)}
			>
				<button
					class="max-w-[120px] flex-1 truncate ps-4 text-left"
					onclick={() => onSwitchTab(index)}
				>
					{tab.name}
				</button>
				<button
					class="ml-2 flex h-8 w-8 items-center justify-center p-1 hover:bg-red-500 hover:text-white"
					onclick={(e) => {
						e.stopPropagation();
						onCloseTab(index);
					}}
				>
					<X size={12} />
				</button>
			</div>
		{/each}
	</div>
{/if}
