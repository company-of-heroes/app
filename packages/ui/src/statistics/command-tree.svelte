<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import ArrowDownIcon from 'phosphor-svelte/lib/ArrowDownIcon';
	import { tooltip } from '../attachments/tooltip.svelte';

	export type CommandTreeNode = {
		key: string;
		name: string;
		help?: string;
		icon?: string;
		/** Command points to unlock. */
		command?: number;
	};

	type Props = {
		/** Two branches, each unlocked top to bottom. */
		branches: CommandTreeNode[][];
		class?: string;
	};

	let { branches, class: className }: Props = $props();
	const { t } = useI18n();

	function escapeHtml(value: string): string {
		return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
	}
</script>

<!-- Like the in-game command tree: two branches side by side, unlocked top to bottom. -->
{#if branches.length}
	<div class={cn('divide-secondary-800 grid grid-cols-2 divide-x', className)}>
		{#each branches as branch, column (column)}
			<ol class="bg-secondary-900/30 flex flex-col items-center px-2 py-3">
				{#each branch as node, step (node.key)}
					{#if step > 0}
						<li aria-hidden="true" class="py-1">
							<ArrowDownIcon class="text-secondary-600 size-4" weight="bold" />
						</li>
					{/if}
					<li class="flex w-full flex-col items-center">
						<div
							class="relative"
							{@attach tooltip(
								`<span class="block font-semibold">${escapeHtml(node.name)}</span>` +
									(node.help
										? `<span class="text-secondary-300 mt-1 block text-xs font-normal">${escapeHtml(node.help)}</span>`
										: '')
							)}
						>
							{#if node.icon}
								<img
									src={node.icon}
									alt=""
									class="border-secondary-700 size-11 rounded-sm border shadow-md shadow-black/40"
								/>
							{:else}
								<span class="border-secondary-700 bg-secondary-800 block size-11 rounded-sm border"
								></span>
							{/if}
							{#if node.command}
								<span
									class="border-secondary-700 absolute top-1/2 left-full ml-1.5 flex size-6 -translate-y-1/2 items-center justify-center rounded-sm border bg-gray-950 text-xs font-bold text-yellow-300 tabular-nums"
								>
									<span class="sr-only">{t('Command points')}</span>
									{node.command}
								</span>
							{/if}
						</div>
						<p class="mt-1.5 line-clamp-2 text-center text-[11px] leading-tight text-white">
							{node.name}
						</p>
					</li>
				{/each}
			</ol>
		{/each}
	</div>
{/if}
