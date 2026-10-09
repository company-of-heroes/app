<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { TOURNAMENT_IMAGE_TYPES } from '@company-of-heroes/api/tournaments';
	import { useHost } from '../host/host.context';
	import { Button } from '../ui/button';
	import { FileDropzone } from '../ui/input';
	import ImageSquareIcon from 'phosphor-svelte/lib/ImageSquareIcon';
	import TrashIcon from 'phosphor-svelte/lib/TrashIcon';
	import UploadSimpleIcon from 'phosphor-svelte/lib/UploadSimpleIcon';
	import { tooltip } from '../attachments';

	type Props = {
		id: string;
		/** Current stored image, or null. */
		currentUrl: string | null;
		maxBytes: number;
		tooBigMessage: string;
		/** Logo: square preview; banner: wide preview. */
		shape: 'square' | 'wide';
		file: File | null;
		clear: boolean;
		disabled?: boolean;
	};

	let {
		id,
		currentUrl,
		maxBytes,
		tooBigMessage,
		shape,
		file = $bindable(),
		clear = $bindable(),
		disabled = false
	}: Props = $props();
	const { t } = useI18n();
	const host = useHost();

	const previewUrl = $derived(file ? URL.createObjectURL(file) : null);
	const shown = $derived(previewUrl ?? (clear ? null : currentUrl));

	$effect(() => {
		const url = previewUrl;
		return () => {
			if (url) {
				URL.revokeObjectURL(url);
			}
		};
	});

	function accept(next: File): boolean {
		if (!TOURNAMENT_IMAGE_TYPES.includes(next.type)) {
			host.notify.error(t('Use a JPEG, PNG or WebP image.'));
			return false;
		}

		if (next.size > maxBytes) {
			host.notify.error(t(tooBigMessage));
			return false;
		}

		return true;
	}
</script>

<div class={cn('relative', shape === 'square' ? 'w-32' : 'w-full')}>
	<FileDropzone
		{id}
		{disabled}
		accept={TOURNAMENT_IMAGE_TYPES.join(',')}
		acceptFile={accept}
		fileName={file?.name ?? (shown ? t('Current image') : null)}
		zoneClass={cn(
			'relative overflow-hidden p-0 border-dashed',
			shown && 'border-solid',
			shape === 'square' ? 'aspect-square min-h-0' : 'aspect-[4/1] min-h-28'
		)}
		onFileChange={(next) => {
			file = next;
			if (next) {
				clear = false;
			}
		}}
	>
		{#snippet empty(dragging)}
			<div class="flex flex-col items-center gap-1 px-3">
				<ImageSquareIcon
					size={shape === 'square' ? 24 : 28}
					class={cn(
						'text-secondary-500 group-hover:text-secondary-300 transition-colors',
						dragging && 'text-secondary-200'
					)}
				/>
				<span class="text-sm">{t('Drop an image here')}</span>
				<span id="{id}-hint" class="text-secondary-400 text-xs font-normal">
					{t('or click to browse')}
				</span>
			</div>
		{/snippet}
		{#snippet selected(fileName, dragging)}
			<img src={shown} alt="" class="absolute inset-0 size-full object-cover" />
			<div
				class={cn(
					'bg-secondary-950/70 absolute inset-0 flex flex-col items-center justify-center gap-1 px-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100',
					dragging && 'opacity-100'
				)}
			>
				<UploadSimpleIcon size={20} class="text-secondary-200" />
				<span id="{id}-hint" class="text-sm">{t('Change image')}</span>
				{#if shape === 'wide'}
					<span class="text-secondary-400 max-w-full truncate text-xs font-normal">{fileName}</span>
				{/if}
			</div>
		{/snippet}
	</FileDropzone>
	{#if shown}
		<Button
			type="button"
			variant="secondary"
			size="icon-sm"
			class="bg-secondary-950/80 hover:text-destructive absolute top-2 right-2 backdrop-blur-sm"
			aria-label={t('Remove image')}
			{@attach tooltip(t('Remove image'))}
			{disabled}
			onclick={() => {
				file = null;
				clear = true;
			}}
		>
			<TrashIcon size={16} />
		</Button>
	{/if}
</div>
