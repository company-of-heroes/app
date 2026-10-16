<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { IMAGE_TYPES } from '@company-of-heroes/api';
	import { useHost } from '../../host/host.context';
	import { Button } from '../button';
	import { FileDropzone } from '../input';
	import ImageSquareIcon from 'phosphor-svelte/lib/ImageSquareIcon';
	import TrashIcon from 'phosphor-svelte/lib/TrashIcon';
	import UploadSimpleIcon from 'phosphor-svelte/lib/UploadSimpleIcon';
	import { tooltip } from '../../attachments';

	type Props = {
		id: string;
		/** Current stored image, or null. */
		currentUrl: string | null;
		maxBytes: number;
		/** i18n key shown when the file is too large. */
		tooBigMessage: string;
		/**
		 * Logo: square; banner: 4:1; cover: 1.91:1 (Open Graph), full width; portrait: 3:5 with the
		 * whole image shown (medals).
		 */
		shape: 'square' | 'wide' | 'cover' | 'portrait';
		/** Accepted MIME types; JPEG, PNG and WebP by default. */
		accept?: string[];
		/** i18n key shown for a file of another type. */
		typeMessage?: string;
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
		accept: acceptTypes = IMAGE_TYPES,
		typeMessage = 'Use a JPEG, PNG or WebP image.',
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
		if (!acceptTypes.includes(next.type)) {
			host.notify.error(t(typeMessage));
			return false;
		}

		if (next.size > maxBytes) {
			host.notify.error(t(tooBigMessage));
			return false;
		}

		return true;
	}
</script>

<div
	class={cn(
		'relative',
		(shape === 'square' || shape === 'portrait') && 'w-28',
		shape === 'wide' && 'w-full max-w-md',
		shape === 'cover' && 'w-full'
	)}
>
	<FileDropzone
		{id}
		{disabled}
		accept={acceptTypes.join(',')}
		acceptFile={accept}
		fileName={file?.name ?? (shown ? t('Current image') : null)}
		zoneClass={cn(
			'relative overflow-hidden p-0 border-dashed min-h-0',
			shown && 'border-solid',
			shape === 'square' && 'aspect-square',
			shape === 'wide' && 'aspect-[4/1]',
			shape === 'cover' && 'aspect-[1.91/1]',
			shape === 'portrait' && 'aspect-[3/5]'
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
					size={24}
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
			<img
				src={shown}
				alt=""
				class={cn(
					'absolute inset-0 size-full',
					shape === 'portrait' ? 'object-contain p-2' : 'object-cover'
				)}
			/>
			<div
				class={cn(
					'bg-secondary-950/70 absolute inset-0 flex flex-col items-center justify-center gap-1 px-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100',
					dragging && 'opacity-100'
				)}
			>
				<UploadSimpleIcon size={20} class="text-secondary-200" />
				<span id="{id}-hint" class="text-sm">{t('Change image')}</span>
				{#if shape !== 'square' && shape !== 'portrait'}
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
