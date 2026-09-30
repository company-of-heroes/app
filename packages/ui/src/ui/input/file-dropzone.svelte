<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '@company-of-heroes/ui/cn';
	import {
		controlDisabled,
		fileDropzone,
		fileDropzoneDragging,
		interactive
	} from '@company-of-heroes/ui/variants';
	import UploadSimpleIcon from 'phosphor-svelte/lib/UploadSimpleIcon';

	export type FileDropzoneProps = {
		fileName?: string | null;
		busy?: boolean;
		disabled?: boolean;
		id?: string;
		/** Native accept attribute, e.g. `.rec,application/octet-stream`. */
		accept?: string;
		/** Return false to reject a picked/dropped file. */
		acceptFile?: (file: File) => boolean;
		label?: string;
		dropLabel?: string;
		browseLabel?: string;
		changeFileLabel?: string;
		/** Extra attrs for the hidden file input (e.g. remote form `fields.file.as('file')`). */
		inputProps?: Record<string, unknown>;
		/** Edge-to-edge in a bordered section (no side padding / rounded corners). */
		flush?: boolean;
		onFileChange: (file: File | null) => void;
		icon?: Snippet<[dragging: boolean]>;
		/** Custom empty-state content; replaces default icon + labels. */
		empty?: Snippet<[dragging: boolean]>;
		/** Custom selected-state content; replaces default filename + change label. */
		selected?: Snippet<[fileName: string, dragging: boolean]>;
		class?: string;
		/** Override the drop target surface (replay upload uses a taller dashed zone). */
		zoneClass?: string;
	};

	let {
		fileName = null,
		busy = false,
		disabled = false,
		id = 'file-dropzone',
		accept,
		acceptFile,
		label,
		dropLabel = 'Drop a file here',
		browseLabel = 'or click to browse',
		changeFileLabel = 'Change file',
		inputProps,
		flush = false,
		onFileChange,
		icon,
		empty,
		selected,
		class: className,
		zoneClass
	}: FileDropzoneProps = $props();

	let inputEl = $state<HTMLInputElement | null>(null);
	let dragDepth = $state(0);

	let blocked = $derived(disabled || busy);
	let dragging = $derived(dragDepth > 0 && !blocked);
	let hasFile = $derived(!!fileName);

	$effect(() => {
		if (fileName || !inputEl) {
			return;
		}

		inputEl.value = '';
	});

	function isAllowed(file: File) {
		if (acceptFile) {
			return acceptFile(file);
		}

		return true;
	}

	function openPicker() {
		if (blocked) {
			return;
		}

		inputEl?.click();
	}

	function setInputFile(file: File | null) {
		if (!inputEl) {
			return;
		}

		if (!file) {
			inputEl.value = '';
			return;
		}

		const transfer = new DataTransfer();
		transfer.items.add(file);
		inputEl.files = transfer.files;
	}

	function applyFile(file: File | null) {
		if (blocked) {
			return;
		}

		if (!file) {
			setInputFile(null);
			onFileChange(null);
			return;
		}

		if (!isAllowed(file)) {
			return;
		}

		setInputFile(file);
		onFileChange(file);
	}

	function onInputChange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0] ?? null;
		if (!file) {
			onFileChange(null);
			return;
		}

		if (!isAllowed(file)) {
			input.value = '';
			return;
		}

		onFileChange(file);
	}

	function onDragEnter(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();
		if (blocked) {
			return;
		}

		dragDepth += 1;
	}

	function onDragOver(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = 'copy';
		}
	}

	function onDragLeave(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();
		if (blocked) {
			return;
		}

		dragDepth = Math.max(0, dragDepth - 1);
	}

	function onDrop(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();
		dragDepth = 0;
		if (blocked) {
			return;
		}

		const file = event.dataTransfer?.files?.[0] ?? null;
		applyFile(file);
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key !== 'Enter' && event.key !== ' ') {
			return;
		}

		event.preventDefault();
		openPicker();
	}
</script>

<div class={cn('flex w-full flex-col', !flush && 'gap-2', className)}>
	{#if label}
		<span
			class={cn(
				'text-secondary-300 text-sm font-medium',
				flush && 'px-4 pt-3 pb-2 text-xs font-semibold tracking-wide uppercase'
			)}
			id="{id}-label">{label}</span
		>
	{/if}

	<div
		role="button"
		tabindex={blocked ? -1 : 0}
		aria-labelledby={label ? `${id}-label` : undefined}
		aria-describedby="{id}-hint"
		aria-busy={busy || undefined}
		aria-disabled={blocked || undefined}
		data-dragging={dragging ? '' : undefined}
		class={cn(
			interactive,
			'group',
			fileDropzone,
			controlDisabled,
			dragging && fileDropzoneDragging,
			flush && 'rounded-none border-x-0 border-b-0',
			blocked && 'pointer-events-none opacity-60',
			zoneClass
		)}
		onclick={openPicker}
		onkeydown={onKeydown}
		ondragenter={onDragEnter}
		ondragover={onDragOver}
		ondragleave={onDragLeave}
		ondrop={onDrop}
	>
		{#if hasFile && selected}
			{@render selected(fileName!, dragging)}
		{:else if !hasFile && empty}
			{@render empty(dragging)}
		{:else}
			{#if icon}
				{@render icon(dragging)}
			{:else}
				<UploadSimpleIcon
					size={24}
					class={cn('text-secondary-400', dragging && 'text-secondary-200')}
				/>
			{/if}
			{#if hasFile}
				<span class="max-w-full truncate text-white">{fileName}</span>
				<span id="{id}-hint" class="text-secondary-400 text-sm font-normal">{changeFileLabel}</span>
			{:else}
				<span>{dropLabel}</span>
				<span id="{id}-hint" class="text-secondary-400 text-sm font-normal">{browseLabel}</span>
			{/if}
		{/if}
	</div>

	<input
		{...inputProps}
		bind:this={inputEl}
		{id}
		type="file"
		class="hidden"
		{accept}
		disabled={blocked}
		onchange={onInputChange}
		tabindex="-1"
		aria-hidden="true"
	/>
</div>
