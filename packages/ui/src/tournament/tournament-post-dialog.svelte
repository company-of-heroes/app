<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { Dialog } from 'bits-ui';
	import { watch } from 'runed';
	import { cn } from '@company-of-heroes/ui/cn';
	import {
		flushHeader,
		flushHeaderDescription,
		flushHeaderTitle,
		overlayBackdrop,
		surfaceModal
	} from '@company-of-heroes/ui/variants';
	import CloseIcon from 'phosphor-svelte/lib/XIcon';
	import { Button } from '../ui/button';
	import { MarkdownEditor } from '../ui/editor';
	import * as Form from '../ui/form';
	import { Checkbox, Input } from '../ui/input';
	import type { TournamentPost, TournamentPostInput } from './types';

	type Props = {
		open: boolean;
		/** The post to edit, or null for a new one. */
		post: TournamentPost | null;
		onSave: (input: TournamentPostInput) => Promise<void>;
		onClose: () => void;
	};

	let { open, post, onSave, onClose }: Props = $props();
	const { t } = useI18n();

	let title = $state('');
	let body = $state('');
	let important = $state(false);
	let pinned = $state(false);
	let saving = $state(false);

	// Automatic updates are worded by the site; staff may add a title or a note.
	const automatic = $derived(post !== null && post.kind !== 'announcement');
	const valid = $derived(automatic || title.trim().length > 0);

	watch(
		() => [open, post] as const,
		([isOpen, current]) => {
			if (isOpen) {
				title = current?.title ?? '';
				body = current?.body ?? '';
				important = current?.important ?? false;
				pinned = current?.pinned ?? false;
			}
		}
	);

	async function save() {
		if (!valid || saving) {
			return;
		}

		saving = true;
		try {
			await onSave({ title: title.trim(), body, important, pinned });
		} finally {
			saving = false;
		}
	}
</script>

<Dialog.Root
	{open}
	onOpenChange={(next) => {
		if (!next && !saving) {
			onClose();
		}
	}}
>
	<Dialog.Portal>
		<Dialog.Overlay class={cn(overlayBackdrop, 'fixed inset-0 z-50')} />
		<Dialog.Content
			class={cn(
				'absolute top-0 left-1/2 z-50 mx-auto mt-12 w-[640px] max-w-[calc(100%-2rem)] -translate-x-1/2 overflow-hidden outline-hidden',
				surfaceModal
			)}
		>
			<Dialog.Title class={flushHeader}>
				<div class="flex items-start justify-between gap-4">
					<div class="min-w-0">
						<p class={flushHeaderTitle}>{post ? t('Edit update') : t('Post an update')}</p>
						<Dialog.Description class={flushHeaderDescription}>
							{post
								? t('Participants are not notified again when you edit an update.')
								: t('Every participant gets a notification in the app.')}
						</Dialog.Description>
					</div>
					<Dialog.Close
						class="bg-secondary-800 hover:bg-secondary-700 cursor-pointer rounded-md p-1 transition outline-none"
						aria-label={t('Close')}
					>
						<CloseIcon size={20} />
					</Dialog.Close>
				</div>
			</Dialog.Title>
			<form
				class="flex flex-col"
				onsubmit={(event) => {
					event.preventDefault();
					void save();
				}}
			>
				<Form.Group label={t('Title')} inputId="tournament-post-title" required={!automatic} wide>
					<Input
						id="tournament-post-title"
						bind:value={title}
						maxlength={200}
						required={!automatic}
						placeholder={automatic
							? t('Leave empty to keep the automatic title')
							: t('E.g. Round 2 starts on Friday')}
						disabled={saving}
					/>
				</Form.Group>
				<Form.Group label={automatic ? t('Note') : t('Message')} wide>
					<MarkdownEditor
						bind:value={body}
						maxLength={20000}
						aria-label={automatic ? t('Note') : t('Message')}
						placeholder={t('What do the players need to know?')}
						disabled={saving}
					/>
				</Form.Group>
				<div class="border-secondary-800 flex flex-col gap-3 border-b px-4 py-4">
					<Checkbox
						bind:checked={important}
						size="sm"
						disabled={saving}
						label={t('Important: also show it as a popup to every participant')}
					/>
					<Checkbox
						bind:checked={pinned}
						size="sm"
						disabled={saving}
						label={t('Pin it to the top of the updates')}
					/>
				</div>
				<div class="flex flex-wrap justify-end gap-2 px-4 py-4">
					<Button type="button" variant="ghost" disabled={saving} onclick={onClose}>
						{t('Cancel')}
					</Button>
					<Button type="submit" disabled={!valid || saving} loading={saving}>
						{post ? t('Save update') : t('Post update')}
					</Button>
				</div>
			</form>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
