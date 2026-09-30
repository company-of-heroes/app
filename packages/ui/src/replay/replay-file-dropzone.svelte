<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import FileDropzone from '../ui/input/file-dropzone.svelte';
	import { cn } from '../cn';
	import UploadSimpleIcon from 'phosphor-svelte/lib/UploadSimpleIcon';
	import FileArrowUpIcon from 'phosphor-svelte/lib/FileArrowUpIcon';
	import ChecksIcon from 'phosphor-svelte/lib/ChecksIcon';

	type Props = {
		fileName?: string | null;
		busy?: boolean;
		disabled?: boolean;
		id?: string;
		label?: string;
		inputProps?: Record<string, unknown>;
		flush?: boolean;
		onFileChange: (file: File | null) => void;
		class?: string;
		zoneClass?: string;
	};

	const { t } = useI18n();

	let {
		fileName = null,
		busy = false,
		disabled = false,
		id = 'replay-file-dropzone',
		label = t('Replay file'),
		inputProps,
		flush = false,
		onFileChange,
		class: className,
		zoneClass
	}: Props = $props();

	function acceptRec(file: File) {
		return file.name.toLowerCase().endsWith('.rec');
	}
</script>

<FileDropzone
	{fileName}
	{busy}
	{disabled}
	{id}
	{label}
	dropLabel={t('Drop a .rec file here')}
	browseLabel={t('or click to browse')}
	changeFileLabel={t('Change file')}
	{inputProps}
	{flush}
	{onFileChange}
	class={className}
	accept=".rec,application/octet-stream"
	acceptFile={acceptRec}
	zoneClass={cn(
		'relative min-h-48 gap-0 overflow-hidden border-dashed bg-secondary-950/20 px-6 py-10',
		'hover:bg-secondary-900/20',
		'data-[dragging]:border-primary data-[dragging]:bg-primary/10 data-[dragging]:text-primary',
		'before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(ellipse_at_center,color-mix(in_oklch,var(--color-primary)_12%,transparent)_0%,transparent_65%)] before:opacity-0 before:transition-opacity before:duration-200',
		'data-[dragging]:before:opacity-100',
		zoneClass
	)}
>
	{#snippet empty(dragging)}
		<div class="relative z-10 flex flex-col items-center gap-4">
			<div
				class={cn(
					'border-secondary-700 bg-secondary-900/90 text-secondary-300 flex size-14 items-center justify-center rounded-full border shadow-[inset_0_1px_0_color-mix(in_oklch,white_8%,transparent)] transition-colors duration-200',
					dragging && 'border-primary/40 bg-primary/15 text-primary'
				)}
			>
				<UploadSimpleIcon size={28} weight="duotone" />
			</div>
			<div class="flex max-w-sm flex-col items-center gap-1.5 text-center">
				<p
					class={cn(
						'font-heading text-lg font-bold tracking-wide text-white',
						dragging && 'text-primary'
					)}
				>
					{t('Drop a .rec file here')}
				</p>
				<p id="{id}-hint" class="text-secondary-400 text-sm">
					<span class="group-hover:text-secondary-200 transition-colors"
						>{t('or click to browse')}</span
					>
					<span class="text-secondary-600 mx-2" aria-hidden="true">·</span>
					<span
						class="border-secondary-700 bg-secondary-900/80 text-secondary-300 inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider uppercase"
					>
						.rec
					</span>
				</p>
			</div>
		</div>
	{/snippet}

	{#snippet selected(name, dragging)}
		<div class="relative z-10 flex max-w-full flex-col items-center gap-4">
			<div
				class={cn(
					'border-primary/30 bg-primary/10 text-primary flex size-14 items-center justify-center rounded-full border transition-colors duration-200',
					dragging && 'border-primary/50 bg-primary/20'
				)}
			>
				<ChecksIcon size={28} weight="bold" />
			</div>
			<div class="flex max-w-md flex-col items-center gap-1.5 text-center">
				<div class="flex max-w-full items-center gap-2">
					<FileArrowUpIcon size={16} class="text-secondary-400 shrink-0" weight="duotone" />
					<p class="truncate font-medium text-white" title={name}>{name}</p>
				</div>
				<p
					id="{id}-hint"
					class="text-secondary-400 group-hover:text-secondary-200 text-sm transition-colors"
				>
					{t('Change file')}
				</p>
			</div>
		</div>
	{/snippet}
</FileDropzone>
