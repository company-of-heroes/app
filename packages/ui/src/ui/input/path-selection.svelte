<script lang="ts">
	import { cn } from '@company-of-heroes/ui/cn';
	import FolderOpenIcon from 'phosphor-svelte/lib/FolderOpenIcon';
	import { Button } from '../button';
	import { controlBase } from '../../variants';
	import { escapeHtml, tooltip } from '../../attachments';

	export type PathSelectionProps = {
		value?: string;
		/** Opens the host's file / folder dialog; resolves the picked path or null when cancelled. */
		pick: (current: string | undefined) => Promise<string | null>;
		onSelect?: (path: string) => void;
		disabled?: boolean;
		placeholder?: string;
		selectLabel?: string;
		class?: string;
	};

	let {
		value = $bindable(),
		pick,
		onSelect,
		disabled = false,
		placeholder = 'No path selected',
		selectLabel = 'Select',
		class: className
	}: PathSelectionProps = $props();

	async function select() {
		const picked = await pick(value);
		if (!picked) {
			return;
		}

		value = picked;
		onSelect?.(picked);
	}
</script>

<div class={cn('grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3', className)}>
	<div
		class={cn(
			controlBase,
			'flex min-w-0 items-center truncate px-4 select-text',
			value ? 'text-secondary-400' : 'text-secondary-600'
		)}
		{@attach tooltip(escapeHtml(value ?? ''))}
	>
		{value || placeholder}
	</div>
	<Button
		variant="secondary"
		type="button"
		{disabled}
		onclick={() => void select()}
		class="w-fit shrink-0"
	>
		<FolderOpenIcon size={16} />
		{selectLabel}
	</Button>
</div>
